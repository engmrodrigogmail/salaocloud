// Edge function: client-review-submit
// Persists client-side review (overall + per professional) and generates a reward coupon if enabled.
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractSessionToken, resolveClientFromSession } from "../_shared/client-session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-session",
};

interface SubmitInput {
  review_id: string;
  rating: number;
  comment?: string;
  professionals?: { professional_id: string; rating: number; comment?: string }[];
}

function randomCouponCode(prefix = "AVAL") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}-${s}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = extractSessionToken(req);
    const client_id = await resolveClientFromSession(token);
    if (!client_id) return json({ error: "unauthorized" }, 401);

    const body = (await req.json()) as SubmitInput;
    if (!body?.review_id || !body?.rating || body.rating < 1 || body.rating > 5) {
      return json({ error: "invalid_input" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: review } = await admin
      .from("tab_reviews")
      .select("id, establishment_id, tab_id, client_id, status, reward_coupon_id")
      .eq("id", body.review_id)
      .maybeSingle();
    if (!review) return json({ error: "not_found" }, 404);
    if (review.client_id !== client_id) return json({ error: "forbidden" }, 403);
    if (review.status === "submitted") return json({ error: "already_submitted" }, 400);

    // Persist overall review
    const { error: updErr } = await admin
      .from("tab_reviews")
      .update({
        client_rating: body.rating,
        client_comment: body.comment ?? null,
        client_submitted_at: new Date().toISOString(),
        status: "submitted",
      })
      .eq("id", body.review_id);
    if (updErr) return json({ error: updErr.message }, 500);

    // Per professional ratings (upsert by tab_review_id + professional_id)
    if (body.professionals?.length) {
      for (const p of body.professionals) {
        if (!p.professional_id || !p.rating) continue;
        // try update existing row (created by trigger), else insert
        const { data: existing } = await admin
          .from("tab_review_professionals")
          .select("id")
          .eq("tab_review_id", body.review_id)
          .eq("professional_id", p.professional_id)
          .maybeSingle();
        if (existing?.id) {
          await admin
            .from("tab_review_professionals")
            .update({ rating: p.rating, comment: p.comment ?? null })
            .eq("id", existing.id);
        } else {
          await admin.from("tab_review_professionals").insert({
            tab_review_id: body.review_id,
            professional_id: p.professional_id,
            rating: p.rating,
            comment: p.comment ?? null,
          });
        }
      }
    }

    // Generate reward coupon if enabled
    const { data: settings } = await admin
      .from("review_settings")
      .select("*")
      .eq("establishment_id", review.establishment_id)
      .maybeSingle();

    let coupon: { code: string; description: string | null } | null = null;
    let google_url: string | null = null;

    if (settings?.reward_enabled && settings.reward_discount_value > 0) {
      const validityDays = Math.max(1, settings.reward_coupon_validity_days ?? 30);
      const validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();
      let target: "total" | "services" | "products" = "total";
      const applicableServices: string[] = [];
      const applicableProducts: string[] = [];
      if (settings.reward_target === "service" && settings.reward_target_service_id) {
        target = "services";
        applicableServices.push(settings.reward_target_service_id);
      } else if (settings.reward_target === "product" && settings.reward_target_product_id) {
        target = "products";
        applicableProducts.push(settings.reward_target_product_id);
      }

      // Generate unique code
      let code = randomCouponCode();
      for (let i = 0; i < 5; i++) {
        const { data: dup } = await admin
          .from("discount_coupons")
          .select("id")
          .eq("establishment_id", review.establishment_id)
          .eq("code", code)
          .maybeSingle();
        if (!dup) break;
        code = randomCouponCode();
      }

      const description = settings.reward_description || "Recompensa por avaliação";
      const { data: newCoupon, error: cErr } = await admin
        .from("discount_coupons")
        .insert({
          establishment_id: review.establishment_id,
          code,
          description,
          discount_type: settings.reward_discount_type === "fixed" ? "fixed" : "percentage",
          discount_value: settings.reward_discount_value,
          max_uses: 1,
          current_uses: 0,
          valid_from: new Date().toISOString(),
          valid_until: validUntil,
          is_active: true,
          discount_target: target,
          applicable_service_ids: applicableServices,
          applicable_product_ids: applicableProducts,
          calculate_commission_after_discount: !!settings.reward_deduct_from_commission,
        })
        .select("id, code, description")
        .single();

      if (!cErr && newCoupon) {
        await admin
          .from("tab_reviews")
          .update({ reward_coupon_id: newCoupon.id })
          .eq("id", review.id);
        coupon = { code: newCoupon.code, description: newCoupon.description };

        // Notify client about coupon
        await admin.from("notifications").insert({
          recipient_type: "client",
          recipient_id: client_id,
          sender_type: "establishment",
          sender_id: review.establishment_id,
          title: "Seu cupom de recompensa chegou! 🎁",
          body: `Use o código ${newCoupon.code} na sua próxima visita. ${description}`,
          data: { category: "review_reward", coupon_code: newCoupon.code },
        });
      }
    }

    if (body.rating === 5 && settings?.google_business_url) {
      google_url = settings.google_business_url;
    }

    return json({ success: true, coupon, google_url });
  } catch (e: any) {
    return json({ error: e?.message ?? "internal_error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

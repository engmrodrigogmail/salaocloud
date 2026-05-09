// Edge function: client-review-get
// Returns a tab_review (and contextual data) for the authenticated client.
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractSessionToken, resolveClientFromSession } from "../_shared/client-session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-session",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = extractSessionToken(req);
    const client_id = await resolveClientFromSession(token);
    if (!client_id) return json({ error: "unauthorized" }, 401);

    const { review_id } = await req.json().catch(() => ({}));
    if (!review_id) return json({ error: "missing_review_id" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: review, error } = await admin
      .from("tab_reviews")
      .select("id, establishment_id, tab_id, client_id, status, client_rating, client_comment, client_submitted_at")
      .eq("id", review_id)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!review) return json({ error: "not_found" }, 404);
    if (review.client_id !== client_id) return json({ error: "forbidden" }, 403);

    const [{ data: est }, { data: settings }, { data: items }, { data: rps }] = await Promise.all([
      admin.from("establishments").select("id, name, slug, logo_url, brand_primary_color").eq("id", review.establishment_id).maybeSingle(),
      admin.from("review_settings").select("*").eq("establishment_id", review.establishment_id).maybeSingle(),
      admin.from("tab_items").select("id, item_name, professional_id, total_price").eq("tab_id", review.tab_id),
      admin.from("tab_review_professionals").select("id, professional_id, rating, comment").eq("tab_review_id", review.id),
    ]);

    // Distinct professionals from review_professionals (pre-populated by trigger)
    const profIds = Array.from(new Set((rps ?? []).map((r) => r.professional_id)));
    const { data: profs } = profIds.length
      ? await admin.from("professionals").select("id, name, photo_url").in("id", profIds)
      : { data: [] as any[] };

    return json({
      review,
      establishment: est,
      settings,
      items: items ?? [],
      professionals: (rps ?? []).map((r) => ({
        ...r,
        professional: profs?.find((p) => p.id === r.professional_id) ?? null,
      })),
    });
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

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { priceId, planSlug, couponCode, billingCycle, successUrl, cancelUrl, establishmentId } = await req.json();
    logStep("Request body", { priceId, planSlug, couponCode, billingCycle, successUrl, cancelUrl, establishmentId });

    if (!priceId) throw new Error("Price ID is required");

    // === TRIAL COUPON PATH ===
    // If coupon grants trial days AND 100% off, skip Stripe and activate trial directly.
    if (couponCode && establishmentId) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );
      const { data: pc } = await supabaseAdmin
        .from("platform_coupons")
        .select("*")
        .eq("code", couponCode.toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (pc && pc.grants_trial_days && Number(pc.grants_trial_days) > 0 &&
          pc.discount_type === "percentage" && Number(pc.discount_value) >= 100) {
        // Validate window
        const now = new Date();
        if (pc.valid_from && new Date(pc.valid_from) > now) {
          throw new Error("Cupom ainda não está vigente");
        }
        if (pc.valid_until && new Date(pc.valid_until) < now) {
          throw new Error("Cupom expirado");
        }
        // Block duplicate redemption by same owner (any establishment they own)
        const { data: ownedEsts } = await supabaseAdmin
          .from("establishments")
          .select("id")
          .eq("owner_id", user.id);
        const ownedIds = (ownedEsts ?? []).map((e: any) => e.id);
        if (ownedIds.length > 0) {
          const { data: prev } = await supabaseAdmin
            .from("platform_coupon_redemptions")
            .select("id")
            .eq("coupon_id", pc.id)
            .in("establishment_id", ownedIds)
            .limit(1);
          if (prev && prev.length > 0) {
            throw new Error("Este cupom já foi utilizado por este proprietário");
          }
        }

        const trialEnds = new Date(now.getTime() + Number(pc.grants_trial_days) * 24 * 60 * 60 * 1000);
        const { error: updErr } = await supabaseAdmin
          .from("establishments")
          .update({
            status: "active",
            subscription_plan: "trial",
            trial_ends_at: trialEnds.toISOString(),
            trial_coupon_id: pc.id,
            trial_features_allowed: pc.feature_mode ?? "all",
          })
          .eq("id", establishmentId)
          .eq("owner_id", user.id);
        if (updErr) throw new Error(`Falha ao ativar trial: ${updErr.message}`);

        await supabaseAdmin.from("platform_coupon_redemptions").insert({
          coupon_id: pc.id,
          establishment_id: establishmentId,
          applied_to_plan: planSlug ?? null,
          discount_amount: null,
          is_active: true,
        });
        await supabaseAdmin
          .from("platform_coupons")
          .update({ current_redemptions: (pc.current_redemptions ?? 0) + 1 })
          .eq("id", pc.id);

        logStep("Trial activated via coupon", { establishmentId, trialEnds });

        const originHdr = req.headers.get("origin") || "https://preview.lovable.dev";
        const redirect = successUrl || `${originHdr}/dashboard?trial=1`;
        return new Response(JSON.stringify({ url: redirect, trial: true, trial_ends_at: trialEnds.toISOString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }


    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    // Check if customer exists (filter by app=salaocloud metadata)
    const customers = await stripe.customers.list({ email: user.email, limit: 10 });
    const scCustomers = customers.data.filter((c: any) => c.metadata?.app === "salaocloud");
    let customerId: string | undefined;
    if (scCustomers.length > 0) {
      customerId = scCustomers[0].id;
      logStep("Found existing salaocloud customer", { customerId });
    } else {
      // Create a new customer tagged with app=salaocloud
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { app: "salaocloud", user_id: user.id },
      });
      customerId = newCustomer.id;
      logStep("Created new salaocloud customer", { customerId });
    }

    // Apply coupon if provided
    let discounts: any[] = [];
    if (couponCode) {
      try {
        // Check if coupon exists in Stripe, if not create it
        const stripeCoupons = await stripe.coupons.list({ limit: 100 });
        let stripeCoupon = stripeCoupons.data.find((c: any) => c.name === couponCode);
        
        if (!stripeCoupon) {
          // Get coupon from database to create in Stripe
          const { data: platformCoupon } = await supabaseClient
            .from("platform_coupons")
            .select("*")
            .eq("code", couponCode)
            .eq("is_active", true)
            .single();
          
          if (platformCoupon) {
            if (platformCoupon.discount_type === "percentage") {
              stripeCoupon = await stripe.coupons.create({
                name: couponCode,
                percent_off: platformCoupon.discount_value,
                duration: "once",
              });
            } else {
              stripeCoupon = await stripe.coupons.create({
                name: couponCode,
                amount_off: Math.round(platformCoupon.discount_value * 100), // Convert to cents
                currency: "brl",
                duration: "once",
              });
            }
            logStep("Created Stripe coupon", { couponId: stripeCoupon.id });
          }
        }
        
        if (stripeCoupon) {
          discounts = [{ coupon: stripeCoupon.id }];
          logStep("Applied coupon", { couponId: stripeCoupon.id });
        }
      } catch (couponError) {
        logStep("Coupon error (continuing without discount)", { error: String(couponError) });
      }
    }

    const origin = req.headers.get("origin") || "https://preview.lovable.dev";
    
    const sessionConfig: any = {
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: successUrl || `${origin}/dashboard?subscription=success`,
      cancel_url: cancelUrl || `${origin}/onboarding?subscription=cancelled`,
      subscription_data: {
        metadata: {
          app: "salaocloud",
          user_id: user.id,
          plan_slug: planSlug ?? "",
          billing_cycle: billingCycle ?? "monthly",
        },
      },
      metadata: {
        app: "salaocloud",
        user_id: user.id,
        plan_slug: planSlug ?? "",
        billing_cycle: billingCycle ?? "monthly",
      },
    };

    if (discounts.length > 0) {
      sessionConfig.discounts = discounts;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

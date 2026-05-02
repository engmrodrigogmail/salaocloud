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

    const { priceId, planSlug, couponCode, billingCycle } = await req.json();
    logStep("Request body", { priceId, planSlug, couponCode, billingCycle });

    if (!priceId) throw new Error("Price ID is required");

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
      success_url: `${origin}/dashboard?subscription=success`,
      cancel_url: `${origin}/onboarding?subscription=cancelled`,
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

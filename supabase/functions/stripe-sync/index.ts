import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-SYNC] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const { action, plans } = await req.json();

    switch (action) {
      case "export_to_stripe": {
        logStep("Exporting plans to Stripe", { count: plans?.length });
        const results = [];

        for (const plan of plans) {
          try {
            // Check if product already exists
            let product;
            if (plan.stripe_product_id) {
              product = await stripe.products.retrieve(plan.stripe_product_id);
              // Update existing product
              product = await stripe.products.update(plan.stripe_product_id, {
                name: plan.name,
                description: plan.description || undefined,
                metadata: {
                  portal_plan_id: plan.id,
                  slug: plan.slug,
                },
              });
              logStep("Updated existing product", { id: product.id });
            } else {
              // Create new product
              product = await stripe.products.create({
                name: plan.name,
                description: plan.description || undefined,
                metadata: {
                  portal_plan_id: plan.id,
                  slug: plan.slug,
                },
              });
              logStep("Created new product", { id: product.id });
            }

            // Handle monthly price - check if price needs to be updated
            let monthlyPriceId = plan.stripe_price_id_monthly;
            const expectedMonthlyAmount = Math.round(plan.price_monthly * 100);
            
            if (monthlyPriceId && plan.price_monthly > 0) {
              // Check if existing price matches the expected amount
              try {
                const existingPrice = await stripe.prices.retrieve(monthlyPriceId);
                if (existingPrice.unit_amount !== expectedMonthlyAmount) {
                  logStep("Price mismatch detected, creating new price", { 
                    existing: existingPrice.unit_amount, 
                    expected: expectedMonthlyAmount 
                  });
                  // Archive the old price
                  await stripe.prices.update(monthlyPriceId, { active: false });
                  logStep("Archived old monthly price", { id: monthlyPriceId });
                  // Create new price with correct amount
                  const newMonthlyPrice = await stripe.prices.create({
                    product: product.id,
                    unit_amount: expectedMonthlyAmount,
                    currency: "brl",
                    recurring: { interval: "month" },
                    metadata: { type: "monthly" },
                  });
                  monthlyPriceId = newMonthlyPrice.id;
                  logStep("Created new monthly price", { id: monthlyPriceId, amount: expectedMonthlyAmount });
                }
              } catch (priceError) {
                logStep("Error checking existing price, creating new one", { error: priceError instanceof Error ? priceError.message : String(priceError) });
                // Price doesn't exist or error, create new one
                const newMonthlyPrice = await stripe.prices.create({
                  product: product.id,
                  unit_amount: expectedMonthlyAmount,
                  currency: "brl",
                  recurring: { interval: "month" },
                  metadata: { type: "monthly" },
                });
                monthlyPriceId = newMonthlyPrice.id;
                logStep("Created monthly price after error", { id: monthlyPriceId });
              }
            } else if (!monthlyPriceId && plan.price_monthly > 0) {
              // No existing price, create new one
              const monthlyPrice = await stripe.prices.create({
                product: product.id,
                unit_amount: expectedMonthlyAmount,
                currency: "brl",
                recurring: { interval: "month" },
                metadata: { type: "monthly" },
              });
              monthlyPriceId = monthlyPrice.id;
              logStep("Created monthly price", { id: monthlyPriceId });
            }

            // Handle yearly price - check if price needs to be updated
            let yearlyPriceId = plan.stripe_price_id_yearly;
            if (plan.price_yearly && plan.price_yearly > 0) {
              const expectedYearlyAmount = Math.round(plan.price_yearly * 100);
              
              if (yearlyPriceId) {
                try {
                  const existingYearlyPrice = await stripe.prices.retrieve(yearlyPriceId);
                  if (existingYearlyPrice.unit_amount !== expectedYearlyAmount) {
                    logStep("Yearly price mismatch detected, creating new price", { 
                      existing: existingYearlyPrice.unit_amount, 
                      expected: expectedYearlyAmount 
                    });
                    // Archive the old price
                    await stripe.prices.update(yearlyPriceId, { active: false });
                    logStep("Archived old yearly price", { id: yearlyPriceId });
                    // Create new price
                    const newYearlyPrice = await stripe.prices.create({
                      product: product.id,
                      unit_amount: expectedYearlyAmount,
                      currency: "brl",
                      recurring: { interval: "year" },
                      metadata: { type: "yearly" },
                    });
                    yearlyPriceId = newYearlyPrice.id;
                    logStep("Created new yearly price", { id: yearlyPriceId, amount: expectedYearlyAmount });
                  }
                } catch (priceError) {
                  // Create new yearly price
                  const newYearlyPrice = await stripe.prices.create({
                    product: product.id,
                    unit_amount: expectedYearlyAmount,
                    currency: "brl",
                    recurring: { interval: "year" },
                    metadata: { type: "yearly" },
                  });
                  yearlyPriceId = newYearlyPrice.id;
                  logStep("Created yearly price after error", { id: yearlyPriceId });
                }
              } else {
                // No existing yearly price, create new one
                const yearlyPrice = await stripe.prices.create({
                  product: product.id,
                  unit_amount: expectedYearlyAmount,
                  currency: "brl",
                  recurring: { interval: "year" },
                  metadata: { type: "yearly" },
                });
                yearlyPriceId = yearlyPrice.id;
                logStep("Created yearly price", { id: yearlyPriceId });
              }
            }

            // Update portal database with Stripe IDs
            const { error: updateError } = await supabaseClient
              .from("subscription_plans")
              .update({
                stripe_product_id: product.id,
                stripe_price_id_monthly: monthlyPriceId,
                stripe_price_id_yearly: yearlyPriceId,
                updated_at: new Date().toISOString(),
              })
              .eq("id", plan.id);

            if (updateError) {
              logStep("Error updating portal plan", { error: updateError.message });
            }

            results.push({
              plan_id: plan.id,
              product_id: product.id,
              monthly_price_id: monthlyPriceId,
              yearly_price_id: yearlyPriceId,
              success: true,
            });
          } catch (error) {
            logStep("Error exporting plan", { plan_id: plan.id, error: error instanceof Error ? error.message : String(error) });
            results.push({
              plan_id: plan.id,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return new Response(JSON.stringify({ results, timestamp: new Date().toISOString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "import_from_stripe": {
        logStep("Importing plans from Stripe", { count: plans?.length });
        const results = [];

        for (const stripePlan of plans) {
          try {
            // Find monthly and yearly prices
            const monthlyPrice = stripePlan.prices?.find(
              (p: { recurring?: { interval: string } }) => p.recurring?.interval === "month"
            );
            const yearlyPrice = stripePlan.prices?.find(
              (p: { recurring?: { interval: string } }) => p.recurring?.interval === "year"
            );

            // Check if plan already exists in portal
            const { data: existingPlan } = await supabaseClient
              .from("subscription_plans")
              .select("id")
              .eq("stripe_product_id", stripePlan.id)
              .single();

            const planData = {
              name: stripePlan.name,
              description: stripePlan.description || null,
              slug: stripePlan.metadata?.slug || stripePlan.name.toLowerCase().replace(/\s+/g, "-"),
              price_monthly: monthlyPrice ? monthlyPrice.unit_amount / 100 : 0,
              price_yearly: yearlyPrice ? yearlyPrice.unit_amount / 100 : null,
              stripe_product_id: stripePlan.id,
              stripe_price_id_monthly: monthlyPrice?.id || null,
              stripe_price_id_yearly: yearlyPrice?.id || null,
              is_active: stripePlan.active,
              features: [],
              updated_at: new Date().toISOString(),
            };

            if (existingPlan) {
              const { error } = await supabaseClient
                .from("subscription_plans")
                .update(planData)
                .eq("id", existingPlan.id);

              if (error) throw error;
              results.push({ stripe_id: stripePlan.id, portal_id: existingPlan.id, action: "updated", success: true });
              logStep("Updated existing portal plan", { id: existingPlan.id });
            } else {
              const { data: newPlan, error } = await supabaseClient
                .from("subscription_plans")
                .insert(planData)
                .select("id")
                .single();

              if (error) throw error;
              results.push({ stripe_id: stripePlan.id, portal_id: newPlan?.id, action: "created", success: true });
              logStep("Created new portal plan", { id: newPlan?.id });
            }
          } catch (error) {
            logStep("Error importing plan", { stripe_id: stripePlan.id, error: error instanceof Error ? error.message : String(error) });
            results.push({
              stripe_id: stripePlan.id,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return new Response(JSON.stringify({ results, timestamp: new Date().toISOString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check_sync_status": {
        logStep("Checking sync status");
        
        // Get portal plans
        const { data: portalPlans } = await supabaseClient
          .from("subscription_plans")
          .select("id, name, stripe_product_id, stripe_price_id_monthly, price_monthly, updated_at");
        
        // Get Stripe products
        const products = await stripe.products.list({ limit: 100, active: true });
        const prices = await stripe.prices.list({ limit: 100, active: true });
        
        const syncStatus = {
          portalPlansCount: portalPlans?.length || 0,
          stripeProductsCount: products.data.length,
          linkedPlans: portalPlans?.filter(p => p.stripe_product_id).length || 0,
          unlinkedPortalPlans: portalPlans?.filter(p => !p.stripe_product_id).length || 0,
          isSynced: false,
          lastUpdate: null as string | null,
          details: [] as Array<{
            name: string;
            hasStripeProduct: boolean;
            hasStripePrice: boolean;
            priceMatch: boolean;
          }>,
        };
        
        // Check each portal plan
        for (const plan of portalPlans || []) {
          const stripeProduct = products.data.find((p: Stripe.Product) => p.id === plan.stripe_product_id);
          const stripePrice = prices.data.find((p: Stripe.Price) => p.id === plan.stripe_price_id_monthly);
          const priceMatch = stripePrice 
            ? Math.abs((stripePrice.unit_amount || 0) / 100 - plan.price_monthly) < 0.01
            : false;
          
          syncStatus.details.push({
            name: plan.name,
            hasStripeProduct: !!stripeProduct,
            hasStripePrice: !!stripePrice,
            priceMatch,
          });
        }
        
        // Find the most recent update
        if (portalPlans && portalPlans.length > 0) {
          const dates = portalPlans.map(p => new Date(p.updated_at).getTime());
          syncStatus.lastUpdate = new Date(Math.max(...dates)).toISOString();
        }
        
        // Check if all plans are synced
        syncStatus.isSynced = syncStatus.details.every(d => 
          d.hasStripeProduct && d.hasStripePrice && d.priceMatch
        );
        
        return new Response(JSON.stringify(syncStatus), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

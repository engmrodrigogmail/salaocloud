import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AnyRecord = Record<string, unknown>;

const safeJson = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
};

const log = (requestId: string, step: string, details?: AnyRecord) => {
  const detailsStr = details ? ` ${safeJson(details)}` : "";
  console.log(`[STRIPE-SYNC][${requestId}] ${step}${detailsStr}`);
};

const toCents = (value: unknown) => {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serverRequestId = crypto.randomUUID();

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let body: AnyRecord = {};
    try {
      body = (await req.json()) as AnyRecord;
    } catch (e) {
      throw new Error(`Invalid JSON body: ${e instanceof Error ? e.message : String(e)}`);
    }

    const requestId = (typeof body.client_request_id === "string" && body.client_request_id.trim())
      ? body.client_request_id
      : serverRequestId;

    const action = body.action as string | undefined;
    const plans = body.plans as unknown[] | undefined;

    log(requestId, "Request received", {
      method: req.method,
      action,
      plansCount: Array.isArray(plans) ? plans.length : 0,
    });

    if (!action) throw new Error("Missing 'action' in request body");

    switch (action) {
      case "export_to_stripe": {
        log(requestId, "Exporting plans to Stripe", { count: Array.isArray(plans) ? plans.length : 0 });
        const results: AnyRecord[] = [];

        for (const rawPlan of plans || []) {
          const plan = rawPlan as AnyRecord;

          const planId = String(plan.id ?? "");
          const planName = String(plan.name ?? "");

          try {
            log(requestId, "Plan: start", {
              planId,
              planName,
              stripe_product_id: plan.stripe_product_id,
              stripe_price_id_monthly: plan.stripe_price_id_monthly,
              stripe_price_id_yearly: plan.stripe_price_id_yearly,
              price_monthly: plan.price_monthly,
              price_yearly: plan.price_yearly,
            });

            // 1) Product
            let product: Stripe.Product;
            if (plan.stripe_product_id) {
              product = await stripe.products.update(String(plan.stripe_product_id), {
                name: planName,
                description: (plan.description as string) || undefined,
                metadata: {
                  portal_plan_id: planId,
                  slug: String(plan.slug ?? ""),
                },
              });
              log(requestId, "Plan: product updated", { planId, productId: product.id });
            } else {
              product = await stripe.products.create({
                name: planName,
                description: (plan.description as string) || undefined,
                metadata: {
                  portal_plan_id: planId,
                  slug: String(plan.slug ?? ""),
                },
              });
              log(requestId, "Plan: product created", { planId, productId: product.id });
            }

            // 2) Monthly price
            let monthlyPriceId = (plan.stripe_price_id_monthly ? String(plan.stripe_price_id_monthly) : null);
            const expectedMonthlyAmount = toCents(plan.price_monthly);

            if (expectedMonthlyAmount && expectedMonthlyAmount > 0) {
              if (monthlyPriceId) {
                try {
                  const existingPrice = await stripe.prices.retrieve(monthlyPriceId);
                  log(requestId, "Plan: monthly price retrieved", {
                    planId,
                    monthlyPriceId,
                    active: existingPrice.active,
                    unit_amount: existingPrice.unit_amount,
                    expected: expectedMonthlyAmount,
                    currency: existingPrice.currency,
                    product: existingPrice.product,
                  });

                  if (existingPrice.unit_amount !== expectedMonthlyAmount) {
                    log(requestId, "Plan: monthly price mismatch -> rotate", {
                      planId,
                      existing: existingPrice.unit_amount,
                      expected: expectedMonthlyAmount,
                    });

                    // Archive old price
                    await stripe.prices.update(monthlyPriceId, { active: false });
                    log(requestId, "Plan: monthly price archived", { planId, oldMonthlyPriceId: monthlyPriceId });

                    // Create new price
                    const newMonthlyPrice = await stripe.prices.create({
                      product: product.id,
                      unit_amount: expectedMonthlyAmount,
                      currency: "brl",
                      recurring: { interval: "month" },
                      metadata: { type: "monthly" },
                    });
                    monthlyPriceId = newMonthlyPrice.id;
                    log(requestId, "Plan: monthly price created", {
                      planId,
                      newMonthlyPriceId: monthlyPriceId,
                      amount: expectedMonthlyAmount,
                    });
                  }
                } catch (priceError) {
                  log(requestId, "Plan: error retrieving monthly price -> create new", {
                    planId,
                    monthlyPriceId,
                    error: priceError instanceof Error ? priceError.message : String(priceError),
                  });

                  const newMonthlyPrice = await stripe.prices.create({
                    product: product.id,
                    unit_amount: expectedMonthlyAmount,
                    currency: "brl",
                    recurring: { interval: "month" },
                    metadata: { type: "monthly" },
                  });
                  monthlyPriceId = newMonthlyPrice.id;
                  log(requestId, "Plan: monthly price created after error", { planId, newMonthlyPriceId: monthlyPriceId });
                }
              } else {
                const monthlyPrice = await stripe.prices.create({
                  product: product.id,
                  unit_amount: expectedMonthlyAmount,
                  currency: "brl",
                  recurring: { interval: "month" },
                  metadata: { type: "monthly" },
                });
                monthlyPriceId = monthlyPrice.id;
                log(requestId, "Plan: monthly price created (missing)", { planId, monthlyPriceId, amount: expectedMonthlyAmount });
              }
            } else {
              log(requestId, "Plan: monthly price skipped (invalid/zero)", { planId, price_monthly: plan.price_monthly });
            }

            // 3) Yearly price
            let yearlyPriceId = (plan.stripe_price_id_yearly ? String(plan.stripe_price_id_yearly) : null);
            const expectedYearlyAmount = toCents(plan.price_yearly);

            if (expectedYearlyAmount && expectedYearlyAmount > 0) {
              if (yearlyPriceId) {
                try {
                  const existingYearlyPrice = await stripe.prices.retrieve(yearlyPriceId);
                  log(requestId, "Plan: yearly price retrieved", {
                    planId,
                    yearlyPriceId,
                    active: existingYearlyPrice.active,
                    unit_amount: existingYearlyPrice.unit_amount,
                    expected: expectedYearlyAmount,
                    currency: existingYearlyPrice.currency,
                    product: existingYearlyPrice.product,
                  });

                  if (existingYearlyPrice.unit_amount !== expectedYearlyAmount) {
                    log(requestId, "Plan: yearly price mismatch -> rotate", {
                      planId,
                      existing: existingYearlyPrice.unit_amount,
                      expected: expectedYearlyAmount,
                    });

                    await stripe.prices.update(yearlyPriceId, { active: false });
                    log(requestId, "Plan: yearly price archived", { planId, oldYearlyPriceId: yearlyPriceId });

                    const newYearlyPrice = await stripe.prices.create({
                      product: product.id,
                      unit_amount: expectedYearlyAmount,
                      currency: "brl",
                      recurring: { interval: "year" },
                      metadata: { type: "yearly" },
                    });
                    yearlyPriceId = newYearlyPrice.id;
                    log(requestId, "Plan: yearly price created", { planId, newYearlyPriceId: yearlyPriceId, amount: expectedYearlyAmount });
                  }
                } catch (priceError) {
                  log(requestId, "Plan: error retrieving yearly price -> create new", {
                    planId,
                    yearlyPriceId,
                    error: priceError instanceof Error ? priceError.message : String(priceError),
                  });

                  const newYearlyPrice = await stripe.prices.create({
                    product: product.id,
                    unit_amount: expectedYearlyAmount,
                    currency: "brl",
                    recurring: { interval: "year" },
                    metadata: { type: "yearly" },
                  });
                  yearlyPriceId = newYearlyPrice.id;
                  log(requestId, "Plan: yearly price created after error", { planId, newYearlyPriceId: yearlyPriceId });
                }
              } else {
                const yearlyPrice = await stripe.prices.create({
                  product: product.id,
                  unit_amount: expectedYearlyAmount,
                  currency: "brl",
                  recurring: { interval: "year" },
                  metadata: { type: "yearly" },
                });
                yearlyPriceId = yearlyPrice.id;
                log(requestId, "Plan: yearly price created (missing)", { planId, yearlyPriceId, amount: expectedYearlyAmount });
              }
            } else {
              // leave as-is if null/0
              log(requestId, "Plan: yearly price skipped (null/zero)", { planId, price_yearly: plan.price_yearly });
            }

            // 4) Update portal DB with Stripe IDs
            const updatePayload = {
              stripe_product_id: product.id,
              stripe_price_id_monthly: monthlyPriceId,
              stripe_price_id_yearly: yearlyPriceId,
              updated_at: new Date().toISOString(),
            };

            log(requestId, "Plan: updating portal record", { planId, updatePayload });

            const { data: updated, error: updateError } = await supabaseClient
              .from("subscription_plans")
              .update(updatePayload)
              .eq("id", planId)
              .select("id, stripe_product_id, stripe_price_id_monthly, stripe_price_id_yearly, price_monthly, price_yearly, updated_at")
              .maybeSingle();

            if (updateError) {
              log(requestId, "Plan: portal update ERROR", { planId, error: updateError.message });
              throw updateError;
            }

            log(requestId, "Plan: portal updated OK", { planId, updated });

            results.push({
              plan_id: planId,
              product_id: product.id,
              monthly_price_id: monthlyPriceId,
              yearly_price_id: yearlyPriceId,
              success: true,
            });
          } catch (error) {
            log(requestId, "Plan: export ERROR", {
              plan_id: planId,
              error: error instanceof Error ? error.message : String(error),
            });

            results.push({
              plan_id: planId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return new Response(
          JSON.stringify({ request_id: requestId, results, timestamp: new Date().toISOString() }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "import_from_stripe": {
        log(requestId, "Importing plans from Stripe", { count: Array.isArray(plans) ? plans.length : 0 });
        const results: AnyRecord[] = [];

        for (const stripePlanRaw of plans || []) {
          const stripePlan = stripePlanRaw as AnyRecord;
          const stripeId = String(stripePlan.id ?? "");

          try {
            const monthlyPrice = (stripePlan.prices as AnyRecord[] | undefined)?.find(
              (p) => (p.recurring as AnyRecord | undefined)?.interval === "month"
            );
            const yearlyPrice = (stripePlan.prices as AnyRecord[] | undefined)?.find(
              (p) => (p.recurring as AnyRecord | undefined)?.interval === "year"
            );

            const { data: existingPlan, error: findError } = await supabaseClient
              .from("subscription_plans")
              .select("id")
              .eq("stripe_product_id", stripeId)
              .maybeSingle();

            if (findError) throw findError;

            const planData = {
              name: String(stripePlan.name ?? ""),
              description: (stripePlan.description as string) || null,
              slug: String((stripePlan.metadata as AnyRecord | undefined)?.slug ?? "") ||
                String(stripePlan.name ?? "").toLowerCase().replace(/\s+/g, "-"),
              price_monthly: monthlyPrice && typeof monthlyPrice.unit_amount === "number" ? monthlyPrice.unit_amount / 100 : 0,
              price_yearly: yearlyPrice && typeof yearlyPrice.unit_amount === "number" ? yearlyPrice.unit_amount / 100 : null,
              stripe_product_id: stripeId,
              stripe_price_id_monthly: (monthlyPrice?.id as string) || null,
              stripe_price_id_yearly: (yearlyPrice?.id as string) || null,
              is_active: Boolean(stripePlan.active),
              features: [],
              updated_at: new Date().toISOString(),
            };

            if (existingPlan?.id) {
              const { error } = await supabaseClient
                .from("subscription_plans")
                .update(planData)
                .eq("id", existingPlan.id);

              if (error) throw error;
              results.push({ stripe_id: stripeId, portal_id: existingPlan.id, action: "updated", success: true });
              log(requestId, "Import: updated portal plan", { portalId: existingPlan.id, stripeId });
            } else {
              const { data: newPlan, error } = await supabaseClient
                .from("subscription_plans")
                .insert(planData)
                .select("id")
                .single();

              if (error) throw error;
              results.push({ stripe_id: stripeId, portal_id: newPlan?.id, action: "created", success: true });
              log(requestId, "Import: created portal plan", { portalId: newPlan?.id, stripeId });
            }
          } catch (error) {
            log(requestId, "Import: ERROR", { stripe_id: stripeId, error: error instanceof Error ? error.message : String(error) });
            results.push({ stripe_id: stripeId, success: false, error: error instanceof Error ? error.message : String(error) });
          }
        }

        return new Response(
          JSON.stringify({ request_id: requestId, results, timestamp: new Date().toISOString() }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "check_sync_status": {
        log(requestId, "Checking sync status");

        // Get portal plans
        const { data: portalPlans, error: portalError } = await supabaseClient
          .from("subscription_plans")
          .select("id, name, stripe_product_id, stripe_price_id_monthly, stripe_price_id_yearly, price_monthly, price_yearly, updated_at");

        if (portalError) throw portalError;

        const syncStatus = {
          portalPlansCount: portalPlans?.length || 0,
          stripeProductsCount: 0,
          linkedPlans: portalPlans?.filter((p) => p.stripe_product_id).length || 0,
          unlinkedPortalPlans: portalPlans?.filter((p) => !p.stripe_product_id).length || 0,
          isSynced: false,
          lastUpdate: null as string | null,
          details: [] as Array<{
            name: string;
            hasStripeProduct: boolean;
            hasStripePrice: boolean;
            priceMatch: boolean;
          }>,
        };

        let stripeProductsResolved = 0;

        for (const plan of portalPlans || []) {
          let hasStripeProduct = false;
          let hasStripePrice = false;
          let priceMatch = false;

          let stripeProductActive: boolean | null = null;
          let stripeMonthlyUnitAmount: number | null = null;
          let stripeMonthlyActive: boolean | null = null;

          // Product check (retrieve by id to avoid list limits)
          if (plan.stripe_product_id) {
            try {
              const product = await stripe.products.retrieve(plan.stripe_product_id);
              hasStripeProduct = Boolean(product?.id) && Boolean(product.active);
              stripeProductActive = Boolean(product.active);
              stripeProductsResolved += 1;
            } catch (e) {
              log(requestId, "Status: product retrieve failed", {
                planId: plan.id,
                productId: plan.stripe_product_id,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          // Monthly price check (retrieve by id; require active)
          if (plan.stripe_price_id_monthly) {
            try {
              const price = await stripe.prices.retrieve(plan.stripe_price_id_monthly);
              stripeMonthlyUnitAmount = price.unit_amount;
              stripeMonthlyActive = Boolean(price.active);
              hasStripePrice = Boolean(price.active);
              const portalMonthly = typeof plan.price_monthly === "number" ? plan.price_monthly : Number(plan.price_monthly);
              if (typeof price.unit_amount === "number" && Number.isFinite(portalMonthly)) {
                priceMatch = Math.abs(price.unit_amount / 100 - portalMonthly) < 0.01;
              }
            } catch (e) {
              log(requestId, "Status: price retrieve failed", {
                planId: plan.id,
                priceId: plan.stripe_price_id_monthly,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          log(requestId, "Status: plan evaluated", {
            planId: plan.id,
            name: plan.name,
            portalPriceMonthly: plan.price_monthly,
            stripeMonthlyUnitAmount,
            stripeMonthlyActive,
            stripeProductActive,
            hasStripeProduct,
            hasStripePrice,
            priceMatch,
            stripe_product_id: plan.stripe_product_id,
            stripe_price_id_monthly: plan.stripe_price_id_monthly,
          });

          syncStatus.details.push({
            name: plan.name,
            hasStripeProduct,
            hasStripePrice,
            priceMatch,
          });
        }

        syncStatus.stripeProductsCount = stripeProductsResolved;

        if (portalPlans && portalPlans.length > 0) {
          const dates = portalPlans.map((p) => new Date(p.updated_at).getTime());
          syncStatus.lastUpdate = new Date(Math.max(...dates)).toISOString();
        }

        syncStatus.isSynced = syncStatus.details.every((d) => d.hasStripeProduct && d.hasStripePrice && d.priceMatch);

        log(requestId, "Status: summary", syncStatus as unknown as AnyRecord);

        return new Response(JSON.stringify({ request_id: requestId, ...syncStatus }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`[STRIPE-SYNC][${serverRequestId}] ERROR ${safeJson({ message: errorMessage })}`);

    return new Response(JSON.stringify({ request_id: serverRequestId, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

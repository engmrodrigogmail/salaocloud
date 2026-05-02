import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK][${timestamp}] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    // deno-lint-ignore no-explicit-any
    const supabaseClient: SupabaseClient<any> = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    
    let event: Stripe.Event;
    
    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified", { eventType: event.type });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        logStep("Webhook signature verification failed", { error: errorMessage });
        return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${errorMessage}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    } else {
      // If no webhook secret, parse the event directly (less secure, for development)
      event = JSON.parse(body) as Stripe.Event;
      logStep("Webhook received without signature verification", { eventType: event.type });
    }

    // Log the event for tracking
    await logWebhookEvent(supabaseClient, event);

    // Handle different event types
    switch (event.type) {
      // Subscription events
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
      case "customer.subscription.pending_update_applied":
      case "customer.subscription.pending_update_expired":
      case "customer.subscription.trial_will_end": {
        await handleSubscriptionEvent(supabaseClient, stripe, event);
        break;
      }

      // Customer events
      case "customer.created":
      case "customer.updated":
      case "customer.deleted": {
        await handleCustomerEvent(supabaseClient, event);
        break;
      }

      // Invoice events
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.payment_action_required":
      case "invoice.upcoming":
      case "invoice.finalized": {
        await handleInvoiceEvent(supabaseClient, event);
        break;
      }

      // Product and Price events
      case "product.created":
      case "product.updated":
      case "product.deleted":
      case "price.created":
      case "price.updated":
      case "price.deleted": {
        await handleProductPriceEvent(supabaseClient, stripe, event);
        break;
      }

      // Checkout session events
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed": {
        await handleCheckoutEvent(supabaseClient, stripe, event);
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true, type: event.type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR processing webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Log webhook events to database for tracking
// deno-lint-ignore no-explicit-any
async function logWebhookEvent(supabase: SupabaseClient<any>, event: Stripe.Event) {
  try {
    // Try to store webhook event - table might not exist
    await supabase.from("webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
      payload: event.data.object,
      created_at: new Date(event.created * 1000).toISOString(),
    });
  } catch (err) {
    // Table might not exist, log but don't fail
    logStep("Could not log webhook event to database", { 
      reason: err instanceof Error ? err.message : "Unknown" 
    });
  }
}

// Handle subscription lifecycle events
// deno-lint-ignore no-explicit-any
async function handleSubscriptionEvent(supabase: SupabaseClient<any>, stripe: Stripe, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  logStep("Processing subscription event", { 
    type: event.type, 
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
  });

  try {
    // Get customer email
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      logStep("Customer was deleted", { customerId });
      return;
    }

    // Filter: only process subscriptions belonging to salaocloud
    const subAppMeta = (subscription.metadata as Record<string, string> | null)?.app;
    const custAppMeta = (customer as Stripe.Customer).metadata?.app;
    if (subAppMeta !== "salaocloud" && custAppMeta !== "salaocloud") {
      logStep("Skipping subscription event (not salaocloud)", { customerId, subAppMeta, custAppMeta });
      return;
    }

    const email = customer.email;
    if (!email) {
      logStep("Customer has no email", { customerId });
      return;
    }

    // Find establishment by stripe_customer_id
    const { data: establishment, error: estError } = await supabase
      .from("establishments")
      .select("id, owner_id, subscription_plan, status")
      .eq("stripe_customer_id", customerId)
      .single();

    if (estError || !establishment) {
      logStep("No establishment found for customer", { customerId, email });
      return;
    }

    // Determine the new plan based on subscription status
    let newPlan: string = "pro";
    let newStatus: string = establishment.status;

    if (subscription.status === "active" || subscription.status === "trialing") {
      newStatus = "active";
      
      // Get the price ID and determine the plan
      const priceId = subscription.items.data[0]?.price?.id;
      if (priceId) {
        const { data: planData } = await supabase
          .from("subscription_plans")
          .select("slug")
          .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
          .single();

        if (planData) {
          newPlan = planData.slug;
        }
      }
    } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
      newPlan = "pro";
      newStatus = "active"; // Keep active but downgrade to basic
    } else if (subscription.status === "past_due") {
      newStatus = "suspended";
    }

    // Update establishment
    const { error: updateError } = await supabase
      .from("establishments")
      .update({
        subscription_plan: newPlan,
        status: newStatus,
        stripe_subscription_id: subscription.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", establishment.id);

    if (updateError) {
      logStep("Error updating establishment", { error: updateError.message });
    } else {
      logStep("Establishment updated successfully", { 
        establishmentId: establishment.id,
        newPlan,
        newStatus,
      });
    }
  } catch (err) {
    logStep("Error in handleSubscriptionEvent", { 
      error: err instanceof Error ? err.message : "Unknown" 
    });
  }
}

// Handle customer events
// deno-lint-ignore no-explicit-any
async function handleCustomerEvent(supabase: SupabaseClient<any>, event: Stripe.Event) {
  const customer = event.data.object as Stripe.Customer;
  logStep("Processing customer event", { 
    type: event.type, 
    customerId: customer.id,
    email: customer.email,
  });

  if (event.type === "customer.deleted") {
    // Mark any linked establishments as potentially needing attention
    const { error } = await supabase
      .from("establishments")
      .update({
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_plan: "pro",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_customer_id", customer.id);

    if (error) {
      logStep("Error clearing customer from establishment", { error: error.message });
    }
  }
}

// Handle invoice events
// deno-lint-ignore no-explicit-any
async function handleInvoiceEvent(supabase: SupabaseClient<any>, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  logStep("Processing invoice event", { 
    type: event.type, 
    invoiceId: invoice.id,
    customerId: invoice.customer,
    status: invoice.status,
    amountDue: invoice.amount_due,
  });

  if (event.type === "invoice.payment_failed") {
    // Find establishment and potentially update status
    const customerId = typeof invoice.customer === "string" 
      ? invoice.customer 
      : invoice.customer?.id;

    if (customerId) {
      const { data: establishment } = await supabase
        .from("establishments")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (establishment) {
        logStep("Invoice payment failed for establishment", { 
          establishmentId: establishment.id,
          invoiceId: invoice.id,
        });
        // Could update status to suspended or send notification
      }
    }
  }
}

// Handle product and price events to keep portal in sync
// deno-lint-ignore no-explicit-any
async function handleProductPriceEvent(supabase: SupabaseClient<any>, stripe: Stripe, event: Stripe.Event) {
  logStep("Processing product/price event", { type: event.type });

  // Get updated products and prices from Stripe
  const products = await stripe.products.list({ limit: 100, active: true });
  const prices = await stripe.prices.list({ limit: 100, active: true });

  // Update sync status timestamp
  const { data: portalPlans } = await supabase
    .from("subscription_plans")
    .select("id, stripe_product_id, stripe_price_id_monthly, price_monthly");

  if (!portalPlans) return;

  for (const plan of portalPlans) {
    if (!plan.stripe_product_id) continue;

    const stripeProduct = products.data.find((p: Stripe.Product) => p.id === plan.stripe_product_id);
    const stripePrice = prices.data.find((p: Stripe.Price) => p.id === plan.stripe_price_id_monthly);

    // If product was deleted or price changed significantly, mark as needing sync
    const needsSync = !stripeProduct || !stripePrice || 
      (stripePrice && Math.abs((stripePrice.unit_amount || 0) / 100 - plan.price_monthly) > 0.01);

    if (needsSync) {
      logStep("Plan needs synchronization", { 
        planId: plan.id, 
        reason: !stripeProduct ? "product_deleted" : !stripePrice ? "price_deleted" : "price_mismatch" 
      });
    }
  }
}

// Handle checkout session completion
// deno-lint-ignore no-explicit-any
async function handleCheckoutEvent(supabase: SupabaseClient<any>, stripe: Stripe, event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  logStep("Processing checkout event", { 
    type: event.type, 
    sessionId: session.id,
    customerId: session.customer,
    mode: session.mode,
  });

  if (event.type === "checkout.session.completed" && session.mode === "subscription") {
    // Filter: only process salaocloud sessions
    const sessionAppMeta = (session.metadata as Record<string, string> | null)?.app;
    if (sessionAppMeta !== "salaocloud") {
      logStep("Skipping checkout event (not salaocloud)", { sessionId: session.id, sessionAppMeta });
      return;
    }

    const customerId = typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

    const subscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

    if (customerId && subscriptionId) {
      // Get customer email
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && customer.email) {
        // Find establishments without stripe customer ID
        const { data: establishments } = await supabase
          .from("establishments")
          .select("id, owner_id")
          .is("stripe_customer_id", null)
          .limit(10);

        if (establishments && establishments.length > 0) {
          // Update the first matching establishment without a stripe customer ID
          for (const est of establishments) {
            // Check if owner email matches
            const { data: userData } = await supabase.auth.admin.getUserById(est.owner_id);
            if (userData?.user?.email === customer.email) {
              await supabase
                .from("establishments")
                .update({
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  status: "active",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", est.id);

              logStep("Linked checkout to establishment", { 
                establishmentId: est.id,
                customerId,
                subscriptionId,
              });
              break;
            }
          }
        }
      }
    }
  }
}

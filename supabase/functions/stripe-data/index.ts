import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-DATA] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const { action } = await req.json();

    switch (action) {
      case "get_products_and_prices": {
        logStep("Fetching products and prices (filter app=salaocloud)");
        const allProducts = await stripe.products.list({ limit: 100, active: true });
        const allPrices = await stripe.prices.list({ limit: 100, active: true });

        // Only keep salaocloud products
        const products = {
          data: allProducts.data.filter((p: Stripe.Product) => p.metadata?.app === "salaocloud"),
        };
        const productIds = new Set(products.data.map((p: Stripe.Product) => p.id));
        const prices = {
          data: allPrices.data.filter((pr: Stripe.Price) => productIds.has(typeof pr.product === "string" ? pr.product : pr.product.id)),
        };

        const productData = products.data.map((product: Stripe.Product) => {
          const productPrices = prices.data.filter((p: Stripe.Price) => p.product === product.id);
          return {
            id: product.id,
            name: product.name,
            description: product.description,
            active: product.active,
            metadata: product.metadata,
            prices: productPrices.map((price: Stripe.Price) => ({
              id: price.id,
              unit_amount: price.unit_amount,
              currency: price.currency,
              recurring: price.recurring,
              active: price.active,
              metadata: price.metadata,
            })),
          };
        });

        logStep("Products and prices fetched", { count: productData.length });
        return new Response(JSON.stringify({ products: productData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_statistics": {
        logStep("Fetching statistics");
        
        // Get all customers
        const customers = await stripe.customers.list({ limit: 100 });
        
        // Get all subscriptions
        const activeSubscriptions = await stripe.subscriptions.list({ status: "active", limit: 100 });
        const canceledSubscriptions = await stripe.subscriptions.list({ status: "canceled", limit: 100 });
        const allSubscriptions = await stripe.subscriptions.list({ limit: 100 });
        
        // Get charges for the last 12 months
        const now = new Date();
        const monthlyData: Array<{
          month: string;
          revenue: number;
          subscriptions: number;
        }> = [];
        
        for (let i = 11; i >= 0; i--) {
          const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
          
          const charges = await stripe.charges.list({
            created: {
              gte: Math.floor(startDate.getTime() / 1000),
              lte: Math.floor(endDate.getTime() / 1000),
            },
            limit: 100,
          });
          
          const revenue = charges.data
            .filter((c: Stripe.Charge) => c.status === "succeeded")
            .reduce((sum: number, c: Stripe.Charge) => sum + (c.amount || 0), 0);
          
          const monthSubscriptions = allSubscriptions.data.filter((sub: Stripe.Subscription) => {
            const created = new Date(sub.created * 1000);
            return created >= startDate && created <= endDate;
          }).length;
          
          monthlyData.push({
            month: startDate.toLocaleString("pt-BR", { month: "short", year: "2-digit" }),
            revenue: revenue / 100,
            subscriptions: monthSubscriptions,
          });
        }
        
        // Calculate average ticket
        const totalRevenue = monthlyData.reduce((sum, m) => sum + m.revenue, 0);
        const totalTransactions = activeSubscriptions.data.length + canceledSubscriptions.data.length;
        const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
        
        // Calculate conversion rate (subscribers / total customers)
        const conversionRate = customers.data.length > 0 
          ? (activeSubscriptions.data.length / customers.data.length) * 100 
          : 0;
        
        // Calculate abandonment rate (canceled / total subscriptions)
        const totalSubs = activeSubscriptions.data.length + canceledSubscriptions.data.length;
        const abandonmentRate = totalSubs > 0 
          ? (canceledSubscriptions.data.length / totalSubs) * 100 
          : 0;
        
        const stats = {
          activeSubscriptions: activeSubscriptions.data.length,
          canceledSubscriptions: canceledSubscriptions.data.length,
          totalCustomers: customers.data.length,
          averageTicket: Math.round(averageTicket * 100) / 100,
          conversionRate: Math.round(conversionRate * 100) / 100,
          abandonmentRate: Math.round(abandonmentRate * 100) / 100,
          monthlyData,
        };
        
        logStep("Statistics calculated", stats);
        return new Response(JSON.stringify(stats), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check_status": {
        logStep("Checking Stripe status");
        try {
          // Simple API call to verify connectivity
          await stripe.balance.retrieve();
          return new Response(JSON.stringify({ 
            status: "online",
            timestamp: new Date().toISOString(),
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(JSON.stringify({ 
            status: "offline",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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

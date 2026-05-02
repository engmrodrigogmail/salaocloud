// Bootstrap utilitário: cria o produto [SC] Salão Cloud Pro em LIVE mode usando STRIPE_SECRET_KEY do projeto.
// Executar UMA VEZ via curl_edge_functions e depois remover.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");
    const isLive = stripeKey.startsWith("sk_live_");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Procura se já existe (idempotência)
    const existing = await stripe.products.search({
      query: `metadata['app']:'salaocloud' AND metadata['slug']:'pro' AND active:'true'`,
      limit: 1,
    });

    let product: Stripe.Product;
    if (existing.data.length > 0) {
      product = existing.data[0];
    } else {
      product = await stripe.products.create({
        name: "[SC] Salão Cloud Pro",
        description:
          "Acesso completo a todas as funcionalidades do Salão Cloud: agenda, comandas, comissões, fidelidade, cupons, IA, multi-profissionais e muito mais.",
        metadata: {
          app: "salaocloud",
          environment: isLive ? "production" : "sandbox",
          slug: "pro",
        },
      });
    }

    // Procura price mensal R$ 129,90 ativo
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
    let price = prices.data.find(
      (p) => p.unit_amount === 12990 && p.currency === "brl" && p.recurring?.interval === "month"
    );

    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: 12990,
        currency: "brl",
        recurring: { interval: "month" },
        metadata: { app: "salaocloud", interval: "monthly", slug: "pro" },
      });
    }

    return new Response(
      JSON.stringify({
        livemode: isLive,
        product_id: product.id,
        price_id: price.id,
        product_name: product.name,
        price_amount: price.unit_amount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

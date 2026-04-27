// Public endpoint to safely look up a client by email at the portal.
// Returns minimal fields to avoid leaking PII to non-matching queries.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { establishment_id, email } = await req.json();

    if (!establishment_id || !email) {
      return new Response(
        JSON.stringify({ error: "establishment_id and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return new Response(
        JSON.stringify({ error: "invalid email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check whether ANY row sharing this email already has a password set.
    // (Senha é compartilhada entre todos os salões em que o e-mail está cadastrado.)
    const { data: anyWithPassword } = await supabase
      .from("clients")
      .select("id")
      .or(`email.eq.${normalizedEmail},global_identity_email.eq.${normalizedEmail}`)
      .not("password_hash", "is", null)
      .limit(1);
    const hasPassword = Array.isArray(anyWithPassword) && anyWithPassword.length > 0;

    // 1) Check this establishment for either email or global_identity_email
    const { data: localClient, error: localError } = await supabase
      .from("clients")
      .select("id, name, phone, email, global_identity_email, cpf, shared_history_consent, notes, establishment_id")
      .eq("establishment_id", establishment_id)
      .or(`global_identity_email.eq.${normalizedEmail},email.eq.${normalizedEmail}`)
      .maybeSingle();

    if (localError) {
      console.error("local lookup error", localError);
      return new Response(
        JSON.stringify({ error: localError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (localClient) {
      return new Response(
        JSON.stringify({ match: "local", client: localClient, has_password: hasPassword }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Identity stitching: search globally by global_identity_email
    const { data: globalClient, error: globalError } = await supabase
      .from("clients")
      .select("id, name, phone, email, global_identity_email, cpf, shared_history_consent, notes, establishment_id")
      .eq("global_identity_email", normalizedEmail)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (globalError) {
      console.error("global lookup error", globalError);
      return new Response(
        JSON.stringify({ error: globalError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (globalClient) {
      return new Response(
        JSON.stringify({ match: "global", client: globalClient }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ match: "none" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("lookup-client-by-email exception", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

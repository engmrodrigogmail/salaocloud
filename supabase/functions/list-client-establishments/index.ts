// Public endpoint: lists all establishments where a given email has a client record.
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
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
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

    // Find all clients matching the email (either local email or global identity)
    const { data: clientRows, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, establishment_id, email, global_identity_email")
      .or(`email.eq.${normalizedEmail},global_identity_email.eq.${normalizedEmail}`);

    if (clientErr) {
      console.error("clients lookup error", clientErr);
      return new Response(
        JSON.stringify({ error: clientErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!clientRows || clientRows.length === 0) {
      return new Response(
        JSON.stringify({ establishments: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const establishmentIds = Array.from(new Set(clientRows.map((c: any) => c.establishment_id).filter(Boolean)));

    if (establishmentIds.length === 0) {
      return new Response(
        JSON.stringify({ establishments: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: ests, error: estErr } = await supabase
      .from("establishments")
      .select("id, name, slug, logo_url, city, state, status")
      .in("id", establishmentIds)
      .eq("status", "active")
      .order("name");

    if (estErr) {
      console.error("establishments lookup error", estErr);
      return new Response(
        JSON.stringify({ error: estErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ establishments: ests ?? [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("list-client-establishments exception", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

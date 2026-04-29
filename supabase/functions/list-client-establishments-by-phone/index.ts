// Public endpoint: lists all establishments where a given phone number has a client record.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone } = await req.json();
    const digits = String(phone ?? "").replace(/\D/g, "");

    if (digits.length < 10) {
      return new Response(
        JSON.stringify({ error: "invalid phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all clients and match by digits-only comparison (phones are stored with formatting).
    // Use suffix match on the last 10/11 digits to be tolerant to country code variations.
    const last10 = digits.slice(-10);

    const { data: clientRows, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, establishment_id, email, global_identity_email, phone")
      .ilike("phone", `%${last10.slice(-4)}%`); // narrow with last 4 digits, then refine in JS

    if (clientErr) {
      console.error("clients lookup error", clientErr);
      return new Response(
        JSON.stringify({ error: clientErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const matches = (clientRows ?? []).filter((c: any) => {
      const cd = String(c.phone ?? "").replace(/\D/g, "");
      return cd.endsWith(last10);
    });

    if (matches.length === 0) {
      return new Response(
        JSON.stringify({ establishments: [], suggested_email: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const establishmentIds = Array.from(new Set(matches.map((c: any) => c.establishment_id).filter(Boolean)));

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

    // Suggest the first known email (local or global) to help the client complete their account
    const suggestedEmail =
      matches.find((c: any) => c.global_identity_email)?.global_identity_email ??
      matches.find((c: any) => c.email)?.email ??
      null;

    return new Response(
      JSON.stringify({
        establishments: ests ?? [],
        suggested_email: suggestedEmail,
        match_count: matches.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("list-client-establishments-by-phone exception", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

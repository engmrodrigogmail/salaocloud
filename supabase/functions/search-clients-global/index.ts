// Searches clients by name, email or phone within the salon AND across the
// Salão Cloud network (other establishments). Used by the manual appointment
// dialog so the receptionist can quickly find a returning customer.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { establishment_id, query } = await req.json();
    const q = String(query || "").trim();
    if (!establishment_id || q.length < 2) {
      return new Response(JSON.stringify({ local: [], network: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const isEmail = q.includes("@");
    const digits = onlyDigits(q);
    const isPhone = digits.length >= 4 && !isEmail;

    // Build OR filter
    const filters: string[] = [];
    if (isEmail) {
      const e = q.toLowerCase();
      filters.push(`email.ilike.%${e}%`, `global_identity_email.ilike.%${e}%`);
    } else if (isPhone) {
      filters.push(`phone.ilike.%${digits}%`);
    } else {
      filters.push(`name.ilike.%${q}%`);
    }
    const orStr = filters.join(",");

    // Local
    const { data: local, error: localErr } = await supabase
      .from("clients")
      .select("id, name, phone, email, establishment_id")
      .eq("establishment_id", establishment_id)
      .or(orStr)
      .order("name")
      .limit(15);
    if (localErr) throw localErr;

    // Network (other salons) — only when not found locally OR to enrich
    const { data: network, error: netErr } = await supabase
      .from("clients")
      .select("id, name, phone, email, establishment_id, establishments:establishment_id(name)")
      .neq("establishment_id", establishment_id)
      .or(orStr)
      .order("name")
      .limit(15);
    if (netErr) throw netErr;

    // Deduplicate network by phone/email (one entry per person)
    const seen = new Set<string>();
    const uniqueNetwork = (network || []).filter((c: any) => {
      const key = (c.email || "").toLowerCase() || onlyDigits(c.phone || "") || c.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return new Response(
      JSON.stringify({ local: local || [], network: uniqueNetwork }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("search-clients-global error", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

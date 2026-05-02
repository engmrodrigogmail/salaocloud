import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Apaga fotos do bucket temp-analysis quando:
// (a) o perfil foi validado/corrigido pelo profissional, OU
// (b) passaram >48h desde o upload (compulsório por LGPD)
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Buscar perfis com fotos ainda no storage que: foram validados OU expiraram
  const { data: profiles, error } = await admin
    .from("client_hair_profiles")
    .select("id, photo_paths, is_validated, created_at")
    .eq("photos_purged", false)
    .or(`is_validated.eq.true,created_at.lt.${cutoff}`);

  if (error) {
    console.error("query error", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  let purged = 0;
  for (const p of profiles ?? []) {
    const paths = (p.photo_paths as string[]) ?? [];
    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage.from("temp-analysis").remove(paths);
      if (rmErr) {
        console.error("remove error", p.id, rmErr);
        continue;
      }
    }
    await admin
      .from("client_hair_profiles")
      .update({ photos_purged: true, photo_urls: [] })
      .eq("id", p.id);
    purged++;
  }

  return new Response(JSON.stringify({ success: true, purged }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

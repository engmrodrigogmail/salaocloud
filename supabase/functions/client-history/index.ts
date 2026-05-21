// Returns closed tabs (history) for the authenticated client at a given establishment.
// Auth: requires a valid client session token (header x-client-session).
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CLIENT_AUTH_CORS } from "../_shared/client-auth.ts";
import { resolveClientFromSession, extractSessionToken } from "../_shared/client-session.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CLIENT_AUTH_CORS });
  try {
    const { establishment_id } = await req.json();
    if (!establishment_id) return json({ error: "missing_establishment_id" }, 400);

    const token = extractSessionToken(req);
    const clientId = await resolveClientFromSession(token);
    if (!clientId) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Confirm the client belongs to this establishment (or share email to other rows)
    const { data: clientRow } = await admin
      .from("clients")
      .select("id, email, global_identity_email, establishment_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!clientRow) return json({ error: "client_not_found" }, 404);

    // Allow history across rows for the same identity within the requested establishment
    const email = (clientRow.global_identity_email || clientRow.email || "").toLowerCase();
    let clientIds = [clientId];
    if (email) {
      const { data: siblings } = await admin
        .from("clients")
        .select("id")
        .eq("establishment_id", establishment_id)
        .or(`email.eq.${email},global_identity_email.eq.${email}`);
      clientIds = Array.from(new Set([clientId, ...(siblings || []).map((r: any) => r.id)]));
    }

    const { data: tabs, error } = await admin
      .from("tabs")
      .select(`
        id, closed_at, total,
        tab_items ( id, name, item_type, quantity, total_price, service_id, professional_id, professionals:professional_id ( id, name ) ),
        tab_payments ( id, payment_method_name, amount )
      `)
      .in("client_id", clientIds)
      .eq("establishment_id", establishment_id)
      .eq("status", "closed")
      .order("closed_at", { ascending: false });

    if (error) return json({ error: error.message }, 500);

    return json({ tabs: tabs || [] }, 200);
  } catch (err) {
    console.error("client-history exception", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CLIENT_AUTH_CORS, "Content-Type": "application/json" },
  });
}

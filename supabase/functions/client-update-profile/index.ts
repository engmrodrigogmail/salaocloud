// Updates the authenticated client's profile (name, phone, cpf) for a given establishment.
// Auth: requires a valid client session token (header x-client-session).
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CLIENT_AUTH_CORS } from "../_shared/client-auth.ts";
import { resolveClientFromSession, extractSessionToken } from "../_shared/client-session.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CLIENT_AUTH_CORS });
  try {
    const body = await req.json();
    const establishment_id = String(body.establishment_id || "");
    const name = body.name != null ? String(body.name).trim() : null;
    const phone = body.phone != null ? String(body.phone).replace(/\D/g, "") : null;
    const cpfRaw = body.cpf != null ? String(body.cpf).replace(/\D/g, "") : null;
    const cpf = cpfRaw && cpfRaw.length === 11 && !/^(\d)\1{10}$/.test(cpfRaw) ? cpfRaw : (cpfRaw === "" ? null : cpfRaw);

    if (!establishment_id) return json({ error: "missing_establishment_id" }, 400);
    if (name !== null && name.length < 2) return json({ error: "invalid_name" }, 400);
    if (phone !== null && phone !== "" && phone.length < 10) return json({ error: "invalid_phone" }, 400);
    if (cpf !== null && cpf !== "" && cpf.length !== 11) return json({ error: "invalid_cpf" }, 400);

    const token = extractSessionToken(req);
    const clientId = await resolveClientFromSession(token);
    if (!clientId) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: clientRow } = await admin
      .from("clients")
      .select("id, email, global_identity_email")
      .eq("id", clientId)
      .maybeSingle();
    if (!clientRow) return json({ error: "client_not_found" }, 404);

    const email = (clientRow.global_identity_email || clientRow.email || "").toLowerCase();

    // Find the row tied to the requested establishment for this identity
    let targetRow: any = null;
    if (email) {
      const { data } = await admin
        .from("clients")
        .select("id")
        .eq("establishment_id", establishment_id)
        .or(`email.eq.${email},global_identity_email.eq.${email}`)
        .limit(1)
        .maybeSingle();
      targetRow = data;
    }
    if (!targetRow) {
      // Fallback: only allow if the session-client's establishment matches
      const { data } = await admin
        .from("clients")
        .select("id, establishment_id")
        .eq("id", clientId)
        .maybeSingle();
      if (!data || data.establishment_id !== establishment_id) {
        return json({ error: "client_not_in_establishment" }, 404);
      }
      targetRow = { id: data.id };
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== null) updates.name = name;
    if (phone !== null) updates.phone = phone;
    if (cpf !== null) updates.cpf = cpf;

    const { data: updated, error } = await admin
      .from("clients")
      .update(updates)
      .eq("id", targetRow.id)
      .select("id, name, phone, email, global_identity_email, cpf, establishment_id")
      .single();

    if (error) return json({ error: error.message }, 500);
    return json({ status: "ok", client: updated }, 200);
  } catch (err) {
    console.error("client-update-profile exception", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CLIENT_AUTH_CORS, "Content-Type": "application/json" },
  });
}

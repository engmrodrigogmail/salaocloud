// Sets a password for a salon client.
// Used in two scenarios:
//   1. Migração suave: existing client without password defines one on first access (requires email match only).
//   2. New registration: called right after client insert (requires client_id + email match).
// Updates ALL client rows that share the same email or global_identity_email so the password
// works across every salon where the email is registered.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CLIENT_AUTH_CORS, hashPassword } from "../_shared/client-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CLIENT_AUTH_CORS });

  try {
    const { email, password, client_id, mode } = await req.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return json({ error: "invalid_email" }, 400);
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return json({ error: "weak_password" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find all client rows matching the email
    const { data: rows, error } = await supabase
      .from("clients")
      .select("id, email, global_identity_email, password_hash")
      .or(`email.eq.${normalizedEmail},global_identity_email.eq.${normalizedEmail}`);

    if (error) return json({ error: error.message }, 500);
    if (!rows || rows.length === 0) return json({ error: "client_not_found" }, 404);

    // For "first_time" mode, refuse if any row already has a password (force them to use login or reset).
    if (mode === "first_time" && rows.some((r: any) => !!r.password_hash)) {
      return json({ error: "password_already_set" }, 409);
    }

    // For "register" mode, require client_id to be among the rows
    if (mode === "register" && client_id) {
      if (!rows.some((r: any) => r.id === client_id)) {
        return json({ error: "client_mismatch" }, 403);
      }
    }

    const hash = await hashPassword(password);
    const ids = rows.map((r: any) => r.id);

    const { error: updateError } = await supabase
      .from("clients")
      .update({ password_hash: hash, password_set_at: new Date().toISOString() })
      .in("id", ids);

    if (updateError) {
      console.error("update password error", updateError);
      return json({ error: updateError.message }, 500);
    }

    return json({ status: "ok", updated_count: ids.length }, 200);
  } catch (err) {
    console.error("client-auth-set-password exception", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CLIENT_AUTH_CORS, "Content-Type": "application/json" },
  });
}

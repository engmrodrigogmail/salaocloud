// Authenticates a salon client via email + password.
// Returns the client record (and a list of all establishments where the email is registered).
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CLIENT_AUTH_CORS, verifyPassword } from "../_shared/client-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CLIENT_AUTH_CORS });

  try {
    const { email, password, establishment_id } = await req.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();

    if (!normalizedEmail || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedEmail)) {
      return json({ error: "invalid_email" }, 400);
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return json({ error: "invalid_password" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Match either local email or global identity email; optionally restrict by establishment.
    let query = supabase
      .from("clients")
      .select("id, name, phone, email, global_identity_email, cpf, shared_history_consent, notes, establishment_id, password_hash, password_set_at")
      .or(`email.eq.${normalizedEmail},global_identity_email.eq.${normalizedEmail}`);

    if (establishment_id) query = query.eq("establishment_id", establishment_id);

    const { data: rows, error } = await query;
    if (error) {
      console.error("login query error", error);
      return json({ error: "lookup_failed" }, 500);
    }
    if (!rows || rows.length === 0) {
      return json({ error: "client_not_found" }, 404);
    }

    // If multiple records (one per salon), pick any with password set first; else first.
    const withPassword = rows.find((r: any) => !!r.password_hash);
    const candidate = withPassword ?? rows[0];

    if (!candidate.password_hash) {
      // Existing client with no password yet — frontend should redirect to "set password" flow.
      return json({
        status: "password_not_set",
        client: stripSecrets(candidate),
      }, 200);
    }

    const ok = await verifyPassword(password, candidate.password_hash);
    if (!ok) return json({ error: "invalid_credentials" }, 401);

    return json({
      status: "ok",
      client: stripSecrets(candidate),
    }, 200);
  } catch (err) {
    console.error("client-auth-login exception", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function stripSecrets(c: any) {
  const { password_hash: _h, ...rest } = c;
  return rest;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CLIENT_AUTH_CORS, "Content-Type": "application/json" },
  });
}

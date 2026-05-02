// Authenticates a salon client via email + password.
// Returns the client record (and a list of all establishments where the email is registered).
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CLIENT_AUTH_CORS, verifyPassword } from "../_shared/client-auth.ts";
import { createClientSession } from "../_shared/client-session.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CLIENT_AUTH_CORS });

  try {
    const { email, password, establishment_id } = await req.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const requestId = crypto.randomUUID();
    console.log("[client-auth-login] start", {
      requestId,
      email: maskEmail(normalizedEmail),
      establishment_id: establishment_id ?? null,
      hasPasswordInput: typeof password === "string" && password.length > 0,
    });

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
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
      console.error("[client-auth-login] query_error", { requestId, error });
      return json({ error: "lookup_failed" }, 500);
    }
    console.log("[client-auth-login] lookup_result", {
      requestId,
      rows: rows?.length ?? 0,
      candidates: (rows ?? []).map((r: any) => ({
        id: r.id,
        establishment_id: r.establishment_id,
        has_password: Boolean(r.password_hash),
        email_match: r.email === normalizedEmail,
        global_match: r.global_identity_email === normalizedEmail,
      })),
    });
    if (!rows || rows.length === 0) {
      return json({ error: "client_not_found" }, 404);
    }

    // Passwords are shared by email across salons. Authenticate against any row with a password,
    // but return the row for the requested establishment when present.
    const authCandidate = rows.find((r: any) => !!r.password_hash) ?? rows[0];
    const localCandidate = establishment_id
      ? rows.find((r: any) => r.establishment_id === establishment_id)
      : null;
    const candidate = localCandidate ?? authCandidate;

    if (!authCandidate.password_hash) {
      // Existing client with no password yet — frontend should redirect to "set password" flow.
      return json({
        status: "password_not_set",
        client: stripSecrets(candidate),
      }, 200);
    }

    const ok = await verifyPassword(password, authCandidate.password_hash);
    console.log("[client-auth-login] password_result", {
      requestId,
      ok,
      authClientId: authCandidate.id,
      returnedClientId: candidate.id,
      returnedEstablishmentId: candidate.establishment_id,
    });
    if (!ok) return json({ error: "invalid_credentials" }, 401);

    const ua = req.headers.get("user-agent");
    const session = await createClientSession(candidate.id, ua);
    console.log("[client-auth-login] success", {
      requestId,
      clientId: candidate.id,
      establishment_id: candidate.establishment_id,
      sessionCreated: Boolean(session?.token),
    });

    return json({
      status: "ok",
      client: stripSecrets(candidate),
      session_token: session?.token ?? null,
      session_expires_at: session?.expires_at ?? null,
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

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "invalid";
  return `${local.slice(0, 2)}***@${domain}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CLIENT_AUTH_CORS, "Content-Type": "application/json" },
  });
}

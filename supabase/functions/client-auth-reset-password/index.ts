// Validates a password reset token and updates the password across all client rows
// matching the token's registered email.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CLIENT_AUTH_CORS, hashPassword, sha256Hex } from "../_shared/client-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CLIENT_AUTH_CORS });

  try {
    const { token, new_password, action } = await req.json();
    if (!token || typeof token !== "string") return json({ error: "invalid_token" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tokenHash = await sha256Hex(token);

    const { data: tokenRow, error: tokenErr } = await supabase
      .from("client_password_reset_tokens")
      .select("id, email, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenErr) return json({ error: "lookup_failed" }, 500);
    if (!tokenRow) return json({ error: "invalid_token" }, 400);
    if (tokenRow.used_at) return json({ error: "token_already_used" }, 400);
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return json({ error: "token_expired" }, 400);
    }

    // Action "validate" — front asks if the token is still good before showing the form
    if (action === "validate") {
      return json({ status: "valid", email: tokenRow.email }, 200);
    }

    if (!new_password || typeof new_password !== "string" || new_password.length < 6) {
      return json({ error: "weak_password" }, 400);
    }

    const hash = await hashPassword(new_password);

    const { data: clientRows, error: rowsErr } = await supabase
      .from("clients")
      .select("id")
      .or(`email.eq.${tokenRow.email},global_identity_email.eq.${tokenRow.email}`);

    if (rowsErr) return json({ error: rowsErr.message }, 500);
    if (!clientRows || clientRows.length === 0) return json({ error: "client_not_found" }, 404);

    const ids = clientRows.map((r: any) => r.id);

    const { error: updateErr } = await supabase
      .from("clients")
      .update({ password_hash: hash, password_set_at: new Date().toISOString() })
      .in("id", ids);

    if (updateErr) return json({ error: updateErr.message }, 500);

    // Mark token as used
    await supabase
      .from("client_password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    return json({ status: "ok", email: tokenRow.email }, 200);
  } catch (err) {
    console.error("client-auth-reset-password exception", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CLIENT_AUTH_CORS, "Content-Type": "application/json" },
  });
}

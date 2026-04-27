// Generates a single-use password reset token and emails it to the client.
// ALWAYS returns success-shaped response to avoid leaking whether the email exists.
// The reset link is sent ONLY to the registered client email.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CLIENT_AUTH_CORS, generateRawToken, sha256Hex } from "../_shared/client-auth.ts";

const TOKEN_TTL_MINUTES = 30;
const APP_BASE_URL = "https://salaocloud.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CLIENT_AUTH_CORS });

  try {
    const { email } = await req.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return json({ ok: true }, 200); // generic response
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find any client row with this email (registered email — we only send to the registered address)
    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, email, global_identity_email, establishment_id")
      .or(`email.eq.${normalizedEmail},global_identity_email.eq.${normalizedEmail}`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (clientErr) {
      console.error("lookup error", clientErr);
      return json({ ok: true }, 200);
    }

    if (!clientRow) {
      return json({ ok: true }, 200);
    }

    // Determine the registered email to send to (prefer global identity email, fall back to local)
    const registeredEmail = (clientRow.global_identity_email || clientRow.email || normalizedEmail).toLowerCase();

    // Generate token and store its hash
    const rawToken = generateRawToken();
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase
      .from("client_password_reset_tokens")
      .insert({
        email: registeredEmail,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (insertErr) {
      console.error("token insert error", insertErr);
      return json({ ok: true }, 200);
    }

    // Look up establishment name for nicer email copy
    let establishmentName: string | undefined;
    if (clientRow.establishment_id) {
      const { data: est } = await supabase
        .from("establishments")
        .select("name")
        .eq("id", clientRow.establishment_id)
        .maybeSingle();
      establishmentName = est?.name;
    }

    const resetUrl = `${APP_BASE_URL}/cliente/redefinir-senha?token=${rawToken}`;

    // Trigger transactional email (fire-and-forget; we still return success)
    const { error: emailErr } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "client-password-reset",
        recipientEmail: registeredEmail,
        idempotencyKey: `client-pwd-reset-${tokenHash}`,
        templateData: {
          name: clientRow.name,
          establishmentName,
          resetUrl,
          expiresInMinutes: TOKEN_TTL_MINUTES,
        },
      },
    });

    if (emailErr) {
      console.error("email send error", emailErr);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("client-auth-request-reset exception", err);
    return json({ ok: true }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CLIENT_AUTH_CORS, "Content-Type": "application/json" },
  });
}

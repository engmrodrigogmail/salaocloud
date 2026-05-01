// Shared helpers for client portal session tokens.
// Tokens are random 32-byte hex strings; only their SHA-256 hash is stored in DB.
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateRawToken, sha256Hex } from "./client-auth.ts";

export interface CreatedSession {
  token: string;       // raw token returned to the client (kept in localStorage)
  expires_at: string;
}

export async function createClientSession(
  client_id: string,
  user_agent: string | null,
): Promise<CreatedSession | null> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = generateRawToken();
  const token_hash = await sha256Hex(token);
  const expires_at = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from("client_sessions").insert({
    client_id,
    token_hash,
    user_agent,
    expires_at,
  });
  if (error) {
    console.error("createClientSession error", error);
    return null;
  }
  return { token, expires_at };
}

export async function resolveClientFromSession(token: string | null): Promise<string | null> {
  if (!token) return null;
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token_hash = await sha256Hex(token);
  const { data } = await admin
    .from("client_sessions")
    .select("client_id, expires_at")
    .eq("token_hash", token_hash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  // Best-effort touch of last_used_at (don't await result quality)
  admin.from("client_sessions").update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", token_hash).then();
  return data.client_id as string;
}

export function extractSessionToken(req: Request): string | null {
  const header = req.headers.get("x-client-session");
  if (header && header.length >= 32) return header;
  return null;
}

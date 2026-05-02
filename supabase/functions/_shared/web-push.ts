// Shared web-push helper using VAPID + Deno crypto.
// Sends a Web Push notification to a single subscription.
// Uses npm:web-push for compatibility.

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const RAW_VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@salaocloud.com.br";

// Normaliza o subject: precisa ser uma URL (mailto: ou https://). Se vier só um e-mail, prefixa mailto:.
function normalizeVapidSubject(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "mailto:contato@salaocloud.com.br";
  if (trimmed.startsWith("mailto:") || trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }
  // Se parece um e-mail, prefixa
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }
  // Fallback seguro
  console.warn(`[web-push] VAPID_SUBJECT inválido (${trimmed}), usando fallback`);
  return "mailto:contato@salaocloud.com.br";
}

const VAPID_SUBJECT = normalizeVapidSubject(RAW_VAPID_SUBJECT);

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log(`[web-push] VAPID configurado com subject=${VAPID_SUBJECT}`);
  } catch (err) {
    console.error("[web-push] Falha ao configurar VAPID:", err);
  }
} else {
  console.warn("[web-push] VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY ausentes");
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export type PushSendResult =
  | { ok: true; statusCode: number }
  | { ok: false; statusCode?: number; gone: boolean; error: string };

export async function sendWebPush(
  sub: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { ok: false, gone: false, error: "VAPID keys not configured" };
  }
  try {
    const res = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
    return { ok: true, statusCode: res.statusCode };
  } catch (e: any) {
    const statusCode = e?.statusCode;
    // 404/410 => endpoint expirado/inválido — caller deve marcar inativo
    const gone = statusCode === 404 || statusCode === 410;
    return { ok: false, statusCode, gone, error: e?.body || e?.message || String(e) };
  }
}

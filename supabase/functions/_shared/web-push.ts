// Shared web-push helper using VAPID + Deno crypto.
// Sends a Web Push notification to a single subscription.
// Uses npm:web-push for compatibility.

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@salaocloud.com.br";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
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

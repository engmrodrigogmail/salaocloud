// Edge function: client-notifications-list
// Lists notifications for the authenticated client (validated by session token).
// SECURITY: client_id is resolved from the x-client-session header, never trusted from body.
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractSessionToken, resolveClientFromSession } from "../_shared/client-session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-session, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ListInput {
  limit?: number;
  mark_read_ids?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = extractSessionToken(req);
    const client_id = await resolveClientFromSession(token);
    if (!client_id) return json({ error: "unauthorized" }, 401);

    const body = (await req.json().catch(() => ({}))) as ListInput;
    const limit = Math.min(Math.max(body.limit ?? 50, 1), 200);
    const mark_read_ids = body.mark_read_ids;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (mark_read_ids?.length) {
      await admin
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", mark_read_ids)
        .eq("recipient_type", "client")
        .eq("recipient_id", client_id);
    }

    const { data, error } = await admin
      .from("notifications")
      .select("id, title, body, link, data, read_at, created_at")
      .eq("recipient_type", "client")
      .eq("recipient_id", client_id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return json({ error: error.message }, 500);

    const unread = (data ?? []).filter((n) => !n.read_at).length;
    return json({ items: data ?? [], unread_count: unread });
  } catch (e: any) {
    return json({ error: e?.message ?? "internal_error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

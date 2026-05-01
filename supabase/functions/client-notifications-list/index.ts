// Edge function: client-notifications-list
// Lists notifications for a given client_id, optionally marking some as read.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ListInput {
  client_id: string;
  limit?: number;
  mark_read_ids?: string[]; // optional: mark these specific notifications as read
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { client_id, limit = 50, mark_read_ids } = (await req.json()) as ListInput;
    if (!client_id) return json({ error: "client_id_required" }, 400);

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
      .limit(Math.min(limit, 200));
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

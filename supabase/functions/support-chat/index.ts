import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "get_history"
  | "create_conversation"
  | "save_message"
  | "update_status";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SUPPORT-CHAT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));

    const action = body.action as Action | undefined;
    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_history") {
      const visitorId = String(body.visitorId || "");
      if (!visitorId) {
        return new Response(JSON.stringify({ error: "Missing visitorId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("get_history:start", { visitorId });

      const { data: conversations, error: convError } = await supabase
        .from("chat_conversations")
        .select("id, created_at, status")
        .eq("visitor_id", visitorId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (convError) throw convError;

      if (!conversations || conversations.length === 0) {
        logStep("get_history:empty");
        return new Response(JSON.stringify({ conversations: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const convIds = conversations.map((c) => c.id);

      const { data: messages, error: msgError } = await supabase
        .from("chat_messages")
        .select("id, conversation_id, message, is_from_user, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: true });

      if (msgError) throw msgError;

      const msgsByConv = new Map<
        string,
        { id: string; message: string; is_from_user: boolean; created_at: string }[]
      >();

      (messages ?? []).forEach((m) => {
        const key = String(m.conversation_id);
        const list = msgsByConv.get(key) ?? [];
        list.push({
          id: m.id,
          message: m.message,
          is_from_user: m.is_from_user,
          created_at: m.created_at,
        });
        msgsByConv.set(key, list);
      });

      const assembled = conversations.map((c) => ({
        id: c.id,
        created_at: c.created_at,
        status: c.status,
        messages: msgsByConv.get(c.id) ?? [],
      }));

      logStep("get_history:ok", {
        conversations: assembled.length,
        messages: (messages ?? []).length,
      });

      return new Response(JSON.stringify({ conversations: assembled }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_conversation") {
      const visitorId = String(body.visitorId || "");
      const visitorName = body.visitorName ? String(body.visitorName) : null;
      const visitorEmail = body.visitorEmail ? String(body.visitorEmail) : null;

      if (!visitorId) {
        return new Response(JSON.stringify({ error: "Missing visitorId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("create_conversation:start", { visitorId });

      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
          visitor_id: visitorId,
          visitor_name: visitorName,
          visitor_email: visitorEmail,
          status: "open",
        })
        .select("id")
        .single();

      if (error) throw error;

      logStep("create_conversation:ok", { id: data.id });

      return new Response(JSON.stringify({ id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_message") {
      const conversationId = String(body.conversationId || "");
      const message = String(body.message || "");
      const isFromUser = Boolean(body.isFromUser);

      if (!conversationId || !message) {
        return new Response(
          JSON.stringify({ error: "Missing conversationId or message" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          message,
          is_from_user: isFromUser,
        })
        .select("id")
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_status") {
      const conversationId = String(body.conversationId || "");
      const status = String(body.status || "");

      if (!conversationId || !status) {
        return new Response(JSON.stringify({ error: "Missing conversationId or status" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("chat_conversations")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

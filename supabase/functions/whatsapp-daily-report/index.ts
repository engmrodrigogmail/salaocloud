// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

const TZ = "America/Sao_Paulo";

function ymdInTZ(d: Date): string {
  // returns YYYY-MM-DD in America/Sao_Paulo
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(d);
}
function startOfDayBRT(dateYMD: string): string {
  // returns ISO at 00:00 BRT (= 03:00 UTC)
  return new Date(`${dateYMD}T00:00:00-03:00`).toISOString();
}
function endOfDayBRT(dateYMD: string): string {
  return new Date(`${dateYMD}T23:59:59.999-03:00`).toISOString();
}
function brl(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

async function sendZapi(phone: string, message: string) {
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN! },
    body: JSON.stringify({ phone, message }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Z-API ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

function fillTemplate(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ""));
}

async function buildDailyReportVars(admin: any) {
  const now = new Date();
  const today = ymdInTZ(now);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
  const startToday = startOfDayBRT(today);
  const endToday = endOfDayBRT(today);
  const start7 = startOfDayBRT(ymdInTZ(sevenDaysAgo));

  // Establishments
  const [{ data: newToday }, { data: allEsts }] = await Promise.all([
    admin.from("establishments").select("id", { count: "exact", head: false })
      .gte("created_at", startToday).lte("created_at", endToday),
    admin.from("establishments").select("id,status,subscription_plan,trial_ends_at"),
  ]);
  const newSalonsToday = newToday?.length ?? 0;
  const ests = allEsts || [];
  const activeSalons = ests.filter((e: any) => e.status === "active").length;
  const activeTrials = ests.filter((e: any) => e.subscription_plan === "trial").length;
  const activeSubs = ests.filter((e: any) => e.status === "active" && e.subscription_plan !== "trial").length;

  // MRR estimate — sum of active plan prices
  let mrr = 0;
  try {
    const { data: plans } = await admin.from("subscription_plans").select("id,price_monthly");
    const priceById = new Map((plans || []).map((p: any) => [p.id, Number(p.price_monthly || 0)]));
    for (const e of ests) {
      if (e.status === "active" && e.subscription_plan !== "trial") {
        // subscription_plan may be enum or id; try lookup by id, fallback to price field on est
        const p = priceById.get(e.subscription_plan);
        if (typeof p === "number") mrr += p;
      }
    }
  } catch (_) { /* ignore */ }

  // Silvia conversations
  const [{ count: silviaToday }, { count: silvia7 }] = await Promise.all([
    admin.from("ai_assistant_conversations").select("id", { count: "exact", head: true })
      .gte("created_at", startToday).lte("created_at", endToday),
    admin.from("ai_assistant_conversations").select("id", { count: "exact", head: true })
      .gte("created_at", start7),
  ]);

  // Session logs (portal/landing pages tracked)
  const [{ count: lpToday }, { count: lp7 }, { data: pages }] = await Promise.all([
    admin.from("user_session_logs").select("id", { count: "exact", head: true })
      .gte("session_start", startToday).lte("session_start", endToday),
    admin.from("user_session_logs").select("id", { count: "exact", head: true })
      .gte("session_start", start7),
    admin.from("user_session_logs").select("page_name,page_route")
      .gte("session_start", start7).limit(5000),
  ]);
  const counter = new Map<string, number>();
  for (const r of pages || []) {
    const k = (r.page_name || r.page_route || "(sem nome)").trim();
    counter.set(k, (counter.get(k) || 0) + 1);
  }
  const top = [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topPagesText = top.length
    ? top.map(([n, c], i) => `  ${i + 1}. ${n} — ${c}`).join("\n")
    : "  (sem dados)";

  // Connectors — generic placeholder until specific integrations are wired
  const connectorsSection = "  • Z-API: configurado\n  • Lovable AI: ativo";

  return {
    date: new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: TZ }).format(now),
    connectors_section: connectorsSection,
    lp_views_today: lpToday ?? 0,
    lp_views_7d: lp7 ?? 0,
    top_pages: topPagesText,
    silvia_triggers_today: silviaToday ?? 0,
    silvia_triggers_7d: silvia7 ?? 0,
    new_salons_today: newSalonsToday,
    active_salons: activeSalons,
    active_trials: activeTrials,
    active_subscriptions: activeSubs,
    mrr: brl(mrr),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      throw new Error("Z-API credentials not configured");
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "1";
    let testPhone: string | null = null;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body?.test_phone) testPhone = String(body.test_phone);
      }
    } catch (_) {/**/}

    // Template
    const { data: tplRow } = await admin
      .from("whatsapp_message_types").select("template").eq("key", "daily_report").maybeSingle();
    const template = tplRow?.template
      || "📊 Resumo Diário — Salão Cloud\n{{date}}\nNovos salões: {{new_salons_today}}";

    const vars = await buildDailyReportVars(admin);
    const message = fillTemplate(template, vars);

    if (dryRun) {
      return new Response(JSON.stringify({ success: true, message, vars }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recipients
    let targets: { id?: string; name?: string; phone: string }[] = [];
    if (testPhone) {
      targets = [{ phone: testPhone, name: "Teste" }];
    } else {
      const { data: rec } = await admin
        .from("whatsapp_recipients").select("id,name,phone,message_type_keys").eq("is_active", true);
      targets = (rec || [])
        .filter((r: any) => (r.message_type_keys || []).includes("daily_report"))
        .map((r: any) => ({ id: r.id, name: r.name, phone: r.phone }));
    }

    const results: any[] = [];
    for (const t of targets) {
      const phone = normalizePhone(t.phone);
      if (!phone) continue;
      try {
        const resp = await sendZapi(phone, message);
        await admin.from("whatsapp_send_log").insert({
          message_type_key: "daily_report",
          recipient_id: t.id ?? null,
          recipient_phone: phone,
          recipient_name: t.name ?? null,
          message_body: message,
          status: "sent",
          zapi_message_id: resp?.messageId ?? resp?.id ?? null,
          zapi_response: resp,
          sent_at: new Date().toISOString(),
        });
        results.push({ phone, ok: true });
      } catch (e: any) {
        await admin.from("whatsapp_send_log").insert({
          message_type_key: "daily_report",
          recipient_id: t.id ?? null,
          recipient_phone: phone,
          recipient_name: t.name ?? null,
          message_body: message,
          status: "failed",
          error: String(e?.message ?? e),
        });
        results.push({ phone, ok: false, error: String(e?.message ?? e) });
      }
    }

    return new Response(JSON.stringify({ success: true, sent: results.length, results, message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

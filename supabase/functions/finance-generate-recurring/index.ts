import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Today in São Paulo timezone
  const now = new Date();
  const tz = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => tz.find(p => p.type === t)!.value;
  const year = parseInt(get("year"));
  const month = parseInt(get("month"));
  const day = parseInt(get("day"));
  const today = `${get("year")}-${get("month")}-${get("day")}`;

  // Last day of current month (handles "31" recurrences in shorter months)
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const targetDay = Math.min(day, lastDayOfMonth);

  // Fetch active templates due today
  const { data: templates, error } = await supabase
    .from("finance_recurring_templates")
    .select("*")
    .eq("is_active", true)
    .eq("day_of_month", targetDay);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let created = 0;
  for (const tpl of templates ?? []) {
    // Skip if already generated today
    const { data: existing } = await supabase
      .from("finance_entries")
      .select("id")
      .eq("recurring_template_id", tpl.id)
      .eq("date", today)
      .maybeSingle();
    if (existing) continue;

    const { error: insErr } = await supabase.from("finance_entries").insert({
      establishment_id: tpl.establishment_id,
      category_id: tpl.category_id,
      type: tpl.type,
      amount: tpl.amount,
      description: tpl.description,
      date: today,
      status: "pending",
      payment_method: null,
      recurring_template_id: tpl.id,
      created_by: tpl.created_by,
    });
    if (!insErr) created++;
  }

  return new Response(JSON.stringify({ ok: true, generated: created, date: today }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

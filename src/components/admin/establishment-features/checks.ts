import { supabase } from "@/integrations/supabase/client";
import type { BlockResult } from "./types";

const safeCount = (count: number | null | undefined) => (typeof count === "number" ? count : 0);

const emptyOrNull = (col: string) => `${col}.is.null,${col}.eq.`;

export async function checkPlanLimits(subscriptionPlan: string, isTrialPeriod: boolean): Promise<BlockResult> {
  if (!subscriptionPlan || subscriptionPlan === "trial" || isTrialPeriod) {
    return {
      status: "ok",
      summary: [
        { label: "Plano", value: subscriptionPlan || "(não informado)" },
        { label: "Modo", value: isTrialPeriod ? "Trial (todas liberadas)" : "Trial" },
      ],
      issues: [],
    };
  }

  const { data, error } = await supabase
    .from("subscription_plans")
    .select("slug, limits")
    .eq("slug", subscriptionPlan)
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      summary: [{ label: "Plano", value: subscriptionPlan }],
      details: ["Falha ao carregar limites do plano.", `${(error as any)?.code || ""} ${(error as any)?.message || ""}`.trim()],
    };
  }

  if (!data) {
    return {
      status: "warn",
      summary: [{ label: "Plano", value: subscriptionPlan }],
      details: ["Plano não encontrado na tabela de planos."],
    };
  }

  const hasLimits = !!data.limits;

  return {
    status: hasLimits ? "ok" : "warn",
    summary: [
      { label: "Plano", value: subscriptionPlan },
      { label: "Limites encontrados", value: hasLimits ? "Sim" : "Não" },
    ],
    issues: hasLimits ? [] : [{ label: "limits vazio/nulo", count: 1, hint: "Sem limites, a aba pode marcar recursos como indisponíveis." }],
  };
}

export async function checkEstablishmentProfile(establishmentId: string): Promise<BlockResult> {
  const { data, error } = await supabase
    .from("establishments")
    .select("id, name, slug, email, phone, address, city, state, zip_code, logo_url, status, subscription_plan")
    .eq("id", establishmentId)
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      summary: [{ label: "Estabelecimento", value: establishmentId }],
      details: ["Falha ao buscar cadastro do estabelecimento.", `${(error as any)?.code || ""} ${(error as any)?.message || ""}`.trim()],
    };
  }

  if (!data) {
    return {
      status: "warn",
      summary: [{ label: "Estabelecimento", value: establishmentId }],
      details: ["Nenhum registro encontrado para este estabelecimento."],
    };
  }

  const missing = {
    email: !data.email || !String(data.email).trim(),
    phone: !data.phone || !String(data.phone).trim(),
    address: !data.address || !String(data.address).trim(),
    city: !data.city || !String(data.city).trim(),
    state: !data.state || !String(data.state).trim(),
    zip: !data.zip_code || !String(data.zip_code).trim(),
    logo: !data.logo_url || !String(data.logo_url).trim(),
    slug: !data.slug || !String(data.slug).trim(),
  };

  const missingCount = Object.values(missing).filter(Boolean).length;

  return {
    status: missingCount > 0 ? "warn" : "ok",
    summary: [
      { label: "Nome", value: data.name },
      { label: "Slug", value: data.slug || "(vazio)" },
      { label: "Status", value: data.status },
      { label: "Plano", value: data.subscription_plan },
      { label: "Campos faltando", value: missingCount },
    ],
    issues: [
      { label: "Email", count: missing.email ? 1 : 0 },
      { label: "Telefone", count: missing.phone ? 1 : 0 },
      { label: "Endereço", count: missing.address ? 1 : 0 },
      { label: "Cidade", count: missing.city ? 1 : 0 },
      { label: "Estado", count: missing.state ? 1 : 0 },
      { label: "CEP", count: missing.zip ? 1 : 0 },
      { label: "Logo URL", count: missing.logo ? 1 : 0 },
      { label: "Slug", count: missing.slug ? 1 : 0 },
    ],
  };
}

export async function checkProfessionalsOverview(establishmentId: string): Promise<BlockResult> {
  const [
    totalRes,
    activeRes,
    missingHoursRes,
    missingEmailRes,
    missingPhoneRes,
  ] = await Promise.all([
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId),
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).eq("is_active", true),
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).is("working_hours", null),
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).or(emptyOrNull("email")),
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).or(emptyOrNull("phone")),
  ]);

  const errors = [totalRes, activeRes, missingHoursRes, missingEmailRes, missingPhoneRes].filter((r) => r.error);
  if (errors.length) {
    const e = errors[0].error as any;
    return {
      status: "error",
      summary: [{ label: "Profissionais", value: "Erro" }],
      details: ["Falha em uma ou mais consultas de profissionais.", `${e?.code || ""} ${e?.message || ""}`.trim()],
    };
  }

  const total = safeCount(totalRes.count);
  const active = safeCount(activeRes.count);
  const missingHours = safeCount(missingHoursRes.count);
  const missingEmail = safeCount(missingEmailRes.count);
  const missingPhone = safeCount(missingPhoneRes.count);

  const warn = total === 0 || missingHours > 0 || missingEmail > 0 || missingPhone > 0;

  return {
    status: warn ? "warn" : "ok",
    summary: [
      { label: "Total", value: total },
      { label: "Ativos", value: active },
    ],
    issues: [
      { label: "Sem horários (working_hours nulo)", count: missingHours, hint: "Profissional sem horários pode não aparecer na agenda." },
      { label: "Email vazio/nulo", count: missingEmail },
      { label: "Telefone vazio/nulo", count: missingPhone },
    ],
  };
}

export async function checkProfessionalServiceLinks(establishmentId: string): Promise<BlockResult> {
  const { data, error } = await supabase
    .from("professionals")
    .select("id, professional_services(count)")
    .eq("establishment_id", establishmentId);

  if (error) {
    return {
      status: "error",
      summary: [{ label: "Vínculo Profissional→Serviços", value: "Erro" }],
      details: ["Falha ao carregar contagem agregada de serviços por profissional.", `${(error as any)?.code || ""} ${(error as any)?.message || ""}`.trim()],
    };
  }

  const professionals = (data || []) as Array<{ id: string; professional_services?: Array<{ count: number }> }>;
  const total = professionals.length;
  const withServices = professionals.reduce((acc, p) => acc + ((p.professional_services?.[0]?.count ?? 0) > 0 ? 1 : 0), 0);
  const withoutServices = Math.max(0, total - withServices);

  return {
    status: total === 0 ? "warn" : withoutServices > 0 ? "warn" : "ok",
    summary: [
      { label: "Profissionais", value: total },
      { label: "Com serviços", value: withServices },
      { label: "Sem serviços", value: withoutServices },
    ],
    issues: [{ label: "Profissionais sem serviços vinculados", count: withoutServices, hint: "Sem serviços, podem não aparecer em seleções/agendamentos." }],
  };
}

export async function checkServices(establishmentId: string): Promise<BlockResult> {
  const [totalRes, activeRes, zeroPriceRes, noCategoryRes] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).eq("is_active", true),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).eq("price", 0),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).is("category_id", null),
  ]);

  const errors = [totalRes, activeRes, zeroPriceRes, noCategoryRes].filter((r) => r.error);
  if (errors.length) {
    const e = errors[0].error as any;
    return {
      status: "error",
      summary: [{ label: "Serviços", value: "Erro" }],
      details: ["Falha em uma ou mais consultas de serviços.", `${e?.code || ""} ${e?.message || ""}`.trim()],
    };
  }

  const total = safeCount(totalRes.count);
  const active = safeCount(activeRes.count);
  const zeroPrice = safeCount(zeroPriceRes.count);
  const noCategory = safeCount(noCategoryRes.count);

  const warn = total === 0 || zeroPrice > 0 || noCategory > 0;

  return {
    status: warn ? "warn" : "ok",
    summary: [
      { label: "Total", value: total },
      { label: "Ativos", value: active },
    ],
    issues: [
      { label: "Preço = 0", count: zeroPrice },
      { label: "Sem categoria (category_id nulo)", count: noCategory },
    ],
  };
}

export async function checkClients(establishmentId: string): Promise<BlockResult> {
  const [totalRes, missingEmailRes, missingCpfRes] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).or(emptyOrNull("email")),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).or(emptyOrNull("cpf")),
  ]);

  const errors = [totalRes, missingEmailRes, missingCpfRes].filter((r) => r.error);
  if (errors.length) {
    const e = errors[0].error as any;
    return {
      status: "error",
      summary: [{ label: "Clientes", value: "Erro" }],
      details: ["Falha em uma ou mais consultas de clientes.", `${e?.code || ""} ${e?.message || ""}`.trim()],
    };
  }

  const total = safeCount(totalRes.count);
  const missingEmail = safeCount(missingEmailRes.count);
  const missingCpf = safeCount(missingCpfRes.count);

  const warn = total > 0 && (missingEmail > 0 || missingCpf > 0);

  return {
    status: warn ? "warn" : "ok",
    summary: [{ label: "Total", value: total }],
    issues: [
      { label: "Email vazio/nulo", count: missingEmail },
      { label: "CPF vazio/nulo", count: missingCpf },
    ],
  };
}

export async function checkAppointments(establishmentId: string): Promise<BlockResult> {
  const [totalRes, completedRes, missingClientEmailRes] = await Promise.all([
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).eq("status", "completed"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).or(emptyOrNull("client_email")),
  ]);

  const errors = [totalRes, completedRes, missingClientEmailRes].filter((r) => r.error);
  if (errors.length) {
    const e = errors[0].error as any;
    return {
      status: "error",
      summary: [{ label: "Agendamentos", value: "Erro" }],
      details: ["Falha em uma ou mais consultas de agendamentos.", `${e?.code || ""} ${e?.message || ""}`.trim()],
    };
  }

  const total = safeCount(totalRes.count);
  const completed = safeCount(completedRes.count);
  const missingClientEmail = safeCount(missingClientEmailRes.count);

  const warn = total > 0 && missingClientEmail > 0;

  return {
    status: warn ? "warn" : "ok",
    summary: [
      { label: "Total", value: total },
      { label: "Concluídos", value: completed },
    ],
    issues: [{ label: "client_email vazio/nulo", count: missingClientEmail }],
  };
}

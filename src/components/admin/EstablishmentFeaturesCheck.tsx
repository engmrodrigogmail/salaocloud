import { useMemo, useRef, useState } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DiagnosticBlock, type DiagnosticBlockHandle } from "./establishment-features/DiagnosticBlock";
import {
  checkAppointments,
  checkClients,
  checkEstablishmentProfile,
  checkPlanLimits,
  checkProfessionalServiceLinks,
  checkProfessionalsOverview,
  checkServices,
} from "./establishment-features/checks";

interface Props {
  establishmentId: string;
  subscriptionPlan: string;
  isTrialPeriod: boolean;
}

type BlockDef = {
  id: string;
  title: string;
  description: string;
  defaultOpen?: boolean;
  autoRunOnOpen?: boolean;
  run: () => Promise<any>;
};

export function EstablishmentFeaturesCheck({ establishmentId, subscriptionPlan, isTrialPeriod }: Props) {
  const [runningAll, setRunningAll] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  const blockRefs = useRef<Record<string, DiagnosticBlockHandle | null>>({});

  const blocks = useMemo<BlockDef[]>(
    () => [
      {
        id: "plan",
        title: "Plano e limites",
        description: "Confere se o plano possui limites válidos (e evita falsos 'indisponível').",
        defaultOpen: true,
        autoRunOnOpen: true,
        run: () => checkPlanLimits(subscriptionPlan, isTrialPeriod),
      },
      {
        id: "establishment_profile",
        title: "Cadastro do estabelecimento (campos em branco)",
        description: "Valida campos essenciais do cadastro (email, telefone, endereço, etc.).",
        defaultOpen: true,
        autoRunOnOpen: true,
        run: () => checkEstablishmentProfile(establishmentId),
      },
      {
        id: "professionals_overview",
        title: "Profissionais (visão geral)",
        description: "Totais e campos em branco (email/telefone/horários).",
        run: () => checkProfessionalsOverview(establishmentId),
      },
      {
        id: "professional_service_links",
        title: "Vínculos: Profissional → Serviços",
        description:
          "Bloco potencialmente pesado: valida quem está sem serviços vinculados. Se travar, o gargalo está aqui.",
        run: () => checkProfessionalServiceLinks(establishmentId),
      },
      {
        id: "services",
        title: "Serviços (cadastro e inconsistências)",
        description: "Detecta serviço sem categoria, com preço zerado, etc.",
        run: () => checkServices(establishmentId),
      },
      {
        id: "clients",
        title: "Clientes (campos em branco)",
        description: "Detecta cliente sem email/CPF (vazio ou nulo).",
        run: () => checkClients(establishmentId),
      },
      {
        id: "appointments",
        title: "Agendamentos (campos em branco)",
        description: "Detecta agendamento sem client_email (vazio ou nulo) e volumes gerais.",
        run: () => checkAppointments(establishmentId),
      },
    ],
    [establishmentId, subscriptionPlan, isTrialPeriod]
  );

  const runAllSequential = async () => {
    setRunningAll(true);
    toast("Executando diagnóstico bloco a bloco…");

    try {
      for (const b of blocks) {
        const h = blockRefs.current[b.id];
        if (!h) continue;
        setActiveBlockId(b.id);
        await h.run();
      }
      toast("Diagnóstico concluído.");
    } finally {
      setActiveBlockId(null);
      setRunningAll(false);
    }
  };

  const resetAll = () => {
    blocks.forEach((b) => blockRefs.current[b.id]?.reset());
    toast("Blocos resetados.");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Diagnóstico por blocos (anti-travamento)</h3>
            <Badge variant="outline" className="bg-muted/30 text-muted-foreground">
              {establishmentId.slice(0, 8)}…
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Execute um bloco por vez para identificar exatamente qual consulta/validação está congelando.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={runningAll} onClick={runAllSequential}>
            {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="ml-2">Executar todos (sequencial)</span>
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={runningAll} onClick={resetAll}>
            <RotateCcw className="h-4 w-4" />
            <span className="ml-2">Resetar</span>
          </Button>

          {activeBlockId ? (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Rodando: {blocks.find((b) => b.id === activeBlockId)?.title ?? activeBlockId}
            </Badge>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Blocos</CardTitle>
          <CardDescription className="text-xs">
            Abra “Detalhes” para ver os itens em branco/vazios encontrados em cada área.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {blocks.map((b) => (
            <DiagnosticBlock
              key={b.id}
              id={b.id}
              title={b.title}
              description={b.description}
              defaultOpen={b.defaultOpen}
              autoRunOnOpen={b.autoRunOnOpen}
              run={b.run}
              ref={(h) => {
                blockRefs.current[b.id] = h;
              }}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

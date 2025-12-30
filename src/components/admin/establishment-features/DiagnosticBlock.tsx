import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { BlockResult, BlockStatus } from "./types";

export type DiagnosticBlockHandle = {
  run: () => Promise<{ status: BlockStatus; ms: number }>;
  reset: () => void;
};

type Props = {
  id: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  autoRunOnOpen?: boolean;
  run: () => Promise<BlockResult>;
};

export const DiagnosticBlock = forwardRef<DiagnosticBlockHandle, Props>(
  ({ title, description, defaultOpen = false, autoRunOnOpen = false, run }, ref) => {
    const [open, setOpen] = useState(defaultOpen);
    const [status, setStatus] = useState<BlockStatus>("idle");
    const [ms, setMs] = useState<number | null>(null);
    const [result, setResult] = useState<BlockResult | null>(null);
    const [errorText, setErrorText] = useState<string | null>(null);

    const badge = useMemo(() => {
      if (status === "running") {
        return { text: "Rodando…", cls: "bg-muted/40 text-muted-foreground border-border" };
      }
      if (status === "ok") {
        return { text: "OK", cls: "bg-success/10 text-success border-success/20" };
      }
      if (status === "warn") {
        return { text: "Atenção", cls: "bg-warning/10 text-warning border-warning/20" };
      }
      if (status === "error") {
        return { text: "Erro", cls: "bg-destructive/10 text-destructive border-destructive/20" };
      }
      return { text: "Não executado", cls: "bg-muted/30 text-muted-foreground border-border" };
    }, [status]);

    const icon = useMemo(() => {
      if (status === "running") return Loader2;
      if (status === "ok") return CheckCircle2;
      if (status === "warn") return TriangleAlert;
      if (status === "error") return AlertCircle;
      return CheckCircle2;
    }, [status]);

    const Icon = icon;

    const doRun = async (): Promise<{ status: BlockStatus; ms: number }> => {
      if (status === "running") return { status, ms: ms ?? 0 };

      setStatus("running");
      setErrorText(null);
      const t0 = performance.now();

      try {
        const next = await run();
        const dt = Math.round(performance.now() - t0);
        setMs(dt);
        setResult(next);
        setStatus(next.status);
        return { status: next.status as BlockStatus, ms: dt };
      } catch (e) {
        const dt = Math.round(performance.now() - t0);
        setMs(dt);
        setResult(null);
        setStatus("error");
        setErrorText(e instanceof Error ? e.message : String(e));
        return { status: "error", ms: dt };
      }
    };

    const reset = () => {
      setStatus("idle");
      setMs(null);
      setResult(null);
      setErrorText(null);
    };

    useImperativeHandle(ref, () => ({ run: doRun, reset }), [status, ms]);

    return (
      <Card>
        <Collapsible
          open={open}
          onOpenChange={async (v) => {
            setOpen(v);
            if (v && autoRunOnOpen && status === "idle") {
              await doRun();
            }
          }}
        >
          <CardHeader className="py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className={cn("h-4 w-4 shrink-0", status === "running" && "animate-spin", status === "ok" && "text-success", status === "warn" && "text-warning", status === "error" && "text-destructive", status === "idle" && "text-muted-foreground")} />
                  <span className="break-words">{title}</span>
                </CardTitle>
                {description ? (
                  <CardDescription className="text-xs mt-1">{description}</CardDescription>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("shrink-0", badge.cls)}>
                  {badge.text}{ms != null && status !== "idle" ? ` • ${ms}ms` : ""}
                </Badge>
                <Button type="button" size="sm" variant="outline" disabled={status === "running"} onClick={doRun}>
                  Rodar
                </Button>
                <CollapsibleTrigger asChild>
                  <Button type="button" size="sm" variant="secondary">
                    {open ? "Ocultar" : "Detalhes"}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-0">
              {errorText ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                  {errorText}
                </div>
              ) : null}

              {result ? (
                <div className="space-y-3">
                  {result.summary?.length ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {result.summary.map((s) => (
                        <div key={s.label} className="rounded-md border bg-muted/30 p-3">
                          <div className="text-xs text-muted-foreground">{s.label}</div>
                          <div className="text-sm font-medium">{s.value}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {result.issues?.length ? (
                    <div className="rounded-md border bg-muted/20 p-3">
                      <div className="text-xs font-medium">Itens em branco / pendências</div>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {result.issues.map((it) => (
                          <li key={it.label} className="flex items-start justify-between gap-3">
                            <span className="min-w-0 flex-1">
                              <span className="font-medium text-foreground">{it.label}</span>
                              {it.hint ? <span className="text-muted-foreground"> — {it.hint}</span> : null}
                            </span>
                            <Badge variant="outline" className={cn(it.count > 0 ? "bg-warning/10 text-warning border-warning/20" : "bg-success/10 text-success border-success/20")}>
                              {it.count}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {result.details?.length ? (
                    <div className="rounded-md border bg-muted/30 p-3">
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                        {result.details.join("\n")}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Nenhum resultado ainda.</div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }
);

DiagnosticBlock.displayName = "DiagnosticBlock";

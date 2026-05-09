import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Sparkles, Stethoscope, Heart, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Profile = "tecnico" | "acolhedor";

interface Props {
  establishmentId: string;
}

const EXAMPLES: Record<Profile, string> = {
  tecnico:
    "Seu cabelo apresenta porosidade alta nas pontas, com cutícula aberta devido a descoloração química. Recomendo Botox Capilar para preencher falhas e alinhar a fibra.",
  acolhedor:
    "Que lindo esse ombré que você tem! Seus fios estão pedindo nutrição para manter aquele brilho. Uma intervenção profissional vai resgatar todo o movimento.",
};

export function EduProfileCard({ establishmentId }: Props) {
  const [current, setCurrent] = useState<Profile>("tecnico");
  const [selected, setSelected] = useState<Profile>("tecnico");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    supabase
      .from("edu_access_control")
      .select("edu_profile")
      .eq("establishment_id", establishmentId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        const p: Profile = (data as any)?.edu_profile === "acolhedor" ? "acolhedor" : "tecnico";
        setCurrent(p);
        setSelected(p);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [establishmentId]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("edu_access_control")
      .update({ edu_profile: selected })
      .eq("establishment_id", establishmentId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message, { position: "top-center", duration: 3000 });
      return;
    }
    setCurrent(selected);
    toast.success("Perfil do Edu atualizado", { position: "top-center", duration: 2000 });
  };

  const dirty = selected !== current;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Perfil do Edu
        </CardTitle>
        <CardDescription>
          Escolha o estilo de análise que melhor combina com seu salão e seu público. Você pode trocar a qualquer momento — vale para as próximas análises.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <RadioGroup
              value={selected}
              onValueChange={(v) => setSelected(v as Profile)}
              className="grid gap-3 md:grid-cols-2"
            >
              <Label
                htmlFor="edu-tecnico"
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  selected === "tecnico" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="tecnico" id="edu-tecnico" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Stethoscope className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Edu Técnico</span>
                      <Badge variant="secondary" className="text-[10px]">Padrão</Badge>
                      {current === "tecnico" && <Badge className="bg-green-600 text-[10px]">Ativo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Análise clínica, precisa e profissional. Ideal para salões técnicos, barbershops e público que valoriza diagnóstico direto.
                    </p>
                    <p className="text-xs italic text-muted-foreground border-l-2 border-muted pl-2">
                      “{EXAMPLES.tecnico}”
                    </p>
                  </div>
                </div>
              </Label>

              <Label
                htmlFor="edu-acolhedor"
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  selected === "acolhedor" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="acolhedor" id="edu-acolhedor" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Heart className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Edu Acolhedor</span>
                      {current === "acolhedor" && <Badge className="bg-green-600 text-[10px]">Ativo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Análise positiva e celebratória, com mesmo rigor técnico. Ideal para salões femininos, público premium e foco em conversão de agendamentos.
                    </p>
                    <p className="text-xs italic text-muted-foreground border-l-2 border-muted pl-2">
                      “{EXAMPLES.acolhedor}”
                    </p>
                  </div>
                </div>
              </Label>
            </RadioGroup>

            <div className="mt-4 flex items-center justify-end gap-2">
              {!dirty && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="h-3 w-3" /> Configuração salva
                </span>
              )}
              <Button onClick={save} disabled={!dirty || saving} size="sm">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar configuração
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { InternoLayout } from "@/components/layouts/InternoLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, KeyRound, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { hashManagerPin, isValidPinFormat } from "@/lib/managerPin";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProfessionalRow {
  id: string;
  name: string;
  is_manager: boolean;
  manager_pin_hash: string | null;
  manager_pin_set_at: string | null;
  establishment_id: string;
}

export default function InternoPerfil() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prof, setProf] = useState<ProfessionalRow | null>(null);

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/interno/${slug}/perfil`);
      return;
    }
    if (slug && user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user, authLoading]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: est } = await supabase
        .from("establishments")
        .select("id")
        .eq("slug", slug)
        .single();

      if (!est) {
        navigate("/");
        return;
      }

      const { data, error: pErr } = await supabase
        .from("professionals")
        .select("id, name, is_manager, manager_pin_hash, manager_pin_set_at, establishment_id")
        .eq("establishment_id", est.id)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (pErr) throw pErr;
      setProf((data as ProfessionalRow) ?? null);
    } catch (e) {
      console.error("Error loading profile:", e);
      toast.error("Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePin = async () => {
    setError(null);

    if (!isValidPinFormat(newPin)) {
      setError("O PIN deve ter de 4 a 6 dígitos numéricos.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("Os dois PINs não conferem.");
      return;
    }
    if (!prof) return;

    setSaving(true);
    try {
      const hash = await hashManagerPin(newPin);

      const { error: uErr } = await supabase
        .from("professionals")
        .update({
          manager_pin_hash: hash,
          manager_pin_set_at: new Date().toISOString(),
        })
        .eq("id", prof.id);

      if (uErr) throw uErr;

      toast.success("PIN salvo com sucesso");
      setNewPin("");
      setConfirmPin("");
      await load();
    } catch (e) {
      console.error("Error saving PIN:", e);
      toast.error("Erro ao salvar PIN");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <InternoLayout>
        <Skeleton className="h-96" />
      </InternoLayout>
    );
  }

  if (!prof) {
    return (
      <InternoLayout>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Você não está vinculado(a) como profissional neste salão.
          </CardContent>
        </Card>
      </InternoLayout>
    );
  }

  const hasPin = !!prof.manager_pin_hash;

  return (
    <InternoLayout>
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-2xl font-bold">Meu perfil</h1>
          <p className="text-muted-foreground text-sm">
            Olá, {prof.name}.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              PIN de gerente
              {prof.is_manager ? (
                <Badge variant="default">Gerente</Badge>
              ) : (
                <Badge variant="outline">Não é gerente</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!prof.is_manager && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Apenas profissionais marcados como <b>gerente</b> pelo dono do salão
                  podem cadastrar um PIN. Peça ao dono para te marcar como gerente
                  em <i>Profissionais</i>.
                </AlertDescription>
              </Alert>
            )}

            {prof.is_manager && (
              <>
                <div className="text-sm text-muted-foreground">
                  O PIN é usado para autorizar ações sensíveis no caixa: descontos
                  acima do limite, alterar preço de um item da comanda e ajustar
                  comissões. Use 4 a 6 dígitos. Você pode trocar quando quiser.
                </div>

                {hasPin && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-500/10 rounded-md px-3 py-2">
                    <CheckCircle2 className="h-4 w-4" />
                    PIN cadastrado
                    {prof.manager_pin_set_at && (
                      <span className="text-muted-foreground">
                        · atualizado em{" "}
                        {format(parseISO(prof.manager_pin_set_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      {hasPin ? "Novo PIN" : "Definir PIN"}
                    </Label>
                    <InputOTP
                      maxLength={6}
                      value={newPin}
                      onChange={(v) => {
                        setNewPin(v.replace(/\D/g, ""));
                        setError(null);
                      }}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Confirmar PIN</Label>
                    <InputOTP
                      maxLength={6}
                      value={confirmPin}
                      onChange={(v) => {
                        setConfirmPin(v.replace(/\D/g, ""));
                        setError(null);
                      }}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {error}
                    </p>
                  )}

                  <Button
                    onClick={handleSavePin}
                    disabled={saving || newPin.length < 4 || confirmPin.length < 4}
                    className="w-full sm:w-auto"
                  >
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {hasPin ? "Atualizar PIN" : "Cadastrar PIN"}
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Nunca compartilhe seu PIN. O dono do salão também não tem acesso ao seu PIN —
                    apenas vê quando ele foi cadastrado/atualizado.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </InternoLayout>
  );
}

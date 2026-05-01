import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface ChangePasswordGateProps {
  /** Renderiza children apenas após confirmar que NÃO precisa trocar senha. */
  children: React.ReactNode;
}

/**
 * Bloqueia o /interno enquanto o profissional logado tiver must_change_password=true.
 * Ao confirmar a nova senha, atualiza auth + zera a flag.
 */
export function ChangePasswordGate({ children }: ChangePasswordGateProps) {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecking(false);
      setMustChange(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("professionals")
        .select("must_change_password")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setMustChange(Boolean((data as any)?.must_change_password));
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const handleSubmit = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem");
      return;
    }
    setSaving(true);
    try {
      const { error: pwdErr } = await supabase.auth.updateUser({ password: newPassword });
      if (pwdErr) throw pwdErr;

      const { error: flagErr } = await supabase
        .from("professionals")
        .update({ must_change_password: false } as never)
        .eq("user_id", user!.id);
      if (flagErr) throw flagErr;

      toast.success("Senha atualizada com sucesso!");
      setMustChange(false);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível atualizar a senha");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {children}
      <Dialog open={mustChange} onOpenChange={() => { /* não permite fechar */ }}>
        <DialogContent
          className="max-w-md"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Defina sua nova senha
            </DialogTitle>
            <DialogDescription>
              Por segurança, a senha provisória precisa ser trocada antes de continuar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <Alert>
              <AlertDescription className="text-xs">
                Use uma senha com pelo menos 6 caracteres. Anote em local seguro.
              </AlertDescription>
            </Alert>

            <div className="space-y-1.5">
              <Label className="text-sm">Nova senha</Label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={saving}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Confirmar senha</Label>
              <Input
                type={showPwd ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={saving}
              />
            </div>

            <Button onClick={handleSubmit} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar nova senha
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

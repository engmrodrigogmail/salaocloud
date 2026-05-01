import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProfessionalAccessSectionProps {
  establishmentId: string;
  professionalId: string;
  hasAccess: boolean; // true se professional.user_id já existe
  defaultEmail: string;
  onLinked?: () => void;
}

/**
 * Bloco "Acesso ao app" para o ProfessionalFormDialog em modo edição.
 * Permite ao dono criar a conta de login (auth.users) do profissional, escolhendo
 * uma senha inicial (mín. 6 chars). O profissional será forçado a trocá-la no 1º login.
 */
export function ProfessionalAccessSection({
  establishmentId,
  professionalId,
  hasAccess,
  defaultEmail,
  onLinked,
}: ProfessionalAccessSectionProps) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!email.trim()) {
      toast.error("Informe o email do profissional");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-professional-account", {
        body: {
          establishment_id: establishmentId,
          professional_id: professionalId,
          email: email.trim().toLowerCase(),
          password,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Conta criada! O profissional precisará trocar a senha no 1º login.");
      setPassword("");
      onLinked?.();
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("already_linked")) toast.error("Este profissional já tem conta criada");
      else if (msg.includes("password_too_short")) toast.error("Senha muito curta (mín. 6)");
      else if (msg.includes("invalid_email")) toast.error("Email inválido");
      else if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("duplicate"))
        toast.error("Este email já está em uso por outro usuário");
      else toast.error(msg || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  if (hasAccess) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-success mt-0.5" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Acesso ativo</span>
            <Badge variant="outline" className="text-xs">{defaultEmail || "—"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Este profissional já pode acessar o /interno com email e senha. Para resetar a
            senha, peça que ele use a opção “Esqueci minha senha” na tela de login.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Alert>
        <KeyRound className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Defina uma senha inicial (mín. 6 caracteres) para que este profissional acesse a área
          interna. Ele será obrigado a trocá-la no primeiro login.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Email de login *</Label>
          <Input
            type="email"
            placeholder="profissional@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Senha inicial *</Label>
          <div className="relative">
            <Input
              type={showPwd ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
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
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleCreate}
        disabled={loading}
        className="w-full sm:w-auto"
      >
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
        Criar conta de acesso
      </Button>
    </div>
  );
}

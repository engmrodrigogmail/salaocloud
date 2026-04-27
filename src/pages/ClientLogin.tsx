import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MapPin, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo-salaocloud-v5.png";

interface EstablishmentOption {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  city: string | null;
  state: string | null;
}

export default function ClientLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [establishments, setEstablishments] = useState<EstablishmentOption[] | null>(null);
  const [searchedEmail, setSearchedEmail] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      toast.error("Informe um e-mail válido", { position: "top-center", duration: 2000 });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-client-establishments", {
        body: { email: normalized },
      });

      if (error) throw error;

      const list = (data?.establishments ?? []) as EstablishmentOption[];
      setEstablishments(list);
      setSearchedEmail(normalized);
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível verificar seu cadastro. Tente novamente.", {
        position: "top-center",
        duration: 2500,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (slug: string) => {
    navigate(`/${slug}`);
  };

  const handleReset = () => {
    setEstablishments(null);
    setSearchedEmail("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
            Voltar
          </Link>
          <img src={logo} alt="Salão Cloud" className="h-8" />
          <div className="w-16" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* STEP 1: Email input */}
          {establishments === null && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Acesso do Cliente</h1>
                <p className="text-sm text-muted-foreground">
                  Informe seu e-mail para encontrarmos os salões em que você tem cadastro.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-lg p-6 shadow-sm">
                <div className="space-y-2">
                  <Label htmlFor="email">Seu e-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </form>

              <p className="text-xs text-center text-muted-foreground">
                Você só conseguirá acessar se já tiver cadastro em algum salão usando o link enviado pelo estabelecimento.
              </p>
            </div>
          )}

          {/* STEP 2a: No establishments found */}
          {establishments !== null && establishments.length === 0 && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Cadastro não encontrado</h1>
                <p className="text-sm text-muted-foreground">
                  Não localizamos nenhum cadastro para <strong>{searchedEmail}</strong>.
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 text-left space-y-3">
                <p className="text-sm">
                  Para usar o Salão Cloud como cliente, você precisa receber um <strong>link de acesso</strong> diretamente do salão onde costuma se atender.
                </p>
                <p className="text-sm text-muted-foreground">
                  Peça ao seu salão o link exclusivo dele (algo como <code className="text-xs bg-muted px-1 py-0.5 rounded">salaocloud.com.br/nome-do-salao</code>) e faça seu cadastro por lá.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={handleReset}>
                  Tentar com outro e-mail
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/">Voltar à página inicial</Link>
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2b: List establishments */}
          {establishments !== null && establishments.length > 0 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Selecione o salão</h1>
                <p className="text-sm text-muted-foreground">
                  Encontramos {establishments.length} {establishments.length === 1 ? "salão" : "salões"} com seu cadastro.
                </p>
              </div>

              <div className="space-y-3">
                {establishments.map((est) => (
                  <button
                    key={est.id}
                    onClick={() => handleSelect(est.slug)}
                    className="w-full bg-card border border-border rounded-lg p-4 hover:border-primary hover:shadow-md transition-all text-left flex items-center gap-4"
                  >
                    <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {est.logo_url ? (
                        <img src={est.logo_url} alt={est.name} className="h-full w-full object-cover" />
                      ) : (
                        <Store size={20} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{est.name}</p>
                      {(est.city || est.state) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin size={12} />
                          {[est.city, est.state].filter(Boolean).join(" - ")}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <Button variant="ghost" onClick={handleReset} className="w-full">
                Usar outro e-mail
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

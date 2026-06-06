import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Share, Plus, Check, Chrome, Apple, ShieldAlert, ChevronDown } from "lucide-react";
import logo from "@/assets/logo-salaocloud-v5.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [playProtectOpen, setPlayProtectOpen] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Listen for app installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4">
              <img src={logo} alt="Salão Cloud" className="h-24 w-auto mx-auto" />
            </div>
            <CardDescription>
              O Salão Cloud já está presente no menu e tela de ícones do seu celular.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = "/"} className="w-full">
              Abrir Sistema
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src={logo} alt="Salão Cloud" className="h-24 w-auto mx-auto" />
          </div>
          <CardTitle className="text-2xl">Instalar Salão Cloud</CardTitle>
          <CardDescription>
            Tenha acesso rápido ao app direto da sua tela inicial
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Features */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Smartphone className="h-4 w-4 text-primary" />
              <span>Acesso rápido</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Download className="h-4 w-4 text-primary" />
              <span>Funciona offline</span>
            </div>
          </div>

          {/* Install Instructions */}
          {deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full bg-gradient-primary" size="lg">
              <Download className="mr-2 h-5 w-5" />
              Instalar Agora
            </Button>
          ) : isIOS ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Apple className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium">No Safari:</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground pl-2">
                  <li className="flex items-start gap-2">
                    <Share className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Toque no botão Compartilhar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Plus className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Selecione "Adicionar à Tela de Início"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Confirme tocando em "Adicionar"</span>
                  </li>
                </ol>
              </div>
            </div>
          ) : isAndroid ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Chrome className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium">No Chrome:</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground pl-2">
                  <li>Toque no menu (três pontos) no canto superior</li>
                  <li>Selecione "Adicionar à tela inicial"</li>
                  <li>Confirme tocando em "Adicionar"</li>
                </ol>
              </div>

              {/* Play Protect Warning */}
              <div className="border border-amber-200 dark:border-amber-900/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => setPlayProtectOpen(!playProtectOpen)}
                  className="w-full flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-950/30 text-left"
                >
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Apareceu "App de risco bloqueado"?
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-amber-600 dark:text-amber-400 transition-transform ${playProtectOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {playProtectOpen && (
                  <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-3 text-sm text-amber-900 dark:text-amber-200">
                    <p>
                      O <strong>Google Play Protect</strong> pode exibir este aviso ao instalar apps
                      direto do navegador. O Salão Cloud é seguro — este alerta ocorre porque o Chrome
                      cria um app temporário (WebAPK) que o Play Protect ainda não reconhece.
                    </p>
                    <div className="bg-white dark:bg-background rounded-md p-3 border border-amber-200 dark:border-amber-900/50">
                      <p className="font-medium mb-2">Como resolver:</p>
                      <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                        <li>No aviso do Play Protect, toque em <strong>"Mais detalhes"</strong></li>
                        <li>Toque em <strong>"Instalar mesmo assim"</strong></li>
                        <li>Pronto! O app será instalado normalmente</li>
                      </ol>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>Dica:</strong> Atualize o Chrome e o Google Play Services na Play Store
                      para reduzir a chance deste aviso aparecer.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-lg p-4 text-center text-sm text-muted-foreground">
              <p>Abra este site no navegador do seu celular para instalar o app.</p>
            </div>
          )}

          <Button variant="outline" onClick={() => window.location.href = "/"} className="w-full">
            Continuar no Navegador
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

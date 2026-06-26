import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import silviaAvatar from "@/assets/silvia-avatar.png";
import { toast } from "sonner";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface SilviaHelpButtonProps {
  profile: "dono" | "profissional" | "recepcionista";
}

const STORAGE_PREFIX = "silvia_saas_help_v1_";

export function SilviaHelpButton({ profile }: SilviaHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const storageKey = `${STORAGE_PREFIX}${profile}`;

  useEffect(() => {
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      try {
        setMessages(JSON.parse(cached));
      } catch {}
    }
  }, [storageKey]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    }
  }, [messages, storageKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const greeting =
    profile === "dono"
      ? "Oi! Sou a Silvia 💜 Posso te ajudar a achar funções no painel, criar cadastros, configurar o salão. O que você precisa?"
      : profile === "recepcionista"
        ? "Oi! Sou a Silvia 💜 Posso te ajudar com comandas, agendamentos, cadastro de cliente balcão e formas de pagamento. Em que posso ajudar?"
        : "Oi! Sou a Silvia 💜 Posso te ajudar com agenda, comandas e o seu perfil. Em que posso ajudar?";

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    // garante consistência ao reaproveitar a função sem digitar input
    void text;
    if (!text || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/silvia-saas-help`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: next,
          context: { profile, route: location.pathname },
        }),
      });

      if (resp.status === 429) {
        toast.error("Muitas mensagens. Aguarde um instante.");
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("Créditos da IA esgotados. Avise o administrador.");
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let added = false;
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              acc += delta;
              if (!added) {
                added = true;
                setMessages((prev) => [...prev, { role: "assistant", content: acc }]);
              } else {
                setMessages((prev) =>
                  prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: acc } : m,
                  ),
                );
              }
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Não consegui responder agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(storageKey);
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Abrir Silvia (ajuda)"
        >
          <img
            src={silviaAvatar}
            alt="Silvia"
            className="h-12 w-12 rounded-full object-cover"
          />
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-background" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50 bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col",
            "bottom-4 right-4 left-4 sm:left-auto sm:w-[380px]",
            "h-[min(80vh,560px)]",
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-3 border-b border-border bg-primary/5">
            <img
              src={silviaAvatar}
              alt="Silvia"
              className="h-9 w-9 rounded-full object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm flex items-center gap-1">
                Silvia <Sparkles className="h-3 w-3 text-primary" />
              </div>
              <div className="text-xs text-muted-foreground">
                Ajuda do sistema
              </div>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="text-xs h-7"
              >
                Limpar
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-8 w-8"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="p-3 space-y-3 overflow-y-auto h-full">
              {messages.length === 0 && (
                <div className="flex gap-2">
                  <img
                    src={silviaAvatar}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover shrink-0"
                  />
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 text-sm">
                    {greeting}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-2",
                    m.role === "user" ? "flex-row-reverse" : "",
                  )}
                >
                  {m.role === "assistant" && (
                    <img
                      src={silviaAvatar}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover shrink-0"
                    />
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm max-w-[85%] break-words",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted rounded-tl-sm",
                    )}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1 [&_ul]:pl-4 [&_ol]:pl-4">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-2">
                  <img
                    src={silviaAvatar}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover shrink-0"
                  />
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-border flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Como cadastro uma forma de pagamento?"
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Registro do Service Worker (PWA) com proteções:
// - Não registra dentro de iframes (editor/preview do Lovable)
// - Não registra em hosts de preview
// - Em ambientes bloqueados, remove qualquer SW antigo para evitar cache obsoleto
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (isInIframe || isPreviewHost) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  } else {
    // Produção (domínio publicado / customizado): registra o SW gerado pelo vite-plugin-pwa
    window.addEventListener("load", () => {
      import("virtual:pwa-register")
        .then(({ registerSW }) => {
          registerSW({ immediate: true });
        })
        .catch(() => {
          // silencia se o módulo não estiver disponível (ex: dev)
        });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);

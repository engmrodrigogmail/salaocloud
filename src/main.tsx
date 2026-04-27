import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Limpa service workers e caches antigos que podem estar servindo bundles desatualizados
// (especialmente da rota /auth, que estava com inputs travados em sessões antigas).
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        console.info("[BootDebug] unregistering service worker", registration.scope);
        registration.unregister().catch((err) => {
          console.warn("[BootDebug] failed to unregister service worker", err);
        });
      });
    })
    .catch((err) => {
      console.warn("[BootDebug] could not list service worker registrations", err);
    });

  if ("caches" in window) {
    caches
      .keys()
      .then((keys) => {
        keys.forEach((key) => {
          console.info("[BootDebug] deleting cache", key);
          caches.delete(key).catch((err) => {
            console.warn("[BootDebug] failed to delete cache", key, err);
          });
        });
      })
      .catch((err) => {
        console.warn("[BootDebug] could not list caches", err);
      });
  }
}

createRoot(document.getElementById("root")!).render(<App />);

/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache (manifest injetado pelo vite-plugin-pwa em build)
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Cache de imagens
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// SPA navigation
registerRoute(new NavigationRoute(new NetworkFirst({ cacheName: 'html', networkTimeoutSeconds: 3 })));

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// =================== PUSH NOTIFICATIONS ===================
self.addEventListener('push', (event) => {
  let payload = { title: 'Salão Cloud', body: 'Você tem uma nova notificação', url: '/', data: {} };
  try {
    if (event.data) {
      const json = event.data.json();
      payload = { ...payload, ...json };
    }
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    data: { url: payload.url || '/', ...payload.data },
    tag: payload.tag,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Tenta focar uma janela aberta no mesmo domínio
      for (const client of clients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        } catch {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

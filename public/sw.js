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
function getDeviceType() {
  try {
    const ua = (self.navigator?.userAgent || '').toLowerCase();
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    if (ua.includes('linux')) return 'linux';
  } catch {}
  return 'unknown';
}

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

  const data = payload.data || {};
  const category = payload.category || data.category || payload.tag || '';
  const uniqueTagSuffix =
    data.notification_id ||
    data.appointment_id ||
    data.tab_id ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const notificationTag = (payload.tag || category)
    ? `${String(payload.tag || category).slice(0, 48)}-${String(uniqueTagSuffix).slice(0, 36)}`
    : undefined;
  // Categorias críticas pedem interação explícita do usuário
  const isCritical = payload.is_critical === true || [
    'new_appointment',
    'cancelled_appointment',
    'appointment_confirmation',
    'appointment_reminder',
    'review_request',
  ].includes(category);

  const deviceType = getDeviceType();

  // ✅ IMPORTANTE: Para garantir que notificações apareçam na tela bloqueada:
  // - requireInteraction: true (em críticas) mantém a notificação visível até interação
  // - silent: false garante que som/vibração do canal de notificação sejam tocados
  // - sound: 'default' é uma dica para alguns navegadores (não-padrão; ignorado em outros)
  // - renotify: true faz notificações com mesma tag "piscarem" novamente
  // - urgency: "high" + TTL no envio (web-push.ts) força entrega heads-up via FCM/APNs
  const options = {
    body: payload.body,
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    data: {
      url: payload.url || '/',
      category,
      device_type: deviceType,
      is_critical: isCritical,
      ...data,
    },
    tag: notificationTag,
    renotify: true,
    requireInteraction: isCritical,
    silent: false,
    sound: 'default',
    vibrate: isCritical ? [200, 100, 200, 100, 200] : [200, 100, 200],
    timestamp: Date.now(),
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' },
    ],
  };
  if (payload.image) options.image = payload.image;

  event.waitUntil((async () => {
    try {
      console.log('[push-notification] Mostrando notificação:', {
        title: payload.title,
        category,
        isCritical,
        deviceType,
        requireInteraction: isCritical,
        tag: notificationTag,
        timestamp: new Date().toISOString(),
      });
      await self.registration.showNotification(payload.title || 'Salão Cloud', options);
    } catch (e) {
      console.error('[push-notification] Erro ao mostrar notificação:', e);
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Prioriza janela já no mesmo destino
    for (const client of clientsList) {
      try {
        if (client.url === absoluteUrl && 'focus' in client) return client.focus();
      } catch {}
    }
    // Senão, navega a primeira janela do mesmo domínio
    for (const client of clientsList) {
      try {
        const url = new URL(client.url);
        if (url.origin === self.location.origin && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(absoluteUrl);
              return;
            } catch {}
          } else {
            return;
          }
        }
      } catch {}
    }
    if (self.clients.openWindow) return self.clients.openWindow(absoluteUrl);
  })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  // Reinscreve automaticamente quando o navegador rotaciona o endpoint
  event.waitUntil((async () => {
    try {
      const oldEndpoint = event.oldSubscription?.endpoint;
      const appServerKey = event.oldSubscription?.options?.applicationServerKey;
      if (!appServerKey) return;
      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientsList) {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', oldEndpoint, newEndpoint: newSub.endpoint });
      }
    } catch (e) {
      // best-effort
    }
  })());
});

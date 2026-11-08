// Notifications « compo » : chargé par le service worker de l'app (vite-plugin-pwa, workbox.importScripts).
// Le Mac envoie { title, body, url } quand la composition d'un match est publiée.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'SearchL1', {
    body: data.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: data.tag,
    data: { url: data.url || './' },
  }));
});

// Toucher la notification ouvre l'app sur la page indiquée (le match).
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = wins.find(w => w.url.startsWith(self.registration.scope));
    if (app) { await app.focus(); return app.navigate(url); }
    return self.clients.openWindow(url);
  })());
});

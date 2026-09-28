/* JTProQuotes service worker — phone notifications only.
   It does not cache the app, so an update is never stuck behind an old copy. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "JTProQuotes", body: event.data ? event.data.text() : "" }; }
  const title = d.title || "JTProQuotes";
  const opts = {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    requireInteraction: false,
    vibrate: [200, 100, 200, 100, 300],
    data: { url: d.url || "/" },
  };
  event.waitUntil((async () => {
    await self.registration.showNotification(title, opts);
    // A dot/number on the app icon until it's opened.
    try {
      if (self.navigator && self.navigator.setAppBadge) {
        const shown = await self.registration.getNotifications();
        await self.navigator.setAppBadge(shown.length || 1);
      }
    } catch (e) {}
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of list) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        c.postMessage({ type: "open-url", url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});

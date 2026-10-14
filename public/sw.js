// Service Worker: hält die App-Oberfläche offline verfügbar, damit Lernen ohne Netz funktioniert.
const CACHE = "jarvis-v4";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/aufgaben", "/stundenplan", "/kalender", "/lernplan", "/vorlesungen", "/lernen", "/fokus", "/studium", "/pharmazie", "/links", "/karten", "/statistik"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // Netz zuerst, bei Offline aus dem Cache.
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then((hit) => hit ?? (request.mode === "navigate" ? caches.match("/") : undefined)),
      ),
  );
});

// Push-Nachrichten von Jarvis (Erinnerungen an Aufgaben, Prüfungen, Lektionen)
self.addEventListener("push", (e) => {
  let msg = { title: "Jarvis", body: "", url: "/" };
  try {
    msg = { ...msg, ...e.data.json() };
  } catch {
    if (e.data) msg.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: msg.tag,
      data: { url: msg.url },
    }),
  );
});

// Antippen öffnet die passende Seite (oder holt ein offenes Jarvis-Fenster nach vorne)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url ?? "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((c) => (c ?? open).focus());
      return self.clients.openWindow(url);
    }),
  );
});


/* Daftarak Service Worker — local notifications + click routing.
   NOTE: no fetch handler yet — offline caching is intentionally deferred. */

self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Receive messages from the app to schedule a notification
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SHOW_NOTIFICATION") {
    const { title, body, url, tag } = data.payload || {};
    self.registration.showNotification(title || "دفترك", {
      body: body || "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: tag || "daftarak",
      dir: "rtl",
      lang: "ar",
      data: { url: url || "/app" },
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      for (const c of all) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// Optional periodic background sync (Chromium/Android only)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "daftarak-check") {
    event.waitUntil(
      self.registration.showNotification("دفترك", {
        body: "افتح التطبيق لمراجعة التذكيرات المستحقة اليوم.",
        icon: "/favicon.ico",
        tag: "daftarak-periodic",
        dir: "rtl",
        lang: "ar",
        data: { url: "/app/followup" },
      }),
    );
  }
});

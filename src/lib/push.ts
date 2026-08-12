/* PWA notification helpers: register SW, ask permission, show via SW for background-capable alerts */

let swReg: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  if (swReg) return swReg;
  try {
    swReg = await navigator.serviceWorker.register("/sw.js");
    // Try to enable periodic background sync (Chromium only)
    try {
      type PeriodicSyncReg = ServiceWorkerRegistration & {
        periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
      };
      const status = await navigator.permissions.query({
        name: "periodic-background-sync" as PermissionName,
      });
      const reg = swReg as PeriodicSyncReg;
      if (status.state === "granted" && reg.periodicSync) {
        await reg.periodicSync.register("daftarak-check", {
          minInterval: 12 * 60 * 60 * 1000,
        });
      }
    } catch {
      /* not supported */
    }
    return swReg;
  } catch {
    return null;
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

export async function notify(title: string, body: string, url = "/app/followup", tag = "daftarak") {
  const ok = typeof Notification !== "undefined" && Notification.permission === "granted";
  if (!ok) return;
  const reg = await registerServiceWorker();
  if (reg) {
    reg.showNotification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag,
      dir: "rtl",
      lang: "ar",
      data: { url },
    } as NotificationOptions);
  } else {
    try {
      new Notification(title, { body, icon: "/favicon.ico" });
    } catch {
      /* ignore */
    }
  }
}

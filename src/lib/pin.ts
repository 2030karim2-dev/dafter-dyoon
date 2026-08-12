// Simple SHA-256 PIN hashing using SubtleCrypto (no plaintext storage)
export async function hashPin(pin: string, userId: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// All keys are scoped per user id so that signing out and into a different
// account on the same device/browser tab never inherits the previous
// account's unlock state or lockout timer.
const lockKey = (uid: string) => `daftarak.locked.until.${uid}`;
const sessionKey = (uid: string) => `daftarak.unlocked.${uid}`;
const SESSION_PREFIX = "daftarak.unlocked.";

export const isUnlocked = (uid: string) => sessionStorage.getItem(sessionKey(uid)) === "1";
export const markUnlocked = (uid: string) => sessionStorage.setItem(sessionKey(uid), "1");

/** Locks `uid` when provided; otherwise wipes every account's unlock flag. */
export const markLocked = (uid?: string) => {
  if (uid) {
    sessionStorage.removeItem(sessionKey(uid));
    return;
  }
  const doomed: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(SESSION_PREFIX)) doomed.push(k);
  }
  doomed.forEach((k) => sessionStorage.removeItem(k));
};

export const setLockedUntil = (uid: string, ms: number) =>
  localStorage.setItem(lockKey(uid), String(Date.now() + ms));
export const getLockRemaining = (uid: string) => {
  const v = Number(localStorage.getItem(lockKey(uid)) ?? 0);
  return Math.max(0, v - Date.now());
};
export const clearLockTimer = (uid: string) => localStorage.removeItem(lockKey(uid));

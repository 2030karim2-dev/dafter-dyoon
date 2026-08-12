// Simple SHA-256 PIN hashing using SubtleCrypto (no plaintext storage)
export async function hashPin(pin: string, userId: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const LOCK_KEY = "daftarak.locked.until";
const SESSION_KEY = "daftarak.unlocked";

export const isUnlocked = () => sessionStorage.getItem(SESSION_KEY) === "1";
export const markUnlocked = () => sessionStorage.setItem(SESSION_KEY, "1");
export const markLocked = () => sessionStorage.removeItem(SESSION_KEY);

export const setLockedUntil = (ms: number) =>
  localStorage.setItem(LOCK_KEY, String(Date.now() + ms));
export const getLockRemaining = () => {
  const v = Number(localStorage.getItem(LOCK_KEY) ?? 0);
  return Math.max(0, v - Date.now());
};
export const clearLockTimer = () => localStorage.removeItem(LOCK_KEY);

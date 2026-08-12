import { uploadBackup } from "./upload";

// Scoped per user so accounts sharing a device back up independently.
const freqKey = (userId: string) => `daftarak.backup.lastAuto.${userId}`;

export async function maybeRunAutoBackup(
  userId: string,
  frequency: "off" | "daily" | "weekly" | "monthly",
) {
  if (frequency === "off") return;
  const last = Number(
    localStorage.getItem(freqKey(userId)) ?? localStorage.getItem("daftarak.backup.lastAuto") ?? 0,
  );
  const ms = Date.now() - last;
  const day = 24 * 60 * 60 * 1000;
  const need = frequency === "daily" ? day : frequency === "weekly" ? 7 * day : 30 * day;
  if (ms < need) return;
  const r = await uploadBackup(userId, "auto");
  if (r) localStorage.setItem(freqKey(userId), String(Date.now()));
}

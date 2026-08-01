import { supabase } from "@/integrations/supabase/client";
import type { BackupSnapshot } from "./snapshot";

export async function downloadBackup(path: string): Promise<BackupSnapshot | null> {
  const { data, error } = await supabase.storage.from("backups").download(path);
  if (error || !data) return null;
  return JSON.parse(await data.text()) as BackupSnapshot;
}

export async function restoreFromSnapshot(userId: string, snap: BackupSnapshot, mode: "merge" | "replace"): Promise<number> {
  if (mode === "replace") {
    const tables = ["transactions", "reminders", "recurring_rules", "people"];
    for (const t of tables) await (supabase.from(t as never) as never as { delete: () => { eq: (k: string, v: string) => Promise<unknown> } }).delete().eq("user_id", userId);
  }
  const lookupMap: Array<[string, unknown[]]> = [
    ["currencies", snap.currencies],
  ];
  for (const [table, rows] of lookupMap) {
    if (!Array.isArray(rows) || !rows.length) continue;
    const cleaned = rows.map((r) => ({ ...(r as Record<string, unknown>), user_id: userId }));
    await (supabase.from(table as never) as never as { upsert: (rows: unknown[], opts: { onConflict: string }) => Promise<{ error: unknown }> })
      .upsert(cleaned, { onConflict: "id" });
  }

  const map: Array<[string, unknown[]]> = [
    ["people", snap.people],
    ["transactions", snap.transactions],
    ["reminders", snap.reminders], ["recurring_rules", snap.recurring],
  ];
  let total = 0;
  for (const [table, rows] of map) {
    if (!Array.isArray(rows) || !rows.length) continue;
    const cleaned = rows.map((r) => { const { id: _id, ...rest } = r as Record<string, unknown>; return { ...rest, user_id: userId }; });
    const { error } = await (supabase.from(table as never) as never as { insert: (rows: unknown[]) => Promise<{ error: unknown }> }).insert(cleaned);
    if (!error) total += cleaned.length;
  }
  return total;
}

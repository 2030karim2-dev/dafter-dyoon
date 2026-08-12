import { supabase } from "@/integrations/supabase/client";
import { buildSnapshot } from "./snapshot";

export async function uploadBackup(
  userId: string,
  kind: "manual" | "auto",
): Promise<{ path: string; size: number } | null> {
  const snap = await buildSnapshot(userId);
  const json = JSON.stringify(snap);
  const blob = new Blob([json], { type: "application/json" });
  const path = `${userId}/${kind}-${Date.now()}.json`;
  const { error } = await supabase.storage
    .from("backups")
    .upload(path, blob, { contentType: "application/json", upsert: false });
  if (error) return null;
  await supabase.from("backup_meta").insert({ user_id: userId, path, size_bytes: blob.size, kind });

  const { data: list } = await supabase
    .from("backup_meta")
    .select("id, path")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (list && list.length > 10) {
    const old = list.slice(10);
    await supabase.storage.from("backups").remove(old.map((x) => x.path));
    await supabase
      .from("backup_meta")
      .delete()
      .in(
        "id",
        old.map((x) => x.id),
      );
  }
  return { path, size: blob.size };
}

export async function listBackups(userId: string) {
  const { data } = await supabase
    .from("backup_meta")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function deleteBackup(id: string, path: string) {
  await supabase.storage.from("backups").remove([path]);
  await supabase.from("backup_meta").delete().eq("id", id);
}

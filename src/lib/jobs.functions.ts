/**
 * Backend "brain" — per-user server functions.
 * These run on the server, scoped to the authenticated user via RLS.
 * Client UI calls them via useServerFn; the bearer is attached automatically.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { processRecurring } from "@/lib/jobs/recurring.server";

/** Sync reminders from unpaid transactions with due_date. Idempotent. */
export const syncRemindersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: txns } = await supabase
      .from("transactions")
      .select("id,person_id,details,amount,due_date,is_paid")
      .eq("user_id", userId)
      .eq("is_paid", false)
      .not("due_date", "is", null);

    if (!txns || txns.length === 0) return { created: 0 };

    const ids = txns.map((t) => t.id);
    const { data: existing } = await supabase
      .from("reminders")
      .select("transaction_id")
      .in("transaction_id", ids);
    const have = new Set((existing ?? []).map((e) => e.transaction_id));

    const personIds = Array.from(new Set(txns.map((t) => t.person_id).filter(Boolean))) as string[];
    const { data: people } = personIds.length
      ? await supabase.from("people").select("id,name").in("id", personIds)
      : { data: [] as { id: string; name: string }[] };
    const nameOf = new Map((people ?? []).map((p) => [p.id, p.name]));

    const toInsert = txns
      .filter((t) => !have.has(t.id))
      .map((t) => ({
        user_id: userId,
        person_id: t.person_id,
        transaction_id: t.id,
        title: `استحقاق دين${t.person_id ? ` — ${nameOf.get(t.person_id) ?? ""}` : ""}`,
        note: t.details ?? null,
        due_date: t.due_date as string,
        repeat: "none" as const,
      }));

    if (toInsert.length === 0) return { created: 0 };
    const { error } = await supabase.from("reminders").insert(toInsert);
    if (error) return { created: 0, error: error.message };
    return { created: toInsert.length };
  });

/** Process all due recurring rules for current user. Returns generated count. */
export const processRecurringFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { generated } = await processRecurring(supabase, userId);
    return { generated };
  });

/** Create a backup snapshot + upload to storage. */
export const createBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [people, txs, currencies, reminders, recurring] = await Promise.all([
      supabase.from("people").select("*"),
      supabase.from("transactions").select("*"),
      supabase.from("currencies").select("*"),
      supabase.from("reminders").select("*"),
      supabase.from("recurring_rules").select("*"),
    ]);
    const snap = {
      version: 1,
      exportedAt: new Date().toISOString(),
      user_id: userId,
      people: people.data ?? [],
      transactions: txs.data ?? [],
      currencies: currencies.data ?? [],
      reminders: reminders.data ?? [],
      recurring: recurring.data ?? [],
    };
    const json = JSON.stringify(snap);
    const blob = new Blob([json], { type: "application/json" });
    const path = `${userId}/auto-${Date.now()}.json`;
    const { error } = await supabase.storage.from("backups").upload(path, blob, {
      contentType: "application/json",
      upsert: false,
    });
    if (error) return { ok: false as const, error: error.message };
    await supabase.from("backup_meta").insert({
      user_id: userId,
      path,
      size_bytes: blob.size,
      kind: "auto",
    });

    // Retention: keep last 10
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
    return { ok: true as const, path, size: blob.size };
  });

/** Fetch the per-user dashboard summary (counts, totals) — pure server compute. */
export const getDashboardSummaryFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ count: peopleCount }, { count: txCount }, { count: pendingReminders }] =
      await Promise.all([
        supabase
          .from("people")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_archived", false),
        supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("reminders")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_done", false)
          .lte("due_date", new Date().toISOString()),
      ]);
    return {
      people: peopleCount ?? 0,
      transactions: txCount ?? 0,
      pendingReminders: pendingReminders ?? 0,
    };
  });

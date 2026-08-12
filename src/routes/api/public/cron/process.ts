/**
 * Cron entrypoint — called by pg_cron via pg_net.
 * Iterates ALL users (admin client), runs reminders sync, recurring rules,
 * and per-user auto-backup based on profile.backup_frequency.
 *
 * Auth: requires apikey header matching SUPABASE_PUBLISHABLE_KEY.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";

type Freq = "daily" | "weekly" | "monthly" | "yearly";

function advance(d: Date, freq: Freq): Date {
  const n = new Date(d);
  if (freq === "daily") n.setDate(n.getDate() + 1);
  else if (freq === "weekly") n.setDate(n.getDate() + 7);
  else if (freq === "monthly") n.setMonth(n.getMonth() + 1);
  else if (freq === "yearly") n.setFullYear(n.getFullYear() + 1);
  return n;
}

async function runForUser(supabaseAdmin: SupabaseClient, userId: string) {
  const stats: {
    reminders: number;
    recurring: number;
    backup: boolean | string;
    followup?: unknown;
    digest?: unknown;
  } = { reminders: 0, recurring: 0, backup: false };

  // --- Reminders sync ---
  const { data: txns } = await supabaseAdmin
    .from("transactions")
    .select("id,person_id,details,due_date")
    .eq("user_id", userId)
    .eq("is_paid", false)
    .not("due_date", "is", null);
  if (txns && txns.length) {
    const ids = txns.map((t) => t.id);
    const { data: existing } = await supabaseAdmin
      .from("reminders")
      .select("transaction_id")
      .in("transaction_id", ids);
    const have = new Set((existing ?? []).map((e) => e.transaction_id));
    const personIds = Array.from(new Set(txns.map((t) => t.person_id).filter(Boolean))) as string[];
    const { data: people } = personIds.length
      ? await supabaseAdmin.from("people").select("id,name").in("id", personIds)
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
        due_date: t.due_date,
        repeat: "none",
      }));
    if (toInsert.length) {
      const { error } = await supabaseAdmin.from("reminders").insert(toInsert);
      if (!error) stats.reminders = toInsert.length;
    }
  }

  // --- Recurring rules ---
  const now = new Date();
  const { data: rules } = await supabaseAdmin
    .from("recurring_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .lte("next_run", now.toISOString());
  for (const r of rules ?? []) {
    let next = new Date(r.next_run);
    let safety = 0;
    while (next <= now && safety < 24) {
      if (r.person_id && r.direction) {
        const { error } = await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          person_id: r.person_id,
          amount: r.amount,
          currency_id: r.currency_id,
          direction: r.direction,
          details: r.note ?? r.title,
          transaction_date: next.toISOString(),
        });
        if (error) break;
      }
      stats.recurring++;
      next = advance(next, r.frequency as Freq);
      safety++;
    }
    await supabaseAdmin
      .from("recurring_rules")
      .update({
        next_run: next.toISOString(),
        last_run: now.toISOString(),
      })
      .eq("id", r.id);
  }

  // --- Auto backup based on profile.backup_frequency ---
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("backup_frequency")
    .eq("user_id", userId)
    .maybeSingle();
  const freq = (profile?.backup_frequency ?? "off") as "off" | "daily" | "weekly" | "monthly";
  if (freq !== "off") {
    const { data: lastBackup } = await supabaseAdmin
      .from("backup_meta")
      .select("created_at")
      .eq("user_id", userId)
      .eq("kind", "auto")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const day = 86400000;
    const need = freq === "daily" ? day : freq === "weekly" ? 7 * day : 30 * day;
    const lastMs = lastBackup ? new Date(lastBackup.created_at).getTime() : 0;
    if (Date.now() - lastMs >= need) {
      const [people, txs, currencies, reminders, recurring] = await Promise.all([
        supabaseAdmin.from("people").select("*").eq("user_id", userId),
        supabaseAdmin.from("transactions").select("*").eq("user_id", userId),
        supabaseAdmin.from("currencies").select("*").eq("user_id", userId),
        supabaseAdmin.from("reminders").select("*").eq("user_id", userId),
        supabaseAdmin.from("recurring_rules").select("*").eq("user_id", userId),
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
      const path = `${userId}/auto-${Date.now()}.json`;
      const { error } = await supabaseAdmin.storage.from("backups").upload(path, json, {
        contentType: "application/json",
        upsert: false,
      });
      if (!error) {
        await supabaseAdmin.from("backup_meta").insert({
          user_id: userId,
          path,
          size_bytes: json.length,
          kind: "auto",
        });
        stats.backup = path;
      } else {
        stats.backup = `error: ${error.message}`;
      }
    }
  }

  // --- Follow-up engine: queue due reminders, auto-deliver, owner digest ---
  try {
    const { runFollowupCycle, sendDigest } = await import("@/lib/followup/engine.server");
    const cycle = await runFollowupCycle(supabaseAdmin, userId, { deliverNow: true });
    stats.followup = cycle;
    stats.digest = await sendDigest(supabaseAdmin, userId);
  } catch (e: unknown) {
    stats.followup = { error: e instanceof Error ? e.message : "failed" };
  }

  return stats;
}

export const Route = createFileRoute("/api/public/cron/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Dedicated cron secret — NEVER the publishable key (that ships to the browser).
        // Accept either "Authorization: Bearer <secret>" or "x-cron-secret" header.
        const auth = request.headers.get("authorization") ?? "";
        const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        const provided = bearer || request.headers.get("x-cron-secret") || "";
        const expected = process.env.CRON_SECRET ?? "";
        if (!expected || !provided || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Iterate distinct users from profiles
        const { data: profiles, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("user_id");
        if (pErr) {
          return new Response(JSON.stringify({ error: pErr.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        const results: Record<string, unknown> = {};
        let totalReminders = 0,
          totalRecurring = 0,
          totalBackups = 0;
        for (const p of profiles ?? []) {
          try {
            const s = await runForUser(supabaseAdmin, p.user_id);
            results[p.user_id] = s;
            totalReminders += s.reminders;
            totalRecurring += s.recurring;
            if (s.backup) totalBackups++;
          } catch (e: unknown) {
            results[p.user_id] = { error: e instanceof Error ? e.message : "failed" };
          }
        }
        return new Response(
          JSON.stringify({
            ok: true,
            users: profiles?.length ?? 0,
            totals: { reminders: totalReminders, recurring: totalRecurring, backups: totalBackups },
            at: new Date().toISOString(),
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});

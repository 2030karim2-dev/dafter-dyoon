/**
 * Shared recurring-rules processor — single source of truth.
 *
 * Used by:
 *   - processRecurringFn (src/lib/jobs.functions.ts) — per-user server fn
 *   - cron/process.ts — service-role cron runner
 *
 * Concurrency safety: every rule is "claimed" atomically with a
 * compare-and-swap UPDATE (WHERE next_run = <old value>). Only the runner
 * that wins the claim generates the missed transactions, so an idle-time
 * client call overlapping a cron tick can never double-insert.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Freq = "daily" | "weekly" | "monthly" | "yearly";

interface RecurringRule {
  id: string;
  user_id: string;
  kind: string;
  amount: number;
  currency_id: string;
  note: string | null;
  person_id: string | null;
  direction: string | null;
  frequency: Freq;
  next_run: string;
  is_active: boolean;
  title: string;
}

function advance(d: Date, freq: Freq): Date {
  const n = new Date(d);
  if (freq === "daily") n.setDate(n.getDate() + 1);
  else if (freq === "weekly") n.setDate(n.getDate() + 7);
  else if (freq === "monthly") n.setMonth(n.getMonth() + 1);
  else if (freq === "yearly") n.setFullYear(n.getFullYear() + 1);
  return n;
}

export interface RecurringStats {
  generated: number;
  rules: number;
}

/**
 * Generate every due occurrence of `userId`'s active rules through `db`.
 * `db` may be an authenticated (RLS-scoped) client or the service-role admin.
 */
export async function processRecurring(
  db: SupabaseClient,
  userId: string,
): Promise<RecurringStats> {
  const now = new Date();
  const { data: rules } = await db
    .from("recurring_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .lte("next_run", now.toISOString());

  if (!rules || rules.length === 0) return { generated: 0, rules: 0 };

  let generated = 0;
  let claimedRules = 0;

  for (const raw of rules) {
    const r = raw as RecurringRule;
    try {
      // Build the missed window and the new next_run before claiming.
      const missed: Date[] = [];
      let next = new Date(r.next_run);
      let safety = 0;
      while (next <= now && safety < 24) {
        missed.push(next);
        next = advance(next, r.frequency);
        safety++;
      }
      const newNext = next.toISOString();

      // Atomic claim: only the runner that flips next_run (CAS on the old
      // value) is allowed to generate — every concurrent runner skips it.
      const { data: claimed, error: claimErr } = await db
        .from("recurring_rules")
        .update({ next_run: newNext, last_run: now.toISOString() })
        .eq("id", r.id)
        .eq("next_run", r.next_run)
        .eq("is_active", true)
        .select("id");

      if (claimErr) {
        console.error("[recurring] claim failed", r.id, claimErr.message);
        continue;
      }
      if (!claimed || claimed.length === 0) continue; // lost the race

      if (r.person_id && r.direction && missed.length > 0) {
        const { error: insertErr } = await db.from("transactions").insert(
          missed.map((d) => ({
            user_id: userId,
            person_id: r.person_id,
            amount: r.amount,
            currency_id: r.currency_id,
            direction: r.direction,
            details: r.note ?? r.title,
            transaction_date: d.toISOString(),
          })),
        );
        if (insertErr) {
          console.error("[recurring] insert failed", r.id, insertErr.message);
        } else {
          generated += missed.length;
        }
      }
      claimedRules += 1;
    } catch (e) {
      console.error("[recurring] rule failed", r.id, e);
    }
  }

  return { generated, rules: claimedRules };
}

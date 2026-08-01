/**
 * Server-only payment engine.
 * A payment is applied FIFO to the customer's OLDEST outstanding debts,
 * strictly inside a single currency (currencies never mix).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient<any, any, any>;

export interface RecordPaymentInput {
  person_id: string;
  currency_id: string;
  amount: number;
  paid_at: string;      // ISO
  note?: string | null;
}

export interface RecordPaymentResult {
  payment_tx_id: string;
  allocated: number;
  unallocated: number;
  settled_tx_ids: string[];
}

interface DebtRow {
  id: string;
  amount: number | string;
  transaction_date: string;
  due_date: string | null;
}

/** Outstanding amount of a debt = amount - already allocated payments. */
function outstanding(debt: DebtRow, allocatedByTx: Map<string, number>) {
  return Number(debt.amount) - (allocatedByTx.get(debt.id) ?? 0);
}

export async function recordPayment(
  supabase: DB,
  userId: string,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  const amount = Number(input.amount);
  if (!(amount > 0)) throw new Error("مبلغ الدفعة غير صحيح");

  // 1) the payment itself is a debit movement in that currency
  const { data: payment, error: payErr } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      person_id: input.person_id,
      currency_id: input.currency_id,
      amount,
      direction: "debit",
      details: input.note?.trim() ? input.note.trim() : "دفعة من العميل",
      transaction_date: input.paid_at,
      is_paid: true,
    })
    .select("id")
    .single();
  if (payErr || !payment) throw new Error(payErr?.message ?? "فشل تسجيل الدفعة");

  // 2) oldest-first outstanding debts in the SAME currency
  const { data: debtsRaw } = await supabase
    .from("transactions")
    .select("id,amount,transaction_date,due_date")
    .eq("user_id", userId)
    .eq("person_id", input.person_id)
    .eq("currency_id", input.currency_id)
    .eq("direction", "credit")
    .eq("is_paid", false);

  const debts = ((debtsRaw ?? []) as DebtRow[]).sort((a, b) => {
    const ad = new Date(a.due_date ?? a.transaction_date).getTime();
    const bd = new Date(b.due_date ?? b.transaction_date).getTime();
    return ad - bd;
  });

  const allocatedByTx = new Map<string, number>();
  if (debts.length > 0) {
    const { data: allocs } = await supabase
      .from("payment_allocations")
      .select("debt_tx_id,amount")
      .eq("user_id", userId)
      .in("debt_tx_id", debts.map((d) => d.id));
    for (const a of allocs ?? []) {
      allocatedByTx.set(a.debt_tx_id, (allocatedByTx.get(a.debt_tx_id) ?? 0) + Number(a.amount));
    }
  }

  let remaining = amount;
  const rows: Record<string, unknown>[] = [];
  const settled: string[] = [];
  for (const d of debts) {
    if (remaining <= 0.0001) break;
    const open = outstanding(d, allocatedByTx);
    if (open <= 0.0001) continue;
    const take = Math.min(open, remaining);
    remaining -= take;
    rows.push({
      user_id: userId,
      person_id: input.person_id,
      currency_id: input.currency_id,
      payment_tx_id: payment.id,
      debt_tx_id: d.id,
      amount: take,
    });
    if (open - take <= 0.0001) settled.push(d.id);
  }

  if (rows.length > 0) await supabase.from("payment_allocations").insert(rows);
  if (settled.length > 0) {
    await supabase.from("transactions").update({ is_paid: true })
      .eq("user_id", userId).in("id", settled);
  }

  // 3) any open promise in this currency is considered kept when covered
  const { data: promises } = await supabase
    .from("payment_promises")
    .select("id,amount")
    .eq("user_id", userId)
    .eq("person_id", input.person_id)
    .eq("currency_id", input.currency_id)
    .eq("status", "open");
  const covered = (promises ?? []).filter((p: { amount: number | string }) => Number(p.amount) <= amount + 0.0001);
  if (covered.length > 0) {
    await supabase.from("payment_promises")
      .update({ status: "kept", kept_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", covered.map((p: { id: string }) => p.id));
  }

  return {
    payment_tx_id: payment.id,
    allocated: amount - remaining,
    unallocated: remaining,
    settled_tx_ids: settled,
  };
}

/** Mark overdue open promises as broken (used by the Today workspace + cron). */
export async function sweepBrokenPromises(supabase: DB, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("payment_promises")
    .update({ status: "broken" })
    .eq("user_id", userId)
    .eq("status", "open")
    .lt("promised_date", today)
    .select("id");
  return { broken: (data ?? []).length };
}

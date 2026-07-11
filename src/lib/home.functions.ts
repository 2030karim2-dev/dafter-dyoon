/**
 * Backend brain for the Debts Home page.
 * Server aggregates people + per-currency balances (NO currency mixing).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface CurrencyDTO { id: string; name: string; symbol: string; rate: number; is_base: boolean }
export interface PersonDTO {
  id: string; name: string; type: string; is_archived: boolean;
  avatar_color: string | null; phone: string | null;
  notes: string | null; credit_limit: number | null;
}
export interface PerCurrencyEntry { currency_id: string; balance: number; count: number }
export interface PersonWithBalances {
  person: PersonDTO;
  balances: PerCurrencyEntry[];   // one per currency with activity
  net_base: number;               // sum converted to base (display only)
  totalCredit_base: number;
  totalDebit_base: number;
  txCount: number;
  lastDate: number;               // ms epoch
  lastAmount: number;
  lastDirection: string;
}
export interface CurrencyTotal {
  currency: CurrencyDTO;
  owed: number; // له
  owe: number;  // عليه
  net: number;
}
export interface DebtsHomePayload {
  currencies: CurrencyDTO[];
  base: CurrencyDTO | null;
  people: PersonWithBalances[];
  totalsPerCurrency: CurrencyTotal[];
  peopleCount: number;
  txCount: number;
}

export const getDebtsHomeFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DebtsHomePayload> => {
    const { supabase, userId } = context;
    const [pRes, tRes, cRes] = await Promise.all([
      supabase.from("people").select("id,name,type,is_archived,avatar_color,phone,notes,credit_limit,created_at")
        .eq("user_id", userId).eq("is_archived", false).order("created_at", { ascending: false }),
      supabase.from("transactions").select("id,person_id,amount,direction,currency_id,transaction_date")
        .eq("user_id", userId),
      supabase.from("currencies").select("id,name,symbol,rate,is_base")
        .eq("user_id", userId).order("is_base", { ascending: false }),
    ]);
    const currencies = (cRes.data ?? []) as CurrencyDTO[];
    const txs = tRes.data ?? [];
    const people = (pRes.data ?? []) as PersonDTO[];
    const curById = new Map(currencies.map((c) => [c.id, c]));
    const base = currencies.find((c) => c.is_base) ?? currencies[0] ?? null;

    // per-person per-currency aggregation
    type Agg = {
      byCur: Map<string, { balance: number; count: number }>;
      txCount: number; lastDate: number; lastAmount: number; lastDirection: string;
      totalCredit_base: number; totalDebit_base: number;
    };
    const perPerson = new Map<string, Agg>();
    for (const t of txs) {
      if (!t.person_id) continue;
      const cur = curById.get(t.currency_id);
      const rate = cur?.rate ?? 1;
      const sign = t.direction === "credit" ? 1 : -1;
      const amtOwn = Number(t.amount);
      const amtBase = amtOwn * rate;
      const dateMs = new Date(t.transaction_date).getTime();
      let agg = perPerson.get(t.person_id);
      if (!agg) {
        agg = { byCur: new Map(), txCount: 0, lastDate: 0, lastAmount: 0, lastDirection: "", totalCredit_base: 0, totalDebit_base: 0 };
        perPerson.set(t.person_id, agg);
      }
      const slot = agg.byCur.get(t.currency_id) ?? { balance: 0, count: 0 };
      slot.balance += amtOwn * sign;
      slot.count += 1;
      agg.byCur.set(t.currency_id, slot);
      agg.txCount += 1;
      if (dateMs >= agg.lastDate) {
        agg.lastDate = dateMs;
        agg.lastAmount = amtBase;
        agg.lastDirection = t.direction;
      }
      if (t.direction === "credit") agg.totalCredit_base += amtBase;
      else agg.totalDebit_base += amtBase;
    }

    const enriched: PersonWithBalances[] = people.map((p) => {
      const agg = perPerson.get(p.id);
      const balances: PerCurrencyEntry[] = [];
      let net_base = 0;
      if (agg) {
        for (const [cid, s] of agg.byCur) {
          balances.push({ currency_id: cid, balance: s.balance, count: s.count });
          const cur = curById.get(cid);
          net_base += s.balance * (cur?.rate ?? 1);
        }
      }
      return {
        person: p,
        balances,
        net_base,
        totalCredit_base: agg?.totalCredit_base ?? 0,
        totalDebit_base: agg?.totalDebit_base ?? 0,
        txCount: agg?.txCount ?? 0,
        lastDate: agg?.lastDate ?? 0,
        lastAmount: agg?.lastAmount ?? 0,
        lastDirection: agg?.lastDirection ?? "",
      };
    });

    // per-currency totals (NO mixing)
    const totalsPerCurrency: CurrencyTotal[] = currencies.map((c) => {
      let owed = 0, owe = 0;
      for (const t of txs) {
        if (t.currency_id !== c.id) continue;
        if (t.direction === "credit") owed += Number(t.amount);
        else owe += Number(t.amount);
      }
      return { currency: c, owed, owe, net: owed - owe };
    }).filter((r) => r.owed > 0 || r.owe > 0 || r.currency.is_base);

    return {
      currencies, base, people: enriched, totalsPerCurrency,
      peopleCount: people.length, txCount: txs.length,
    };
  });

/** Archive a person (soft delete). */
export const archivePersonFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("people").update({ is_archived: true })
      .eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Hard delete a person — refuses if any transactions exist. */
export const deletePersonFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase.from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("person_id", data.id).eq("user_id", userId);
    if ((count ?? 0) > 0) throw new Error("لا يمكن الحذف — لديه معاملات. استخدم الأرشفة.");
    const { error } = await supabase.from("people").delete()
      .eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

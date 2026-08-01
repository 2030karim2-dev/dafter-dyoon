/**
 * Backend brain for the Debts Home page.
 * Server aggregates people + per-currency balances.
 * Currencies are 100% independent: no rates, no conversion, no mixing.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface CurrencyDTO { id: string; name: string; symbol: string; is_base: boolean }
export interface PersonDTO {
  id: string; name: string; type: string; is_archived: boolean;
  avatar_color: string | null; phone: string | null;
  notes: string | null; credit_limit: number | null;
}
export interface PerCurrencyEntry {
  currency_id: string;
  balance: number;
  credit: number;
  debit: number;
  count: number;
  lastDate: number;      // ms epoch
  lastAmount: number;
  lastDirection: string;
}
export interface PersonWithBalances {
  person: PersonDTO;
  balances: PerCurrencyEntry[];   // one entry per account currency
  txCount: number;
  lastDate: number;
}
export interface CurrencyTotal {
  currency: CurrencyDTO;
  owed: number; // له
  owe: number;  // عليه
  net: number;
  peopleCount: number;
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
    const [pRes, tRes, cRes, oRes] = await Promise.all([
      supabase.from("people").select("id,name,type,is_archived,avatar_color,phone,notes,credit_limit,created_at")
        .eq("user_id", userId).eq("is_archived", false).order("created_at", { ascending: false }),
      supabase.from("transactions").select("id,person_id,amount,direction,currency_id,transaction_date")
        .eq("user_id", userId),
      supabase.from("currencies").select("id,name,symbol,is_base")
        .eq("user_id", userId).order("is_base", { ascending: false }),
      supabase.from("opening_balances").select("person_id,currency_id,amount,direction")
        .eq("user_id", userId),
    ]);
    const currencies = (cRes.data ?? []) as CurrencyDTO[];
    const txs = tRes.data ?? [];
    const openings = oRes.data ?? [];
    const people = (pRes.data ?? []) as PersonDTO[];
    const base = currencies.find((c) => c.is_base) ?? currencies[0] ?? null;

    type Slot = { balance: number; credit: number; debit: number; count: number; lastDate: number; lastAmount: number; lastDirection: string };
    const newSlot = (): Slot => ({ balance: 0, credit: 0, debit: 0, count: 0, lastDate: 0, lastAmount: 0, lastDirection: "" });
    const perPerson = new Map<string, Map<string, Slot>>();
    const slotOf = (pid: string, cid: string) => {
      let m = perPerson.get(pid);
      if (!m) { m = new Map(); perPerson.set(pid, m); }
      let s = m.get(cid);
      if (!s) { s = newSlot(); m.set(cid, s); }
      return s;
    };

    for (const o of openings) {
      if (!o.person_id) continue;
      const s = slotOf(o.person_id, o.currency_id);
      const amt = Number(o.amount);
      const v = o.direction === "credit" ? amt : -amt;
      s.balance += v;
      if (v >= 0) s.credit += Math.abs(v); else s.debit += Math.abs(v);
    }

    for (const t of txs) {
      if (!t.person_id) continue;
      const s = slotOf(t.person_id, t.currency_id);
      const amt = Number(t.amount);
      s.balance += t.direction === "credit" ? amt : -amt;
      if (t.direction === "credit") s.credit += amt; else s.debit += amt;
      s.count += 1;
      const dateMs = new Date(t.transaction_date).getTime();
      if (dateMs >= s.lastDate) {
        s.lastDate = dateMs;
        s.lastAmount = amt;
        s.lastDirection = t.direction;
      }
    }

    const enriched: PersonWithBalances[] = people.map((p) => {
      const m = perPerson.get(p.id);
      // every currency of the account gets an entry (accounts are pre-opened)
      const balances: PerCurrencyEntry[] = currencies.map((c) => {
        const s = m?.get(c.id) ?? newSlot();
        return {
          currency_id: c.id,
          balance: s.balance, credit: s.credit, debit: s.debit, count: s.count,
          lastDate: s.lastDate, lastAmount: s.lastAmount, lastDirection: s.lastDirection,
        };
      });
      return {
        person: p,
        balances,
        txCount: balances.reduce((a, b) => a + b.count, 0),
        lastDate: balances.reduce((a, b) => Math.max(a, b.lastDate), 0),
      };
    });

    // per-currency totals — strictly separate ledgers
    const totalsPerCurrency: CurrencyTotal[] = currencies.map((c) => {
      let owed = 0, owe = 0, peopleWith = 0;
      for (const p of enriched) {
        const e = p.balances.find((b) => b.currency_id === c.id);
        if (!e) continue;
        if (e.balance > 0.005) owed += e.balance;
        else if (e.balance < -0.005) owe += -e.balance;
        if (e.count > 0 || Math.abs(e.balance) > 0.005) peopleWith += 1;
      }
      return { currency: c, owed, owe, net: owed - owe, peopleCount: peopleWith };
    });

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

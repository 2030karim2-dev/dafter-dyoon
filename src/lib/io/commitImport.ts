import { supabase } from "@/integrations/supabase/client";
import type { MappedTx } from "./importExcel";

interface CurrencyLite {
  id: string;
  name: string;
  symbol: string;
  is_base: boolean;
}

/** Best-effort match for a per-row currency name/symbol to one of the user's currencies. */
function matchCurrency(raw: string | null, currencies: CurrencyLite[], baseId: string): string {
  if (!raw) return baseId;
  const s = raw.trim().toLowerCase();
  if (!s) return baseId;
  const hit = currencies.find(
    (c) =>
      c.name.toLowerCase() === s ||
      c.symbol.toLowerCase() === s ||
      c.name.toLowerCase().includes(s) ||
      s.includes(c.name.toLowerCase()) ||
      s.includes(c.symbol.toLowerCase()),
  );
  return hit?.id ?? baseId;
}

export async function commitImportedTxs(
  userId: string,
  baseCurrencyId: string,
  rows: MappedTx[],
): Promise<{ inserted: number; failed: number; people: number; openings: number }> {
  const { data: currencies } = await supabase
    .from("currencies")
    .select("id,name,symbol,is_base")
    .eq("user_id", userId);
  const curs = (currencies ?? []) as CurrencyLite[];

  const { data: existing } = await supabase
    .from("people")
    .select("id,name,phone")
    .eq("user_id", userId);
  const peopleMap = new Map<string, { id: string; phone: string | null }>(
    ((existing as { id: string; name: string; phone: string | null }[]) ?? []).map((p) => [
      p.name.trim().toLowerCase(),
      { id: p.id, phone: p.phone },
    ]),
  );

  // Insert new people
  const seen = new Set<string>();
  const newPeople: { name: string; phone: string | null }[] = [];
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    if (peopleMap.has(key) || seen.has(key)) continue;
    seen.add(key);
    newPeople.push({ name: r.name.trim(), phone: r.phone });
  }
  let createdPeople = 0;
  if (newPeople.length) {
    const { data: inserted } = await supabase
      .from("people")
      .insert(newPeople.map((p) => ({ ...p, user_id: userId })))
      .select("id,name,phone");
    for (const p of (inserted as { id: string; name: string; phone: string | null }[] | null) ??
      []) {
      peopleMap.set(p.name.trim().toLowerCase(), { id: p.id, phone: p.phone });
      createdPeople += 1;
    }
  }

  // Build transactions & opening balances payloads
  const txPayload: {
    user_id: string;
    person_id: string;
    currency_id: string;
    amount: number;
    direction: string;
    details: string | null;
    transaction_date: string;
  }[] = [];
  const openPayload: {
    user_id: string;
    person_id: string;
    currency_id: string;
    amount: number;
    direction: string;
    note: string;
  }[] = [];
  for (const r of rows) {
    const person = peopleMap.get(r.name.trim().toLowerCase());
    if (!person) continue;
    const curId = matchCurrency(r.currency, curs, baseCurrencyId);
    txPayload.push({
      user_id: userId,
      person_id: person.id,
      currency_id: curId,
      amount: r.amount,
      direction: r.direction,
      details: r.details,
      transaction_date: r.date,
    });
    if (r.opening_balance != null) {
      openPayload.push({
        user_id: userId,
        person_id: person.id,
        currency_id: curId,
        amount: Math.abs(r.opening_balance),
        direction: r.opening_balance >= 0 ? "credit" : "debit",
        note: "مستورد من ملف",
      });
    }
  }

  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < txPayload.length; i += 200) {
    const chunk = txPayload.slice(i, i + 200);
    const { error } = await supabase.from("transactions").insert(chunk);
    if (error) failed += chunk.length;
    else inserted += chunk.length;
  }

  let openings = 0;
  if (openPayload.length) {
    const { error, count } = await supabase
      .from("opening_balances")
      .insert(openPayload, { count: "exact" });
    if (!error) openings = count ?? openPayload.length;
  }

  return { inserted, failed, people: createdPeople, openings };
}

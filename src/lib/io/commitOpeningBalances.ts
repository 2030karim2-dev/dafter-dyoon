import { supabase } from "@/integrations/supabase/client";

export interface AiOpeningRow {
  name: string;
  phone: string;
  amount: number;
  direction: "credit" | "debit";
  currency: "SAR" | "YER" | "USD" | "OTHER";
  last_payment_amount: number;
  last_payment_date: string;
  opening_date: string;
  notes: string;
}

interface CurrencyLite {
  id: string;
  name: string;
  symbol: string;
  is_base: boolean;
}

function normName(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}
function normPhone(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/\D/g, "").slice(-9);
}

function pickCurrency(code: string, curs: CurrencyLite[], baseId: string): string {
  const tokens: Record<string, string[]> = {
    SAR: ["ر.س", "سعودي", "sar", "riyal", "ريال س"],
    YER: ["ر.ي", "يمني", "yer", "ريال ي"],
    USD: ["$", "دولار", "usd", "dollar"],
  };
  const tk = tokens[code] ?? [];
  const hit = curs.find((c) =>
    tk.some((t) => c.name.toLowerCase().includes(t) || c.symbol.toLowerCase().includes(t)),
  );
  return hit?.id ?? baseId;
}

export interface CommitResult {
  peopleCreated: number;
  peopleMerged: number;
  openingsInserted: number;
  openingsUpdated: number;
  paymentsInserted: number;
  skipped: number;
  errors: string[];
}

export async function commitOpeningBalances(
  userId: string,
  rows: AiOpeningRow[],
): Promise<CommitResult> {
  const res: CommitResult = {
    peopleCreated: 0,
    peopleMerged: 0,
    openingsInserted: 0,
    openingsUpdated: 0,
    paymentsInserted: 0,
    skipped: 0,
    errors: [],
  };

  // Load currencies
  const { data: curData } = await supabase
    .from("currencies")
    .select("id,name,symbol,is_base")
    .eq("user_id", userId);
  const curs = (curData ?? []) as CurrencyLite[];
  const baseId = curs.find((c) => c.is_base)?.id ?? curs[0]?.id;
  if (!baseId) {
    res.errors.push("لا توجد عملات معرّفة");
    return res;
  }

  // Load existing people
  const { data: existing } = await supabase
    .from("people")
    .select("id,name,phone")
    .eq("user_id", userId);
  type PRow = { id: string; name: string; phone: string | null };
  const exList = (existing ?? []) as PRow[];
  const byPhone = new Map<string, PRow>();
  const byName = new Map<string, PRow>();
  for (const p of exList) {
    const ph = normPhone(p.phone);
    if (ph) byPhone.set(ph, p);
    byName.set(normName(p.name), p);
  }

  // Dedupe and build new people list
  const matched = new Map<number, string>(); // row index -> person_id
  const toCreate: { idx: number; name: string; phone: string | null }[] = [];
  const newKeys = new Set<string>();

  rows.forEach((r, i) => {
    const name = (r.name || "").trim();
    if (!name) {
      res.skipped++;
      return;
    }
    const ph = normPhone(r.phone);
    const existingP = (ph && byPhone.get(ph)) || byName.get(normName(name));
    if (existingP) {
      matched.set(i, existingP.id);
      res.peopleMerged++;
      return;
    }
    const key = ph || normName(name);
    if (newKeys.has(key)) {
      // duplicate within file → resolve after insert
      toCreate.push({ idx: i, name, phone: ph || null });
      return;
    }
    newKeys.add(key);
    toCreate.push({ idx: i, name, phone: ph || null });
  });

  // Insert new people in chunks
  if (toCreate.length) {
    // Collapse duplicates by key first
    const unique = new Map<string, { name: string; phone: string | null; idxs: number[] }>();
    for (const c of toCreate) {
      const k = (c.phone || "") + "|" + normName(c.name);
      const cur = unique.get(k);
      if (cur) cur.idxs.push(c.idx);
      else unique.set(k, { name: c.name, phone: c.phone, idxs: [c.idx] });
    }
    const payload = Array.from(unique.values()).map((u) => ({
      user_id: userId,
      name: u.name,
      phone: u.phone,
      type: "general",
    }));
    for (let i = 0; i < payload.length; i += 200) {
      const chunk = payload.slice(i, i + 200);
      const { data, error } = await supabase.from("people").insert(chunk).select("id,name,phone");
      if (error) {
        res.errors.push(error.message);
        continue;
      }
      const inserted = (data ?? []) as PRow[];
      // map back by name+phone order (insert preserves order)
      const uniqArr = Array.from(unique.values()).slice(i, i + 200);
      inserted.forEach((p, j) => {
        const u = uniqArr[j];
        if (!u) return;
        res.peopleCreated++;
        for (const idx of u.idxs) matched.set(idx, p.id);
      });
    }
  }

  // Load existing opening_balances for dedupe (person_id+currency_id unique)
  const personIds = Array.from(new Set(Array.from(matched.values())));
  const existingOB = new Map<string, { id: string; amount: number }>();
  for (let i = 0; i < personIds.length; i += 200) {
    const chunk = personIds.slice(i, i + 200);
    const { data } = await supabase
      .from("opening_balances")
      .select("id,person_id,currency_id,amount")
      .in("person_id", chunk);
    for (const o of (data ?? []) as {
      id: string;
      person_id: string;
      currency_id: string;
      amount: number;
    }[]) {
      existingOB.set(`${o.person_id}:${o.currency_id}`, { id: o.id, amount: o.amount });
    }
  }

  // Build opening + payment payloads
  type OBIns = {
    user_id: string;
    person_id: string;
    currency_id: string;
    amount: number;
    direction: string;
    note: string;
    opening_date?: string;
  };
  type TxIns = {
    user_id: string;
    person_id: string;
    currency_id: string;
    amount: number;
    direction: string;
    details: string;
    transaction_date: string;
  };
  const obInsert: OBIns[] = [];
  const obUpdate: { id: string; amount: number; direction: string; note: string | null }[] = [];
  const payments: TxIns[] = [];

  rows.forEach((r, i) => {
    const pid = matched.get(i);
    if (!pid) return;
    if (!r.amount || r.amount <= 0) return;
    const curId = pickCurrency(r.currency, curs, baseId);
    const key = `${pid}:${curId}`;
    const note = r.notes?.trim() || "مستورد بالذكاء الاصطناعي";
    const opening_date = /^\d{4}-\d{2}-\d{2}/.test(r.opening_date) ? r.opening_date : undefined;
    const ex = existingOB.get(key);
    if (ex) {
      obUpdate.push({ id: ex.id, amount: r.amount, direction: r.direction, note });
    } else {
      obInsert.push({
        user_id: userId,
        person_id: pid,
        currency_id: curId,
        amount: r.amount,
        direction: r.direction,
        note,
        ...(opening_date ? { opening_date } : {}),
      });
      existingOB.set(key, { id: "_", amount: r.amount });
    }
    if (r.last_payment_amount && r.last_payment_amount > 0) {
      const dt = /^\d{4}-\d{2}-\d{2}/.test(r.last_payment_date)
        ? new Date(r.last_payment_date).toISOString()
        : new Date().toISOString();
      payments.push({
        user_id: userId,
        person_id: pid,
        currency_id: curId,
        amount: r.last_payment_amount,
        direction: r.direction === "credit" ? "debit" : "credit", // payment reduces the balance
        details: "آخر دفعة (مستورد)",
        transaction_date: dt,
      });
    }
  });

  // Insert openings
  for (let i = 0; i < obInsert.length; i += 200) {
    const chunk = obInsert.slice(i, i + 200);
    const { error, count } = await supabase
      .from("opening_balances")
      .insert(chunk, { count: "exact" });
    if (error) res.errors.push(error.message);
    else res.openingsInserted += count ?? chunk.length;
  }
  // Update existing
  for (const u of obUpdate) {
    const { error } = await supabase
      .from("opening_balances")
      .update({ amount: u.amount, direction: u.direction, note: u.note })
      .eq("id", u.id);
    if (!error) res.openingsUpdated++;
  }
  // Insert payments
  for (let i = 0; i < payments.length; i += 200) {
    const chunk = payments.slice(i, i + 200);
    const { error, count } = await supabase.from("transactions").insert(chunk, { count: "exact" });
    if (error) res.errors.push(error.message);
    else res.paymentsInserted += count ?? chunk.length;
  }

  return res;
}

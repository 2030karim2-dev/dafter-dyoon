import { supabase } from "@/integrations/supabase/client";
import type { CompanyRow, CurRow, OpeningRow, PersonRow, TxRow } from "./types";
import { buildStatementWorkbookForCurrency } from "./statement";
import { downloadWorkbook, safeFileName, todayISO, wait } from "./download";

/**
 * Export professional Excel statements for a customer.
 * Produces ONE polished workbook per currency the customer transacted in
 * (or has an opening balance in). E.g. SAR + YER → two files.
 */
export async function exportPersonStatements(personId: string, personName: string) {
  const [{ data: person }, { data: txs }, { data: currencies }, { data: company }, { data: openings }] =
    await Promise.all([
      supabase.from("people").select("id,name,phone").eq("id", personId).maybeSingle(),
      supabase
        .from("transactions")
        .select("amount,direction,transaction_date,details,currency_id")
        .eq("person_id", personId)
        .order("transaction_date", { ascending: true }),
      supabase.from("currencies").select("id,name,symbol,is_base"),
      supabase.from("company_profile").select("name,address,phone,email,tax_number,notes").maybeSingle(),
      supabase.from("opening_balances").select("currency_id,amount,direction").eq("person_id", personId),
    ]);

  const p: PersonRow = (person as PersonRow | null) ?? { id: personId, name: personName, phone: null };
  const curList = (currencies as CurRow[]) ?? [];
  const cMap = new Map<string, CurRow>(curList.map((c) => [c.id, c]));
  const txList = (txs as TxRow[]) ?? [];
  const opList = (openings as OpeningRow[]) ?? [];
  const comp = (company as CompanyRow | null) ?? null;
  const safe = safeFileName(p.name || personName || "عميل");
  const today = todayISO();

  const usedIds = new Set<string>();
  txList.forEach((t) => usedIds.add(t.currency_id));
  opList.forEach((o) => usedIds.add(o.currency_id));

  if (usedIds.size === 0) {
    // Nothing to export — build an empty base-currency workbook so the user still gets a valid file.
    const base = curList.find((c) => c.is_base) ?? curList[0];
    if (!base) return;
    const buf = await buildStatementWorkbookForCurrency({ person: p, currency: base, txs: [], opening: 0, company: comp });
    downloadWorkbook(buf, `كشف-حساب-${safe}-${base.name}-${today}.xlsx`);
    return;
  }

  // Base currency first.
  const ordered = Array.from(usedIds).sort(
    (a, b) => (cMap.get(b)?.is_base ? 1 : 0) - (cMap.get(a)?.is_base ? 1 : 0),
  );

  for (let i = 0; i < ordered.length; i++) {
    const cur = cMap.get(ordered[i]!);
    if (!cur) continue;
    const currencyTxs = txList.filter((t) => t.currency_id === cur.id);
    const opening = opList
      .filter((o) => o.currency_id === cur.id)
      .reduce((s, o) => s + Number(o.amount) * (o.direction === "credit" ? 1 : -1), 0);

    const buf = await buildStatementWorkbookForCurrency({ person: p, currency: cur, txs: currencyTxs, opening, company: comp });
    downloadWorkbook(buf, `كشف-حساب-${safe}-${cur.name}-${today}.xlsx`);
    if (i < ordered.length - 1) await wait(400); // give the browser time between downloads
  }
}

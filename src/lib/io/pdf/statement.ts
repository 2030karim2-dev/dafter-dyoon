import type { Currency, OpeningBalance, Tx } from "./format";
import { ensureArabicFontLoaded, fetchCompany, logoDataUrl } from "./company";
import { renderCurrencySection } from "./section";
import { buildStatementHtml } from "./template";
import { renderHtmlToPdf } from "./render";

export interface StatementPdfOpts {
  personName: string;
  phone?: string | null;
  txs: Tx[];
  currencies: Currency[];
  openings?: OpeningBalance[];
  balance?: number;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

/** Generate and download a professional multi-currency customer statement PDF. */
export async function exportPersonStatementPDF(opts: StatementPdfOpts) {
  const { personName, phone, txs, currencies, openings = [], dateFrom, dateTo } = opts;

  const company = await fetchCompany();
  const logo = company?.logo_path ? await logoDataUrl(company.logo_path) : null;
  await ensureArabicFontLoaded();

  const filteredTxs = txs.filter((t) => {
    const d = new Date(t.transaction_date).getTime();
    if (dateFrom && d < dateFrom.getTime()) return false;
    if (dateTo && d > dateTo.getTime()) return false;
    return true;
  });

  const used = currencies.filter(
    (c) => filteredTxs.some((t) => t.currency_id === c.id) || openings.some((o) => o.currency_id === c.id),
  );
  if (used.length === 0 && currencies.length > 0) used.push(currencies[0]!);
  used.sort((a, b) => Number(b.is_base) - Number(a.is_base));

  const headlineCurrencyId = (used.find((c) => c.is_base) ?? used[0])?.id;
  let totalCredit = 0;
  let totalDebit = 0;
  for (const t of filteredTxs) {
    // Totals belong to a single currency only (the headline currency).
    if (t.currency_id !== headlineCurrencyId) continue;
    if (t.direction === "credit") totalCredit += Number(t.amount);
    else totalDebit += Number(t.amount);
  }

  const sections = used.map((cur) => renderCurrencySection(cur, filteredTxs, openings)).join("");

  const html = buildStatementHtml({
    personName, phone, company, logo, filteredTxs,
    base: currencies.find((c) => c.is_base) ?? currencies[0],
    totalCredit, totalDebit, sections, dateFrom, dateTo,
  });

  await renderHtmlToPdf(html, `statement-${personName}-${Date.now()}.pdf`);
}

import type { Currency, OpeningBalance, Tx } from "./format";
import { dmy, esc, fmt } from "./format";
import { C, statusFor } from "./theme";

/** One per-currency ledger section (header band, table, closing band). */
export function renderCurrencySection(
  cur: Currency,
  filteredTxs: Tx[],
  openings: OpeningBalance[],
): string {
  const open = openings
    .filter((o) => o.currency_id === cur.id)
    .reduce((s, o) => s + Number(o.amount) * (o.direction === "credit" ? 1 : -1), 0);

  const curTxs = [...filteredTxs.filter((t) => t.currency_id === cur.id)].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime(),
  );

  if (curTxs.length === 0 && open === 0) return "";

  let acc = open;
  let cCredit = 0;
  let cDebit = 0;
  const rows: string[] = [];

  if (open !== 0) {
    rows.push(`
      <tr style="background:${C.primarySoft};">
        <td style="padding:6px 8px;border:1px solid ${C.border};text-align:center;">—</td>
        <td style="padding:6px 8px;border:1px solid ${C.border};text-align:center;">0</td>
        <td style="padding:6px 8px;border:1px solid ${C.border};text-align:right;font-weight:700;">رصيد افتتاحي</td>
        <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;color:${C.accent};font-weight:700;">${open > 0 ? fmt(Math.abs(open)) : "—"}</td>
        <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;color:${C.danger};font-weight:700;">${open < 0 ? fmt(Math.abs(open)) : "—"}</td>
        <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;font-weight:700;">${fmt(open)}</td>
      </tr>`);
  }

  curTxs.forEach((t, i) => {
    const amt = Number(t.amount);
    if (t.direction === "credit") {
      acc += amt;
      cCredit += amt;
    } else {
      acc -= amt;
      cDebit += amt;
    }
    const zebra = i % 2 === 1 ? C.bgAlt : C.white;
    const desc = t.details ?? (t.direction === "credit" ? "دائن" : "مدين");
    rows.push(`
      <tr style="background:${zebra};">
        <td style="padding:6px 8px;border:1px solid ${C.border};text-align:center;white-space:nowrap;">${dmy(t.transaction_date)}</td>
        <td style="padding:6px 8px;border:1px solid ${C.border};text-align:center;">${i + 1}</td>
        <td style="padding:6px 8px;border:1px solid ${C.border};text-align:right;">${esc(desc)}</td>
        <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;color:${C.accent};font-weight:700;white-space:nowrap;">${t.direction === "credit" ? fmt(amt) : "—"}</td>
        <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;color:${C.danger};font-weight:700;white-space:nowrap;">${t.direction === "debit" ? fmt(amt) : "—"}</td>
        <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;font-weight:700;white-space:nowrap;">${fmt(acc)}</td>
      </tr>`);
  });

  const closing = open + cCredit - cDebit;
  const st = statusFor(closing);

  return `
    <section style="margin-top:14px;page-break-inside:auto;">
      <div style="background:${C.primary};color:#fff;padding:8px 12px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:700;font-size:13px;">${esc(cur.name)} <span style="opacity:.85;">(${esc(cur.symbol)})</span></div>
        <div style="font-size:11px;opacity:.9;">قسم العملة</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:auto;">
        <thead>
          <tr style="background:${C.primary};color:#fff;">
            <th style="padding:7px 8px;border:1px solid ${C.primary};text-align:center;width:78px;">التاريخ</th>
            <th style="padding:7px 8px;border:1px solid ${C.primary};text-align:center;width:30px;">#</th>
            <th style="padding:7px 8px;border:1px solid ${C.primary};text-align:right;">البيان / الوصف</th>
            <th style="padding:7px 8px;border:1px solid ${C.primary};text-align:left;width:90px;">دائن (له)</th>
            <th style="padding:7px 8px;border:1px solid ${C.primary};text-align:left;width:90px;">مدين (عليه)</th>
            <th style="padding:7px 8px;border:1px solid ${C.primary};text-align:left;width:100px;">الرصيد (${esc(cur.symbol)})</th>
          </tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
        <tfoot>
          <tr style="background:${C.bgAlt};font-weight:700;">
            <td colspan="3" style="padding:7px 8px;border:1px solid ${C.border};text-align:right;">الإجماليات</td>
            <td style="padding:7px 8px;border:1px solid ${C.border};text-align:left;color:${C.accent};">${fmt(cCredit)}</td>
            <td style="padding:7px 8px;border:1px solid ${C.border};text-align:left;color:${C.danger};">${fmt(cDebit)}</td>
            <td style="padding:7px 8px;border:1px solid ${C.border};text-align:left;">${fmt(closing)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="background:${st.bg};color:#fff;padding:8px 12px;border-radius:0 0 6px 6px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:700;font-size:12px;">${st.label}</div>
        <div style="font-weight:800;font-size:13px;">${fmt(Math.abs(closing))} ${esc(cur.symbol)}</div>
      </div>
    </section>`;
}

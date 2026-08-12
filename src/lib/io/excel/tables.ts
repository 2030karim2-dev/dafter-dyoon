import type ExcelJS from "exceljs";
import type { CompanyRow, CurRow, TxRow } from "./types";
import {
  COL_CREDIT,
  COL_DEBIT,
  COL_HEAD_BG,
  COL_HEAD_TXT,
  COL_OPENING_BG,
  COL_OPENING_TXT,
  COL_TEXT,
  COL_TOTAL_BG,
  COL_ZEBRA,
  FONT,
  NUM_FMT,
  fmtDateEN,
  rtl,
  solid,
  thinBorder,
} from "./theme";

export interface StatementTotals {
  balance: number;
  totalDebit: number;
  totalCredit: number;
  endRow: number;
}

/** Table head row. Returns the next row index. */
export function writeTableHead(ws: ExcelJS.Worksheet, row: number, currency: CurRow): number {
  const headers = [
    "#",
    "التاريخ",
    "البيان",
    "مدين (عليه)",
    "دائن (له)",
    `الرصيد (${currency.symbol || currency.name})`,
  ];
  headers.forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.font = { name: FONT, size: 11, bold: true, color: { argb: COL_HEAD_TXT } };
    c.alignment = rtl("center", true);
    c.fill = solid(COL_HEAD_BG);
    c.border = thinBorder;
  });
  ws.getRow(row).height = 30;
  return row + 1;
}

/** Opening balance row + transaction rows + totals row. */
export function writeStatementBody(
  ws: ExcelJS.Worksheet,
  startRow: number,
  txs: TxRow[],
  opening: number,
): StatementTotals {
  let row = startRow;
  let balance = opening;
  let totalDebit = opening < 0 ? Math.abs(opening) : 0;
  let totalCredit = opening > 0 ? opening : 0;

  if (opening !== 0) {
    const cells: (string | number | null)[] = [
      0,
      "—",
      "رصيد افتتاحي",
      opening < 0 ? Math.abs(opening) : null,
      opening > 0 ? opening : null,
      balance,
    ];
    cells.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      c.border = thinBorder;
      c.alignment = rtl(i === 2 ? "right" : "center");
      c.fill = solid(COL_OPENING_BG);
      c.font = { name: FONT, size: 10, italic: true, bold: true, color: { argb: COL_OPENING_TXT } };
      if (i >= 3) c.numFmt = NUM_FMT;
    });
    ws.getRow(row).height = 20;
    row++;
  }

  const sorted = txs
    .slice()
    .sort(
      (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime(),
    );

  sorted.forEach((t, idx) => {
    const amt = Number(t.amount);
    const credit = t.direction === "credit";
    if (credit) {
      balance += amt;
      totalCredit += amt;
    } else {
      balance -= amt;
      totalDebit += amt;
    }

    const cells: (string | number | null)[] = [
      idx + 1,
      fmtDateEN(t.transaction_date),
      t.details ?? "—",
      credit ? null : amt,
      credit ? amt : null,
      balance,
    ];
    const zebra = idx % 2 === 1;
    cells.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      c.border = thinBorder;
      c.alignment = rtl(i === 2 ? "right" : "center", i === 2);
      c.font = { name: FONT, size: 10, color: { argb: COL_TEXT } };
      if (zebra) c.fill = solid(COL_ZEBRA);
      if (i >= 3) c.numFmt = NUM_FMT;
      if (i === 3 && v != null)
        c.font = { name: FONT, size: 10, bold: true, color: { argb: COL_DEBIT } };
      if (i === 4 && v != null)
        c.font = { name: FONT, size: 10, bold: true, color: { argb: COL_CREDIT } };
      if (i === 5)
        c.font = {
          name: FONT,
          size: 10,
          bold: true,
          color: { argb: balance >= 0 ? COL_CREDIT : COL_DEBIT },
        };
    });
    ws.getRow(row).height = 20;
    row++;
  });

  const totalCells: (string | number | null)[] = [
    "",
    "",
    "الإجمالي",
    totalDebit,
    totalCredit,
    balance,
  ];
  totalCells.forEach((v, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = v;
    c.border = { ...thinBorder, top: { style: "double" as const, color: { argb: COL_HEAD_BG } } };
    c.fill = solid(COL_TOTAL_BG);
    c.alignment = rtl(i === 2 ? "right" : "center");
    c.font = { name: FONT, size: 11, bold: true, color: { argb: COL_TEXT } };
    if (i >= 3) c.numFmt = NUM_FMT;
    if (i === 3) c.font = { name: FONT, size: 11, bold: true, color: { argb: COL_DEBIT } };
    if (i === 4) c.font = { name: FONT, size: 11, bold: true, color: { argb: COL_CREDIT } };
    if (i === 5)
      c.font = {
        name: FONT,
        size: 12,
        bold: true,
        color: { argb: balance >= 0 ? COL_CREDIT : COL_DEBIT },
      };
  });
  ws.getRow(row).height = 26;

  return { balance, totalDebit, totalCredit, endRow: row + 1 };
}

/** Final balance banner, company notes, and footer. */
export function writeStatementFooter(
  ws: ExcelJS.Worksheet,
  startRow: number,
  balance: number,
  currency: CurRow,
  comp: CompanyRow | null,
) {
  let row = startRow;

  ws.mergeCells(`A${row}:F${row}`);
  const fb = ws.getCell(`A${row}`);
  const status = balance >= 0 ? "له" : "عليه";
  const abs = Math.abs(balance).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  fb.value = `الرصيد النهائي بعملة ${currency.name}: ${abs} ${currency.symbol ?? ""} (${status})`;
  fb.font = {
    name: FONT,
    size: 13,
    bold: true,
    color: { argb: balance >= 0 ? COL_CREDIT : COL_DEBIT },
  };
  fb.alignment = rtl("center");
  fb.fill = solid("FFF1F5F9");
  fb.border = thinBorder;
  ws.getRow(row).height = 28;
  row += 2;

  if (comp?.notes) {
    ws.mergeCells(`A${row}:F${row}`);
    const nt = ws.getCell(`A${row}`);
    nt.value = comp.notes;
    nt.font = { name: FONT, size: 10, italic: true, color: { argb: "FF374151" } };
    nt.alignment = rtl("right", true);
    ws.getRow(row).height = 22;
    row++;
  }

  ws.mergeCells(`A${row}:F${row}`);
  const ft = ws.getCell(`A${row}`);
  ft.value = `${comp?.name ? comp.name + "  •  " : ""}تم الإنشاء بواسطة دفترك  •  ${fmtDateEN(new Date())}`;
  ft.font = { name: FONT, size: 9, italic: true, color: { argb: "FF6B7280" } };
  ft.alignment = rtl("center");
  ws.getRow(row).height = 18;
}

import type ExcelJS from "exceljs";
import type { CompanyRow, CurRow, PersonRow } from "./types";
import {
  COL_BORDER_STRONG, COL_HEAD_BG, COL_INFO_BG, COL_LABEL, COL_SECTION_BG,
  COL_SUBHEAD_BG, COL_TEXT, FONT, fmtDateEN, rtl, solid, thinBorder,
} from "./theme";

/** Company brand block (rows 1-3) + statement title band (row 4). */
export function writeCompanyHeader(ws: ExcelJS.Worksheet, comp: CompanyRow | null, currency: CurRow) {
  ws.mergeCells("A1:F1");
  const h1 = ws.getCell("A1");
  h1.value = comp?.name || "اسم المنشأة";
  h1.font = { name: FONT, size: 22, bold: true, color: { argb: "FFFFFFFF" } };
  h1.alignment = rtl("center");
  h1.fill = solid(COL_HEAD_BG);
  ws.getRow(1).height = 42;

  ws.mergeCells("A2:F2");
  const h2 = ws.getCell("A2");
  h2.value = comp?.address ? `العنوان: ${comp.address}` : " ";
  h2.font = { name: FONT, size: 11, color: { argb: "FFFFFFFF" } };
  h2.alignment = rtl("center");
  h2.fill = solid(COL_SUBHEAD_BG);
  ws.getRow(2).height = 20;

  ws.mergeCells("A3:F3");
  const h3 = ws.getCell("A3");
  const contact: string[] = [];
  if (comp?.phone) contact.push(`هاتف: ${comp.phone}`);
  if (comp?.email) contact.push(`البريد: ${comp.email}`);
  if (comp?.tax_number) contact.push(`الرقم الضريبي: ${comp.tax_number}`);
  h3.value = contact.length ? contact.join("   |   ") : " ";
  h3.font = { name: FONT, size: 10, color: { argb: "FFE0E7FF" } };
  h3.alignment = rtl("center");
  h3.fill = solid(COL_SUBHEAD_BG);
  ws.getRow(3).height = 18;

  ws.mergeCells("A4:F4");
  const h4 = ws.getCell("A4");
  h4.value = `كشف حساب عميل — بعملة ${currency.name}`;
  h4.font = { name: FONT, size: 14, bold: true, color: { argb: COL_HEAD_BG } };
  h4.alignment = rtl("center");
  h4.fill = solid(COL_SECTION_BG);
  h4.border = { bottom: { style: "medium", color: { argb: COL_BORDER_STRONG } } };
  ws.getRow(4).height = 28;
}

/** Customer info block. Returns the next free row index. */
export function writeCustomerInfo(
  ws: ExcelJS.Worksheet,
  person: PersonRow,
  txCount: number,
  startRow = 5,
): number {
  const infoRows: [string, string | number, string, string | number][] = [
    ["اسم العميل:", person.name || "—", "رقم الجوال:", person.phone ?? "—"],
    ["تاريخ الكشف:", fmtDateEN(new Date()), "عدد الحركات:", txCount],
  ];

  let r = startRow;
  for (const [l1, v1, l2, v2] of infoRows) {
    ws.getCell(`A${r}`).value = l1;
    ws.mergeCells(`B${r}:C${r}`);
    ws.getCell(`B${r}`).value = v1;
    ws.getCell(`D${r}`).value = l2;
    ws.mergeCells(`E${r}:F${r}`);
    ws.getCell(`E${r}`).value = v2;

    for (const ref of [`A${r}`, `D${r}`]) {
      const c = ws.getCell(ref);
      c.font = { name: FONT, size: 11, bold: true, color: { argb: COL_LABEL } };
      c.alignment = rtl();
      c.fill = solid(COL_INFO_BG);
      c.border = thinBorder;
    }
    for (const ref of [`B${r}`, `E${r}`]) {
      const c = ws.getCell(ref);
      c.font = { name: FONT, size: 11, color: { argb: COL_TEXT } };
      c.alignment = rtl();
      c.border = thinBorder;
    }
    ws.getRow(r).height = 22;
    r++;
  }
  return r;
}

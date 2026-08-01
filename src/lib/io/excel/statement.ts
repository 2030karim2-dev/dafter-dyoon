import ExcelJS from "exceljs";
import type { CompanyRow, CurRow, PersonRow, TxRow } from "./types";
import { writeCompanyHeader, writeCustomerInfo } from "./header";
import { writeStatementBody, writeStatementFooter, writeTableHead } from "./tables";

/** Build one professional workbook for a single currency's statement. */
export async function buildStatementWorkbookForCurrency(opts: {
  person: PersonRow;
  currency: CurRow;
  txs: TxRow[];
  opening: number;
  company: CompanyRow | null;
}): Promise<ArrayBuffer> {
  const { person, currency, txs, opening, company } = opts;

  const wb = new ExcelJS.Workbook();
  wb.creator = company?.name ?? "دفترك";
  wb.created = new Date();

  const ws = wb.addWorksheet(`كشف ${currency.name}`, {
    views: [{ rightToLeft: true, showGridLines: false, state: "normal" }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  ws.columns = [
    { width: 6 },  // #
    { width: 14 }, // Date
    { width: 42 }, // Details
    { width: 16 }, // Debit
    { width: 16 }, // Credit
    { width: 18 }, // Balance
  ];

  writeCompanyHeader(ws, company, currency);
  const infoEnd = writeCustomerInfo(ws, person, txs.length);
  const headEnd = writeTableHead(ws, infoEnd + 1, currency);
  const totals = writeStatementBody(ws, headEnd, txs, opening);
  writeStatementFooter(ws, totals.endRow, totals.balance, currency, company);

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

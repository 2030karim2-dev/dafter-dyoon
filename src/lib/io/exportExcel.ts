/**
 * Excel export facade — thin re-export layer.
 * Implementation lives in ./excel/*.
 */
export { exportFullAccountWorkbook as exportAllToExcel } from "./excel/fullExport";
export { exportPersonStatements as exportPersonToExcel } from "./excel/personStatements";
export { buildStatementWorkbookForCurrency } from "./excel/statement";
export type { CompanyRow, CurRow, OpeningRow, PersonRow, TxRow } from "./excel/types";

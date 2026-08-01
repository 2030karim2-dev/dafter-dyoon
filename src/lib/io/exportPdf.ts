/**
 * PDF export facade — thin re-export layer.
 * Implementation lives in ./pdf/*.
 */
export { exportPersonStatementPDF } from "./pdf/statement";
export type { StatementPdfOpts } from "./pdf/statement";
export type { CompanyInfo, Currency, OpeningBalance, Tx } from "./pdf/format";

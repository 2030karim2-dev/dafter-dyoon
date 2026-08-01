/** Shared row shapes used by the Excel export engine. */

export interface PersonRow { id: string; name: string; phone: string | null }

export interface TxRow {
  person_id?: string;
  amount: number;
  direction: string;
  transaction_date: string;
  details: string | null;
  currency_id: string;
}

export interface CurRow { id: string; name: string; symbol: string; is_base?: boolean }

export interface CatRow { id: string; name: string }

export interface OpeningRow {
  currency_id: string;
  amount: number;
  direction: string;
  note?: string | null;
  balance_date?: string | null;
}

export interface CompanyRow {
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_number: string | null;
  notes?: string | null;
}

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

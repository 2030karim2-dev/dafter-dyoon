/** Shared types + formatting helpers for the Arabic-safe PDF pipeline. */

export interface Tx {
  amount: number;
  direction: string;
  transaction_date: string;
  details: string | null;
  currency_id: string;
}

export interface Currency { id: string; name: string; symbol: string; is_base?: boolean }

export interface OpeningBalance { currency_id: string; amount: number; direction: string }

export interface CompanyInfo {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_number?: string | null;
  notes?: string | null;
  logo_path?: string | null;
}

export function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);
}

export function fmtInt(n: number) {
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(n);
}

export function dmy(d: string | Date) {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}

export function esc(s: string | null | undefined) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

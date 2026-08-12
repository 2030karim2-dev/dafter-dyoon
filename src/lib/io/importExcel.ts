import * as XLSX from "xlsx";

export type Row = Record<string, string | number | null>;

export async function parseExcelFile(file: File): Promise<{ headers: string[]; rows: Row[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

export interface ColumnMapping {
  name: string;
  amount: string;
  direction?: string;
  date?: string;
  details?: string;
  phone?: string;
  currency?: string;
  opening_balance?: string;
}

export interface MappedTx {
  name: string;
  phone: string | null;
  amount: number;
  direction: "credit" | "debit";
  date: string;
  details: string | null;
  currency: string | null;
  opening_balance: number | null;
}

const CREDIT_WORDS = ["credit", "له", "دائن", "in", "وارد", "+"];
const DEBIT_WORDS = ["debit", "عليه", "مدين", "out", "صادر", "-"];

function parseDirection(v: unknown, amount: number): "credit" | "debit" {
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (CREDIT_WORDS.some((w) => s.includes(w))) return "credit";
    if (DEBIT_WORDS.some((w) => s.includes(w))) return "debit";
  }
  return amount >= 0 ? "credit" : "debit";
}

function parseDate(v: unknown): string {
  if (v == null || v === "") return new Date().toISOString();
  if (typeof v === "number") {
    const ms = (v - 25569) * 86400 * 1000;
    return new Date(ms).toISOString();
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function num(v: unknown): number {
  if (v == null || v === "") return NaN;
  return Number(typeof v === "string" ? v.replace(/[, ]/g, "") : v);
}

export function mapRows(
  rows: Row[],
  m: ColumnMapping,
): { ok: MappedTx[]; errors: { row: number; reason: string }[] } {
  const ok: MappedTx[] = [];
  const errors: { row: number; reason: string }[] = [];
  rows.forEach((r, i) => {
    const name = String(r[m.name] ?? "").trim();
    const amt = num(r[m.amount]);
    if (!name) {
      errors.push({ row: i + 2, reason: "اسم فارغ" });
      return;
    }
    if (!isFinite(amt) || amt === 0) {
      errors.push({ row: i + 2, reason: "مبلغ غير صالح" });
      return;
    }
    const direction = m.direction
      ? parseDirection(r[m.direction], amt)
      : amt >= 0
        ? "credit"
        : "debit";
    const opening = m.opening_balance ? num(r[m.opening_balance]) : NaN;
    ok.push({
      name,
      phone: m.phone ? (r[m.phone] != null ? String(r[m.phone]).trim() : null) : null,
      amount: Math.abs(amt),
      direction,
      date: m.date ? parseDate(r[m.date]) : new Date().toISOString(),
      details: m.details ? (r[m.details] ? String(r[m.details]) : null) : null,
      currency: m.currency ? (r[m.currency] ? String(r[m.currency]).trim() : null) : null,
      opening_balance: isFinite(opening) && opening !== 0 ? opening : null,
    });
  });
  return { ok, errors };
}

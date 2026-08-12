/**
 * Server-only message rendering: template variables -> final Arabic text.
 * Numbers are always rendered with English digits.
 */
import type { BoardBucket } from "@/lib/followup/board.server";

export const TEMPLATE_KINDS = ["upcoming", "due_today", "overdue", "statement", "thanks"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const TEMPLATE_LABEL: Record<string, string> = {
  upcoming: "تذكير قبل الاستحقاق",
  due_today: "استحقاق اليوم",
  overdue: "مبلغ متأخر",
  statement: "كشف حساب",
  thanks: "شكر بعد السداد",
  digest: "ملخص يومي",
};

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function money(n: number): string {
  return nf.format(Math.round(n * 100) / 100);
}

export function gDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Normalize a phone number into digits-only international form. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d]/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  return d;
}

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => vars[key] ?? "");
}

/** Pick the template kind that matches a bucket's state. */
export function kindForBucket(b: BoardBucket): TemplateKind {
  if (b.days_overdue >= 1) return "overdue";
  if (b.days_overdue === 0) return "due_today";
  return "upcoming";
}

/** Build the variable map for a bucket. */
export function varsForBucket(b: BoardBucket, signature: string): Record<string, string> {
  return {
    name: b.name,
    amount: money(b.net),
    balance: money(b.net),
    currency: b.currency_symbol || b.currency_name,
    due_date: gDate(b.oldest_due),
    days_late: String(Math.max(0, b.days_overdue)),
    tx_count: String(b.tx_count),
    today: gDate(new Date().toISOString()),
    signature,
  };
}

const FALLBACKS: Record<string, string> = {
  upcoming:
    "السلام عليكم {{name}}،\nنذكّركم بمبلغ {{amount}} {{currency}} المستحق بتاريخ {{due_date}}.\nشكراً لتعاونكم.\n\n{{signature}}",
  due_today:
    "السلام عليكم {{name}}،\nيحل اليوم موعد استحقاق مبلغ {{amount}} {{currency}}.\nنرجو التكرم بالسداد.\n\n{{signature}}",
  overdue:
    "السلام عليكم {{name}}،\nالمبلغ المستحق {{amount}} {{currency}} متأخر منذ {{days_late}} يوماً.\nنرجو المبادرة بالسداد.\n\n{{signature}}",
  statement:
    "السلام عليكم {{name}}،\nمرفق كشف حسابكم حتى {{today}}.\nالرصيد: {{balance}} {{currency}}.\n\n{{signature}}",
  thanks: "السلام عليكم {{name}}،\nنشكر لكم سداد مبلغ {{amount}} {{currency}}.\n\n{{signature}}",
};

export function templateBody(
  templates: { kind: string; body: string; is_active: boolean }[],
  kind: string,
): string {
  const t = templates.find((x) => x.kind === kind && x.is_active);
  return t?.body ?? FALLBACKS[kind] ?? FALLBACKS["upcoming"]!;
}

/** Deduplication key: one message per person + kind + channel + day. */
export function dedupeKey(personId: string, kind: string, channel: string, when = new Date()) {
  return `${personId}|${kind}|${channel}|${gDate(when.toISOString())}`;
}

/** True when the current hour falls inside the user's quiet window. */
export function inQuietHours(quietStart: number, quietEnd: number, now = new Date()): boolean {
  const h = now.getUTCHours();
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) return h >= quietStart && h < quietEnd;
  return h >= quietStart || h < quietEnd;
}

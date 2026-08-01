/** Print palette for statement PDFs. */
export const C = {
  primary: "#1d4ed8",
  primarySoft: "#dbeafe",
  accent: "#059669",
  accentSoft: "#d1fae5",
  danger: "#dc2626",
  dangerSoft: "#fee2e2",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  bgAlt: "#f9fafb",
  white: "#ffffff",
};

export function statusFor(closing: number): { label: string; bg: string } {
  if (closing > 0) return { label: "رصيد لكم (له عندك)", bg: C.accent };
  if (closing < 0) return { label: "رصيد عليكم", bg: C.danger };
  return { label: "مسددة بالكامل", bg: C.muted };
}

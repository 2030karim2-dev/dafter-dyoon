/**
 * Safe expression evaluator for amount inputs.
 * Supports + - * / parentheses and decimals.
 * Returns NaN on invalid input — never throws.
 */
export function evalExpr(input: string): number {
  if (!input) return NaN;
  const cleaned = input
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\s|٬|,/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/");
  // Anything outside the numeric grammar is invalid input — never silently
  // truncated like the old parseFloat fallback did.
  if (!/^[-+*/().\d]+$/.test(cleaned)) return NaN;
  // Reject double operators that aren't unary minus
  if (/[+*/]{2,}|--/.test(cleaned)) return NaN;
  try {
    const v = Function(`"use strict"; return (${cleaned});`)();
    return typeof v === "number" && isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

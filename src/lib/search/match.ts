/**
 * Professional Arabic-aware fuzzy search matcher.
 * Handles: tashkeel, hamza/alef/ya/ta-marbuta variants, tatweel, extra spaces,
 * out-of-order tokens, partial (broken) typing, Arabic-Indic digits and
 * loosely formatted phone numbers (spaces, dashes, +, leading 0 / country code).
 */

const AR_INDIC = "٠١٢٣٤٥٦٧٨٩";
const AR_INDIC_EXT = "۰۱۲۳۴۵۶۷۸۹";

/** Converts Arabic-Indic digits to ASCII digits. */
export function toAsciiDigits(s: string): string {
  let out = "";
  for (const ch of s) {
    const a = AR_INDIC.indexOf(ch);
    const b = AR_INDIC_EXT.indexOf(ch);
    out += a > -1 ? String(a) : b > -1 ? String(b) : ch;
  }
  return out;
}

/** Canonical text form used for all comparisons. */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  return toAsciiDigits(input)
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u06D6-\u06ED]/g, "") // tashkeel
    .replace(/\u0640/g, "") // tatweel
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/گ|ك/g, "ك")
    .replace(/\s+/g, " ")
    .trim();
}

/** Only the digits of a string (phone comparison). */
export function digitsOf(input: string | null | undefined): string {
  return input ? toAsciiDigits(input).replace(/\D/g, "") : "";
}

/** Local form of a phone number: drops +, country code and a leading zero. */
function phoneVariants(raw: string): string[] {
  const d = digitsOf(raw);
  if (!d) return [];
  const out = new Set<string>([d]);
  out.add(d.replace(/^0+/, ""));
  for (const cc of ["966", "967", "971", "20", "962", "965"]) {
    if (d.startsWith(cc)) out.add(d.slice(cc.length));
  }
  if (d.length > 9) out.add(d.slice(-9));
  return [...out].filter(Boolean);
}

export interface SearchTarget {
  /** Free text fields: name, notes, details... */
  text?: (string | null | undefined)[];
  /** Phone-like fields. */
  phones?: (string | null | undefined)[];
  /** Numeric fields such as amounts. */
  numbers?: (number | null | undefined)[];
}

/**
 * True when every token of the query is found somewhere in the target.
 * Tokens may arrive in any order and may be partial words.
 */
export function smartMatch(query: string, target: SearchTarget): boolean {
  const q = normalizeText(query);
  if (!q) return true;

  const haystack = (target.text ?? []).map(normalizeText).filter(Boolean);
  const joined = haystack.join(" ");
  const squashed = joined.replace(/\s+/g, "");
  const phones = (target.phones ?? []).flatMap((p) => (p ? phoneVariants(p) : []));
  const numbers = (target.numbers ?? [])
    .filter((n): n is number => n != null)
    .map((n) => String(n));

  const tokens = q.split(" ").filter(Boolean);

  return tokens.every((tok) => {
    const digits = tok.replace(/\D/g, "");
    if (digits && digits.length === tok.length) {
      // pure number token: phone or amount
      const qVariants = phoneVariants(digits);
      if (phones.some((p) => qVariants.some((v) => p.includes(v) || v.includes(p)))) return true;
      if (numbers.some((n) => n.includes(digits))) return true;
      if (squashed.includes(digits)) return true;
      return false;
    }
    if (joined.includes(tok) || squashed.includes(tok.replace(/\s+/g, ""))) return true;
    // fall back to in-order character subsequence (broken typing / typos)
    return subsequence(tok, squashed);
  });
}

/** Whether all characters of `needle` appear in order inside `hay`. */
function subsequence(needle: string, hay: string): boolean {
  if (needle.length < 3 || !hay) return false;
  let i = 0;
  for (const ch of hay) {
    if (ch === needle[i]) i += 1;
    if (i === needle.length) return true;
  }
  return false;
}

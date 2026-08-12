/**
 * Normalize a stored phone number for wa.me links.
 * wa.me requires digits only in international format (no +, no leading zeros).
 * Local Yemeni mobile numbers (9 digits starting with 7) get the 967 prefix.
 */
export function waPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  d = d.replace(/^0+/, "");
  if (d.length === 9 && d.startsWith("7")) d = `967${d}`;
  return d;
}

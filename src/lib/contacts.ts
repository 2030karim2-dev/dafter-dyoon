/**
 * Contact Picker API helper — lets the user grab a phone number straight from
 * the device address book. Only available on supporting browsers (Android
 * Chrome/Edge) over HTTPS.
 */
interface ContactsManager {
  select: (
    props: string[],
    opts?: { multiple?: boolean },
  ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
  getProperties?: () => Promise<string[]>;
}

function manager(): ContactsManager | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as { contacts?: ContactsManager };
  const m = nav.contacts;
  return m && typeof m.select === "function" ? m : null;
}

export function contactPickerSupported() {
  return !!manager();
}

/** Cleans a raw address-book number into a dial-safe string. */
export function cleanPhone(raw: string) {
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? "+" + digits.slice(1).replace(/\+/g, "") : digits;
}

export interface PickedContact {
  name: string | null;
  phone: string | null;
}

/** Opens the device contact picker; returns null when cancelled/unsupported. */
export async function pickContact(): Promise<PickedContact | null> {
  const m = manager();
  if (!m) return null;
  const picked = await m.select(["name", "tel"], { multiple: false });
  const c = picked?.[0];
  if (!c) return null;
  const tel = c.tel?.find((t) => !!t);
  return {
    name: c.name?.find((n) => !!n) ?? null,
    phone: tel ? cleanPhone(tel) : null,
  };
}

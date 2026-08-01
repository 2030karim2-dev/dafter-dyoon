/** Server-only repeat helpers for reminders. */
export type RepeatKind = "none" | "daily" | "weekly" | "monthly";

export function advanceDate(iso: string, kind: RepeatKind): string {
  const d = new Date(iso);
  switch (kind) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    default:
      return iso;
  }
  return d.toISOString();
}

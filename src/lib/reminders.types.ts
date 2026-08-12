/** Client-safe reminder types (no Supabase client import). */
export type RepeatKind = "none" | "daily" | "weekly" | "monthly";

export interface Reminder {
  id: string;
  user_id: string;
  person_id: string | null;
  title: string;
  note: string | null;
  due_date: string;
  is_done: boolean;
  repeat: RepeatKind;
  transaction_id: string | null;
  snoozed_until: string | null;
  created_at: string;
}

import { supabase } from "@/integrations/supabase/client";

export interface BackupSnapshot {
  version: number;
  exportedAt: string;
  user_id: string;
  people: unknown[];
  transactions: unknown[];
  currencies: unknown[];
  reminders: unknown[];
  recurring: unknown[];
}

export async function buildSnapshot(userId: string): Promise<BackupSnapshot> {
  const [people, txs, currencies, reminders, recurring] = await Promise.all([
    supabase.from("people").select("*"),
    supabase.from("transactions").select("*"),
    supabase.from("currencies").select("*"),
    supabase.from("reminders").select("*"),
    supabase.from("recurring_rules").select("*"),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    user_id: userId,
    people: people.data ?? [],
    transactions: txs.data ?? [],
    currencies: currencies.data ?? [],
    reminders: reminders.data ?? [],
    recurring: recurring.data ?? [],
  };
}

/**
 * Reminder mutations — server side only.
 * The UI no longer writes to the reminders table directly.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { advanceDate } from "@/lib/reminders/repeat.server";

export const completeReminderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("reminders")
      .select("id,due_date,repeat")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!r) throw new Error("التذكير غير موجود");
    if (r.repeat && r.repeat !== "none") {
      const next = advanceDate(r.due_date, r.repeat as "daily" | "weekly" | "monthly");
      const { error } = await supabase
        .from("reminders")
        .update({ due_date: next, snoozed_until: null })
        .eq("id", r.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true, rescheduled: next };
    }
    const { error } = await supabase
      .from("reminders")
      .update({ is_done: true })
      .eq("id", r.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, rescheduled: null };
  });

export const snoozeReminderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), days: z.number().int().min(1).max(365) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const d = new Date();
    d.setDate(d.getDate() + data.days);
    const iso = d.toISOString();
    const { error } = await context.supabase
      .from("reminders")
      .update({ due_date: iso, snoozed_until: iso })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, due_date: iso };
  });

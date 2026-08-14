/**
 * Transaction server functions — delete + undo.
 * The authenticated user id is resolved on the server (middleware context),
 * never taken from the client, so these stay safe even in edge cases such as
 * a stale/re-used session where a client-supplied user_id would be wrong.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Hard-delete a single transaction belonging to the current user. */
export const deleteTransactionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const undoInput = z.object({
  person_id: z.string().uuid(),
  amount: z.number().positive(),
  direction: z.enum(["credit", "debit"]),
  currency_id: z.string().uuid(),
  transaction_date: z.string().min(1),
  details: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  is_paid: z.boolean().optional(),
});

/** Restore a previously deleted transaction (used by the toast "تراجع"). */
export const undoTransactionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => undoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      person_id: data.person_id,
      amount: data.amount,
      direction: data.direction,
      currency_id: data.currency_id,
      transaction_date: data.transaction_date,
      details: data.details ?? null,
      due_date: data.due_date ?? null,
      is_paid: data.is_paid ?? false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

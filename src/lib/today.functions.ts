/**
 * Today workspace + promises + payments — thin server-function wrappers only.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { loadToday } from "@/lib/today/board.server";
import { recordPayment, sweepBrokenPromises } from "@/lib/today/payments.server";

export type { TodayPayload, TodayTask, TodayCounts, TaskKind } from "@/lib/today/board.server";

export const getTodayFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await sweepBrokenPromises(context.supabase, context.userId);
    return loadToday(context.supabase, context.userId);
  });

const promiseSchema = z.object({
  person_id: z.string().uuid(),
  currency_id: z.string().uuid(),
  amount: z.number().positive(),
  promised_date: z.string().min(8).max(10),
  note: z.string().max(300).nullable().optional(),
});

export const createPromiseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => promiseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("payment_promises").insert({
      user_id: context.userId,
      person_id: data.person_id,
      currency_id: data.currency_id,
      amount: data.amount,
      promised_date: data.promised_date,
      note: data.note ?? null,
      status: "open",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolvePromiseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["kept", "broken", "cancelled", "open"]),
      promised_date: z.string().min(8).max(10).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch = {
      status: data.status,
      ...(data.status === "kept" ? { kept_at: new Date().toISOString() } : {}),
      ...(data.promised_date ? { promised_date: data.promised_date } : {}),
    };
    const { error } = await context.supabase.from("payment_promises")
      .update(patch).eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Person promises (all statuses) for the customer screen. */
export const getPromisesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ person_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("payment_promises")
      .select("id,currency_id,amount,promised_date,status,note,created_at")
      .eq("user_id", context.userId)
      .eq("person_id", data.person_id)
      .order("promised_date", { ascending: false });
    return rows ?? [];
  });

const paymentSchema = z.object({
  person_id: z.string().uuid(),
  currency_id: z.string().uuid(),
  amount: z.number().positive(),
  paid_at: z.string().min(8),
  note: z.string().max(300).nullable().optional(),
});

/** Record a (possibly partial) payment and allocate it FIFO to oldest debts. */
export const recordPaymentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => paymentSchema.parse(d))
  .handler(async ({ data, context }) =>
    recordPayment(context.supabase, context.userId, {
      person_id: data.person_id,
      currency_id: data.currency_id,
      amount: data.amount,
      paid_at: data.paid_at,
      note: data.note ?? null,
    }),
  );

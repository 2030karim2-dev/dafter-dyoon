/**
 * Payment plans (خطط السداد) — server functions.
 * إنشاء خطة يحوّل كل قسط إلى وعد (payment_promises) مربوط بـ plan_id،
 * فيظهر تلقائياً في صندوق اليوم ولوحة المتابعة ويُحتسب محفوظاً عند السداد.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { buildInstallments } from "@/lib/plans";

export interface PlanInstallment {
  id: string;
  amount: number;
  promised_date: string;
  status: string;
}

export interface PlanDTO {
  id: string;
  person_id: string;
  currency_id: string;
  total_amount: number;
  installments_count: number;
  installment_amount: number;
  frequency: string;
  start_date: string;
  status: string;
  note: string | null;
  created_at: string;
  installments: PlanInstallment[];
  kept_count: number;
  paid_total: number;
}

interface PromiseRow {
  id: string;
  plan_id: string | null;
  amount: number;
  promised_date: string;
  status: string;
  kept_at: string | null;
}

const createPlanSchema = z.object({
  person_id: z.string().uuid(),
  currency_id: z.string().uuid(),
  total_amount: z.number().positive(),
  installments_count: z.number().int().min(2).max(24),
  frequency: z.enum(["weekly", "monthly"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(300).nullable().optional(),
});

/** إنشاء خطة سداد + توليد أقساطها كوعود متابعة. */
export const createPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createPlanSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const installments = buildInstallments(data);
    const installmentAmount = Math.round((data.total_amount / data.installments_count) * 100) / 100;

    const { data: plan, error } = await supabase
      .from("payment_plans")
      .insert({
        user_id: userId,
        person_id: data.person_id,
        currency_id: data.currency_id,
        total_amount: data.total_amount,
        installments_count: data.installments_count,
        installment_amount: installmentAmount,
        frequency: data.frequency,
        start_date: data.start_date,
        status: "active",
        note: data.note ?? null,
      })
      .select("id")
      .single();
    if (error || !plan) throw new Error(error?.message ?? "فشل إنشاء خطة السداد");

    const promises = installments.map((ins) => ({
      user_id: userId,
      person_id: data.person_id,
      currency_id: data.currency_id,
      amount: ins.amount,
      promised_date: ins.promised_date,
      status: "open" as const,
      plan_id: plan.id,
      note: data.note ? `قسط من: ${data.note}` : null,
    }));
    const { error: insErr } = await supabase.from("payment_promises").insert(promises);
    if (insErr) {
      // تراجع يدوي: عدم ترك خطة يتيمة في حال فشل إدراج الأقساط
      await supabase.from("payment_plans").delete().eq("id", plan.id).eq("user_id", userId);
      throw new Error(insErr.message);
    }

    return { plan_id: plan.id, installments: installments.length };
  });

/** قائمة الخطط (لعميل واحد أو الكل) مع أقساطها ومؤشرات السداد. */
export const getPlansFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ person_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<PlanDTO[]> => {
    const { supabase, userId } = context;

    const { data: plans } = await (data.person_id
      ? supabase
          .from("payment_plans")
          .select("*")
          .eq("user_id", userId)
          .eq("person_id", data.person_id)
          .order("created_at", { ascending: false })
      : supabase
          .from("payment_plans")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }));

    const rows = plans ?? [];
    const planIds = rows.map((r) => r.id);
    const { data: promisesRaw } = planIds.length
      ? await supabase
          .from("payment_promises")
          .select("id,plan_id,amount,promised_date,status,kept_at")
          .eq("user_id", userId)
          .in("plan_id", planIds)
      : { data: [] as PromiseRow[] };
    const promises = (promisesRaw ?? []) as PromiseRow[];

    const byPlan = new Map<string, PromiseRow[]>();
    for (const pr of promises ?? []) {
      if (!pr.plan_id) continue;
      const arr = byPlan.get(pr.plan_id) ?? [];
      arr.push(pr);
      byPlan.set(pr.plan_id, arr);
    }

    return rows.map((r) => {
      const items = (byPlan.get(r.id) ?? []).sort(
        (a, b) => new Date(a.promised_date).getTime() - new Date(b.promised_date).getTime(),
      );
      const kept = items.filter((i) => i.status === "kept");
      return {
        id: r.id,
        person_id: r.person_id,
        currency_id: r.currency_id,
        total_amount: Number(r.total_amount),
        installments_count: Number(r.installments_count),
        installment_amount: Number(r.installment_amount),
        frequency: r.frequency,
        start_date: r.start_date,
        status: r.status,
        note: r.note,
        created_at: r.created_at,
        installments: items.map((i) => ({
          id: i.id,
          amount: Number(i.amount),
          promised_date: i.promised_date,
          status: i.status,
        })),
        kept_count: kept.length,
        paid_total: kept.reduce((s, i) => s + Number(i.amount), 0),
      };
    });
  });

/** إلغاء خطة: تُلغى الخطة وتُلغى أقساطها المفتوحة (المحفوظة تبقى). */
export const cancelPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("payment_plans")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    await supabase
      .from("payment_promises")
      .update({ status: "cancelled" })
      .eq("user_id", userId)
      .eq("plan_id", data.id)
      .eq("status", "open");
    return { ok: true };
  });

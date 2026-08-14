/**
 * Aging report server function — thin wrapper around the pure engine.
 * بيانات المستخدم تُحل على الخادم عبر requireSupabaseAuth ولا تُؤخذ من المتصفح.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeAging, type AgingReport } from "@/lib/aging.server";

export type { AgingReport, AgingRow, AgingBucket } from "@/lib/aging.server";
export { BUCKET_LABEL } from "@/lib/aging.server";

interface DebtRow {
  id: string;
  person_id: string;
  amount: number | string;
  transaction_date: string;
  due_date: string | null;
  details: string | null;
}

/** تقرير أعمار الديون لعملة واحدة (أو كل العملات عند حذف المعرّف). */
export const getAgingReportFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ currency_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<AgingReport> => {
    const { supabase, userId } = context;

    // 1) ديون المعاملات (credit = مستحق على العميل)
    const { data: debts } = await (data.currency_id
      ? supabase
          .from("transactions")
          .select("id,person_id,amount,transaction_date,due_date,details")
          .eq("user_id", userId)
          .eq("direction", "credit")
          .eq("is_paid", false)
          .eq("currency_id", data.currency_id)
          .limit(5000)
      : supabase
          .from("transactions")
          .select("id,person_id,amount,transaction_date,due_date,details")
          .eq("user_id", userId)
          .eq("direction", "credit")
          .eq("is_paid", false)
          .limit(5000));

    // 2) الأرصدة الافتتاحية (credit) — تُعَدّ ديوناً أعمارها من تاريخ الافتتاح
    const { data: openings } = await (data.currency_id
      ? supabase
          .from("opening_balances")
          .select("id,person_id,amount,opening_date")
          .eq("user_id", userId)
          .eq("direction", "credit")
          .eq("currency_id", data.currency_id)
      : supabase
          .from("opening_balances")
          .select("id,person_id,amount,opening_date")
          .eq("user_id", userId)
          .eq("direction", "credit"));

    const txRows = (debts ?? []) as DebtRow[];
    const openRows: DebtRow[] = (
      (openings ?? []) as {
        id: string;
        person_id: string;
        amount: number | string;
        opening_date: string;
      }[]
    ).map((o) => ({
      id: `open:${o.id}`,
      person_id: o.person_id,
      amount: o.amount,
      transaction_date: o.opening_date,
      due_date: null,
      details: "رصيد افتتاحي",
    }));

    const rows = [...txRows, ...openRows];
    // التخصيصات تُسأل على معرّفات المعاملات الحقيقية فقط (ليست uuid لأرصدة الافتتاح)
    const txIds = txRows.map((d) => d.id);
    const personIds = Array.from(new Set(rows.map((d) => d.person_id)));

    const [allocRes, peopleRes] = await Promise.all([
      txIds.length
        ? supabase
            .from("payment_allocations")
            .select("debt_tx_id,amount")
            .eq("user_id", userId)
            .in("debt_tx_id", txIds)
        : Promise.resolve({
            data: [] as { debt_tx_id: string; amount: number }[],
          }),
      personIds.length
        ? supabase.from("people").select("id,name,phone").in("id", personIds)
        : Promise.resolve({
            data: [] as { id: string; name: string; phone: string | null }[],
          }),
    ]);

    return computeAging({
      debts: rows,
      people: (peopleRes.data ?? []) as { id: string; name: string; phone: string | null }[],
      allocations: (allocRes.data ?? []) as { debt_tx_id: string; amount: number }[],
    });
  });

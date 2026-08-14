/**
 * Receipt vouchers (سندات القبض) — server functions.
 * الرقم التسلسلي يُولَّد تلقائياً في قاعدة البيانات (عَدّاد لكل مستخدم)،
 * والمبلغ يُحوَّل إلى كتابة عربية على الخادم بنفس قيمة السند.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { amountToArabicWords } from "@/lib/money/words";

export interface ReceiptVoucher {
  id: string;
  serial_number: number;
  person_id: string;
  person_name: string;
  phone: string | null;
  payment_tx_id: string | null;
  currency_id: string;
  currency_name: string;
  amount: number;
  amount_words: string;
  note: string | null;
  issued_at: string;
}

const createReceiptSchema = z.object({
  person_id: z.string().uuid(),
  payment_tx_id: z.string().uuid().optional().nullable(),
  currency_id: z.string().uuid(),
  amount: z.number().positive(),
  note: z.string().max(300).nullable().optional(),
});

/** إنشاء سند قبض وربطه بدفعة مسجلة مسبقاً. */
export const createReceiptVoucherFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createReceiptSchema.parse(d))
  .handler(async ({ data, context }): Promise<ReceiptVoucher> => {
    const { supabase, userId } = context;

    const [{ data: person }, { data: cur }] = await Promise.all([
      supabase
        .from("people")
        .select("name,phone")
        .eq("id", data.person_id)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("currencies")
        .select("name")
        .eq("id", data.currency_id)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (!person) throw new Error("العميل غير موجود");

    const currencyName = cur?.name ?? "";
    const amountWords = amountToArabicWords(data.amount, currencyName);

    const { data: inserted, error } = await supabase
      .from("receipt_vouchers")
      .insert({
        user_id: userId,
        person_id: data.person_id,
        payment_tx_id: data.payment_tx_id ?? null,
        currency_id: data.currency_id,
        amount: data.amount,
        amount_words: amountWords,
        note: data.note ?? null,
      })
      .select("*")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "فشل إنشاء سند القبض");

    return {
      id: inserted.id,
      serial_number: Number(inserted.serial_number),
      person_id: inserted.person_id,
      person_name: person.name,
      phone: person.phone,
      payment_tx_id: inserted.payment_tx_id,
      currency_id: inserted.currency_id,
      currency_name: currencyName,
      amount: Number(inserted.amount),
      amount_words: inserted.amount_words,
      note: inserted.note,
      issued_at: inserted.issued_at,
    };
  });

/** سجل السندات مع حل أسماء العملاء والعملات على الخادم. */
export const getReceiptVouchersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReceiptVoucher[]> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("receipt_vouchers")
      .select("*")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false })
      .limit(200);

    const rows = data ?? [];
    const personIds = Array.from(new Set(rows.map((r) => r.person_id)));
    const curIds = Array.from(new Set(rows.map((r) => r.currency_id)));

    const [{ data: people }, { data: curs }] = await Promise.all([
      personIds.length
        ? supabase.from("people").select("id,name,phone").in("id", personIds)
        : Promise.resolve({ data: [] as { id: string; name: string; phone: string | null }[] }),
      curIds.length
        ? supabase.from("currencies").select("id,name").in("id", curIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const nameOf = new Map((people ?? []).map((p) => [p.id, p]));
    const curOf = new Map((curs ?? []).map((c) => [c.id, c]));

    return rows.map((r) => ({
      id: r.id,
      serial_number: Number(r.serial_number),
      person_id: r.person_id,
      person_name: nameOf.get(r.person_id)?.name ?? "—",
      phone: nameOf.get(r.person_id)?.phone ?? null,
      payment_tx_id: r.payment_tx_id,
      currency_id: r.currency_id,
      currency_name: curOf.get(r.currency_id)?.name ?? "",
      amount: Number(r.amount),
      amount_words: r.amount_words,
      note: r.note,
      issued_at: r.issued_at,
    }));
  });

/** حذف سند (تصحيح إداري). */
export const deleteReceiptVoucherFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("receipt_vouchers")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Wallet accounts (المحافظ الإلكترونية اليمنية) + طلب السداد.
 * الإدخال اليدوي: أرقام حسابات المستخدم تُخزَّن في wallet_accounts،
 * ويُبنى منها طلب سداد احترافي + نص QR يُرسل للعميل عبر واتساب.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type WalletProvider = "gib" | "shiln" | "floosk" | "geel" | "amwal";

export interface WalletAccount {
  id: string;
  provider: WalletProvider;
  account_number: string;
  holder_name: string | null;
  is_active: boolean;
}

/** المحافظ المدعومة بالترتيب الظاهر في الإعدادات. */
export const WALLET_PROVIDERS: { id: WalletProvider; label: string }[] = [
  { id: "gib", label: "جيب" },
  { id: "shiln", label: "شلن" },
  { id: "floosk", label: "فلوسك" },
  { id: "geel", label: "جوالي" },
  { id: "amwal", label: "ام فلوس" },
];

const PROVIDER_LABELS: Record<string, string> = Object.fromEntries(
  WALLET_PROVIDERS.map((p) => [p.id, p.label]),
);

export function walletLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/** قائمة حسابات المحافظ للمستخدم. */
export const getWalletsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WalletAccount[]> => {
    const { data } = await context.supabase
      .from("wallet_accounts")
      .select("*")
      .eq("user_id", context.userId)
      .order("provider");
    return (data ?? []) as WalletAccount[];
  });

const saveWalletSchema = z.object({
  provider: z.enum(["gib", "shiln", "floosk", "geel", "amwal"]),
  account_number: z.string().trim().min(1).max(40),
  holder_name: z.string().trim().max(80).nullable().optional(),
  is_active: z.boolean(),
});

/** حفظ/تحديث حساب محفظة (حساب واحد لكل موفر). */
export const saveWalletFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveWalletSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("wallet_accounts").upsert(
      {
        user_id: context.userId,
        provider: data.provider,
        account_number: data.account_number,
        holder_name: data.holder_name?.trim() || null,
        is_active: data.is_active,
      },
      { onConflict: "user_id,provider" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** حذف حساب محفظة. */
export const deleteWalletFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("wallet_accounts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const paymentRequestSchema = z.object({
  person_id: z.string().uuid(),
  currency_id: z.string().uuid(),
  amount: z.number().positive(),
});

export interface PaymentRequestPayload {
  person_name: string;
  person_phone: string | null;
  currency_name: string;
  amount: number;
  company_name: string | null;
  wallets: WalletAccount[];
  message: string;
  qr_payload: string;
}

/** بناء طلب سداد: رسالة احترافية + نص QR يحوي أرقام المحافظ المفعلة. */
export const buildPaymentRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => paymentRequestSchema.parse(d))
  .handler(async ({ data, context }): Promise<PaymentRequestPayload> => {
    const { supabase, userId } = context;

    const [{ data: person }, { data: cur }, { data: company }, { data: wallets }] =
      await Promise.all([
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
        supabase.from("company_profile").select("name,phone").eq("user_id", userId).maybeSingle(),
        supabase
          .from("wallet_accounts")
          .select("*")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("provider"),
      ]);
    if (!person) throw new Error("العميل غير موجود");

    const walletsList = (wallets ?? []) as WalletAccount[];
    const companyName = company?.name ?? "دفترك";
    const curName = cur?.name ?? "";
    const amt = Number(data.amount).toLocaleString("en-US", { maximumFractionDigits: 2 });

    const lines: string[] = [];
    lines.push(`السلام عليكم ${person.name}،`);
    lines.push("");
    lines.push(`إشعار سداد من *${companyName}*`);
    lines.push("");
    lines.push(`المبلغ المستحق: ${amt} ${curName}`);
    lines.push("");
    if (walletsList.length > 0) {
      lines.push("المرجو التحويل إلى إحدى المحافظ التالية:");
      for (const w of walletsList) {
        const holder = w.holder_name ? ` (${w.holder_name})` : "";
        lines.push(`• ${walletLabel(w.provider)}: ${w.account_number}${holder}`);
      }
    }
    lines.push("");
    lines.push("بعد التحويل أرسل لنا رقم العملية لتأكيد السداد.");
    lines.push("");
    lines.push(company?.phone ? `📞 ${company.phone}` : companyName);

    const message = lines.join("\n");

    return {
      person_name: person.name,
      person_phone: person.phone,
      currency_name: curName,
      amount: data.amount,
      company_name: companyName,
      wallets: walletsList,
      message,
      qr_payload: message,
    };
  });

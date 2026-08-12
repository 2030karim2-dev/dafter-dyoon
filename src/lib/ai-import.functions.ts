import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";

const MappingSchema = z.object({
  name: z.string().describe("اسم العمود الذي يحوي اسم العميل، فارغ إن لم يوجد"),
  amount: z.string().describe("اسم العمود الذي يحوي المبلغ"),
  direction: z.string().describe("اسم عمود نوع الحركة (له/عليه أو مدين/دائن)، فارغ إن لم يوجد"),
  date: z.string().describe("اسم عمود التاريخ، فارغ إن لم يوجد"),
  details: z.string().describe("اسم عمود التفاصيل/الوصف/الملاحظات، فارغ إن لم يوجد"),
  phone: z.string().describe("اسم عمود رقم الجوال، فارغ إن لم يوجد"),
  currency: z.string().describe("اسم عمود العملة، فارغ إن لم يوجد"),
  opening_balance: z.string().describe("اسم عمود الرصيد الافتتاحي/السابق إن وجد، فارغ"),
});

/** Use AI to guess which columns map to which fields. */
export const aiSuggestImportMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        headers: z.array(z.string()).min(1).max(60),
        sampleRows: z.array(z.record(z.string(), z.unknown())).max(5),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI غير متاح حالياً");
    const gateway = createLovableAiGatewayProvider(key);
    const { output } = await generateText({
      model: gateway(MODEL),
      output: Output.object({ schema: MappingSchema }),
      system:
        "أنت محلل بيانات محاسبية عربية. مهمتك تحديد ربط الأعمدة بحقول النظام بدقة. اختر اسم العمود من القائمة المعطاة فقط، أو أعد سلسلة فارغة إن لم يوجد عمود مناسب.",
      prompt: `الأعمدة المتاحة:\n${data.headers.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n\nعيّنة من البيانات:\n${JSON.stringify(data.sampleRows.slice(0, 3), null, 2)}`,
    });
    // sanitize: only allow headers that actually exist
    const allow = new Set(data.headers);
    const fix = (v: string) => (allow.has(v) ? v : "");
    return {
      name: fix(output.name),
      amount: fix(output.amount),
      direction: fix(output.direction),
      date: fix(output.date),
      details: fix(output.details),
      phone: fix(output.phone),
      currency: fix(output.currency),
      opening_balance: fix(output.opening_balance),
    };
  });

/** Extract structured customer/transaction rows from raw PDF text. */
export const aiExtractFromPdfText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(20).max(60000) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI غير متاح حالياً");
    const gateway = createLovableAiGatewayProvider(key);
    const { output } = await generateText({
      model: gateway(MODEL),
      output: Output.object({
        schema: z.object({
          rows: z
            .array(
              z.object({
                name: z.string(),
                phone: z.string().optional(),
                amount: z.number(),
                direction: z.enum(["credit", "debit"]),
                date: z.string().optional(),
                details: z.string().optional(),
              }),
            )
            .max(500),
        }),
      }),
      system:
        "استخرج صفوف الديون من نص PDF محاسبي عربي. كل صف يحوي: الاسم، المبلغ، الاتجاه (credit=له عندي/دائن، debit=عليه/مدين). تجاهل الترويسات والإجماليات. أعد قائمة منظمة فقط.",
      prompt: data.text.slice(0, 60000),
    });
    return output;
  });

/** Extract opening balances batch: split merged name+phone, detect amount/currency/direction/last payment. */
export const aiExtractOpeningBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        headers: z.array(z.string()).min(1).max(40),
        rows: z.array(z.record(z.string(), z.unknown())).min(1).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI غير متاح حالياً");
    const gateway = createLovableAiGatewayProvider(key);
    const { output } = await generateText({
      model: gateway(MODEL),
      output: Output.object({
        schema: z.object({
          rows: z
            .array(
              z.object({
                name: z.string().describe("اسم العميل فقط بدون رقم الهاتف"),
                phone: z.string().describe("رقم الجوال إن وجد، فارغ إن لم يوجد"),
                amount: z.number().describe("المبلغ موجب دائماً"),
                direction: z
                  .enum(["credit", "debit"])
                  .describe("credit=له عندي/الزبون دائن، debit=عليه/مدين"),
                currency: z
                  .enum(["SAR", "YER", "USD", "OTHER"])
                  .describe("SAR=ريال سعودي، YER=ريال يمني"),
                last_payment_amount: z.number().describe("آخر دفعة إن وجدت، 0 إن لم يوجد"),
                last_payment_date: z.string().describe("تاريخ آخر دفعة YYYY-MM-DD أو فارغ"),
                opening_date: z.string().describe("تاريخ الرصيد الافتتاحي YYYY-MM-DD أو فارغ"),
                notes: z.string().describe("ملاحظات إضافية أو فارغ"),
              }),
            )
            .max(80),
        }),
      }),
      system:
        "أنت مساعد محاسبي عربي خبير. ستحلل صفوف عملاء من ملف اكسل لمحل تجاري يمني/سعودي. " +
        "في كل صف عمود الاسم قد يحوي اسم العميل ورقم جواله مدمجين — افصلهما: الأرقام (9-15 رقم) رقم هاتف، الباقي اسم. " +
        "حدد الاتجاه: 'له/دائن/+' = credit، 'عليه/مدين/-' = debit. إن كان المبلغ سالب اعتبره debit وأعد القيمة المطلقة. " +
        "حدد العملة من السياق (ر.ي/يمني=YER، ر.س/سعودي=SAR). إن لم تظهر العملة، خمّن YER للمبالغ الكبيرة (>10000) و SAR للصغيرة. " +
        "استخرج آخر دفعة وتاريخها إن وجدت أعمدة مناسبة. تجاهل صفوف الإجماليات والترويسات.",
      prompt: `الأعمدة: ${JSON.stringify(data.headers)}\n\nالصفوف:\n${JSON.stringify(data.rows)}`,
    });
    return output;
  });

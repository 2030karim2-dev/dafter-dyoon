import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";

/**
 * Analyze a customer's debt history with AI and produce a health score (0-100)
 * + rating tag (excellent | good | average | risky | bad) + short Arabic reason.
 * Persists the result in `customer_ratings`.
 */
export const analyzeCustomerRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ person_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: person }, { data: txs }] = await Promise.all([
      supabase
        .from("people")
        .select("id,name")
        .eq("id", data.person_id)
        .eq("user_id", userId)
        .single(),
      supabase
        .from("transactions")
        .select("amount,direction,transaction_date,due_date,is_paid,details")
        .eq("person_id", data.person_id)
        .eq("user_id", userId)
        .order("transaction_date", { ascending: true })
        .limit(200),
    ]);
    if (!person) throw new Error("لم يتم العثور على الشخص");

    const list = txs ?? [];
    const today = new Date();
    let totalCredit = 0;
    let totalDebit = 0;
    let overdueCount = 0;
    let paidOnTime = 0;
    let paidLate = 0;
    let unpaidWithDue = 0;
    let avgDelay = 0;
    let delaySamples = 0;

    for (const t of list) {
      const amt = Number(t.amount) || 0;
      if (t.direction === "credit") totalCredit += amt;
      else totalDebit += amt;
      if (t.due_date) {
        const due = new Date(t.due_date);
        if (t.is_paid) {
          if (due >= new Date(t.transaction_date)) paidOnTime += 1;
          else paidLate += 1;
        } else if (due < today) {
          overdueCount += 1;
          unpaidWithDue += 1;
          avgDelay += Math.floor((today.getTime() - due.getTime()) / 86400000);
          delaySamples += 1;
        } else {
          unpaidWithDue += 1;
        }
      }
    }
    const summary = {
      transactions: list.length,
      total_credit: totalCredit,
      total_debit: totalDebit,
      balance: totalCredit - totalDebit,
      overdue_count: overdueCount,
      unpaid_with_due: unpaidWithDue,
      paid_on_time: paidOnTime,
      paid_late: paidLate,
      avg_delay_days: delaySamples ? Math.round(avgDelay / delaySamples) : 0,
    };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI غير متاح حالياً");
    const gateway = createLovableAiGatewayProvider(key);

    const { output } = await generateText({
      model: gateway(MODEL),
      output: Output.object({
        schema: z.object({
          score: z.number().min(0).max(100).describe("درجة الصحة المالية للعميل من 0 إلى 100"),
          rating: z.enum(["excellent", "very_good", "good", "average", "high_risk"]),
          reason: z.string().max(220).describe("سبب التقييم بالعربية في جملة أو جملتين"),
        }),
      }),
      system:
        "أنت محلل ائتماني محترف. حلّل سلوك السداد لعميل بناءً على ملخص معاملاته وأعطه درجة صحة مالية (0-100) وتصنيفًا. كلما زاد السداد في الوقت وقلت المتأخرات ارتفعت الدرجة. excellent ≥ 90، very_good 75-89، good 60-74، average 40-59، high_risk < 40. السبب بالعربية فقط ومختصر.",
      prompt: `الاسم: ${person.name}\nالبيانات: ${JSON.stringify(summary)}`,
    });

    await supabase.from("customer_ratings").upsert(
      {
        user_id: userId,
        person_id: data.person_id,
        score: output.score,
        rating: output.rating,
        reason: output.reason,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "person_id" },
    );

    return { ...output, summary };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  displayName: z.string().max(60).nullable(),
  baseCurrencyId: z.string().uuid().nullable(),
});

/**
 * Completes onboarding server-side: sets the base currency and marks the
 * profile as onboarded. The chosen currency is marked as base FIRST so a
 * mid-flight failure never leaves the account without any base currency.
 */
export const completeOnboardingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.baseCurrencyId) {
      const { error: e1 } = await supabase
        .from("currencies")
        .update({ is_base: true })
        .eq("id", data.baseCurrencyId)
        .eq("user_id", userId);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supabase
        .from("currencies")
        .update({ is_base: false })
        .eq("user_id", userId)
        .neq("id", data.baseCurrencyId);
      if (e2) throw new Error(e2.message);
    }

    const { error: e3 } = await supabase
      .from("profiles")
      .upsert(
        { user_id: userId, display_name: data.displayName, onboarded: true },
        { onConflict: "user_id" },
      );
    if (e3) throw new Error(e3.message);

    return { ok: true };
  });

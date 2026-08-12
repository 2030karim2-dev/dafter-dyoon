import { useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingFlow } from "@/components/OnboardingFlow";

/** Shows onboarding flow once per user (until profile.onboarded = true). */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [needs, setNeeds] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading || !user) {
      setNeeds(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setNeeds(!data?.onboarded);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (needs === null) {
    // Branded loader instead of a blank flash while checking onboarded status.
    return (
      <div className="fixed inset-0 z-[90] bg-gradient-hero flex items-center justify-center">
        <div className="size-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      </div>
    );
  }
  if (needs) return <OnboardingFlow onDone={() => setNeeds(false)} />;
  return <>{children}</>;
}

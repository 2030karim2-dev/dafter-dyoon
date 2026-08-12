import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** Currencies are fully independent — no conversion rate exists anywhere. */
export interface Currency {
  id: string;
  name: string;
  symbol: string;
  is_base: boolean;
}

let cached: Currency[] | null = null;
let cachedForUser: string | null = null;
const subs = new Set<(c: Currency[]) => void>();

/** Clears the module-level cache — must be called on sign-out / account switch. */
export function resetCurrenciesCache() {
  cached = null;
  cachedForUser = null;
  subs.forEach((s) => s([]));
}

export function useCurrencies() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const validCache = uid !== null && cachedForUser === uid && cached !== null;
  const [currencies, setCurrencies] = useState<Currency[]>(validCache ? cached! : []);
  const [loading, setLoading] = useState(!validCache);

  useEffect(() => {
    if (!uid) return;
    // Account switched: drop the previous user's cached currencies immediately.
    if (cachedForUser !== uid) {
      cached = null;
      cachedForUser = uid;
    }
    const sub = (c: Currency[]) => setCurrencies(c);
    subs.add(sub);
    if (!cached) {
      setLoading(true);
      (async () => {
        const { data } = await supabase
          .from("currencies")
          .select("id,name,symbol,is_base")
          .eq("user_id", uid)
          .order("is_base", { ascending: false });
        if (cachedForUser !== uid) return; // account switched mid-flight
        cached = (data ?? []) as Currency[];
        subs.forEach((s) => s(cached!));
        setLoading(false);
      })();
    }
    return () => {
      subs.delete(sub);
    };
  }, [uid]);

  const refresh = async () => {
    if (!uid) return;
    const { data } = await supabase
      .from("currencies")
      .select("id,name,symbol,is_base")
      .eq("user_id", uid)
      .order("is_base", { ascending: false });
    cached = (data ?? []) as Currency[];
    cachedForUser = uid;
    subs.forEach((s) => s(cached!));
  };

  const base = currencies.find((c) => c.is_base) ?? currencies[0];

  return { currencies, base, loading, refresh };
}

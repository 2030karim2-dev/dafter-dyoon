import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Search, User, ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { fmtMoney, fmtDate } from "@/lib/format";
import { smartMatch } from "@/lib/search/match";

export const Route = createFileRoute("/app/search")({ component: SearchPage });

interface Person {
  id: string;
  name: string;
  phone: string | null;
}
interface Tx {
  id: string;
  person_id: string;
  amount: number;
  direction: string;
  transaction_date: string;
  details: string | null;
}

function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: t }] = await Promise.all([
        supabase.from("people").select("id,name,phone").eq("user_id", user.id),
        supabase
          .from("transactions")
          .select("id,person_id,amount,direction,transaction_date,details")
          .eq("user_id", user.id)
          .order("transaction_date", { ascending: false })
          .limit(500),
      ]);
      setPeople((p ?? []) as Person[]);
      setTxs((t ?? []) as Tx[]);
    })();
  }, [user]);

  const pMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const term = q.trim();
  const peopleHits = term
    ? people.filter((p) => smartMatch(term, { text: [p.name], phones: [p.phone] })).slice(0, 30)
    : [];
  const txHits = term
    ? txs
        .filter((t) =>
          smartMatch(term, {
            text: [t.details, pMap.get(t.person_id)?.name],
            phones: [pMap.get(t.person_id)?.phone],
            numbers: [t.amount],
          }),
        )
        .slice(0, 40)
    : [];

  return (
    <div className="space-y-3">
      <PageHeader icon={Search} title="بحث شامل" subtitle="ابحث في العملاء والمعاملات" />
      <SearchBar value={q} onChange={setQ} placeholder="اسم متقطع، رقم هاتف، مبلغ، تفاصيل..." />

      {!term ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Search className="size-10 mb-2 opacity-40" />
          <div className="text-[12px]">ابدأ بالكتابة للبحث</div>
        </div>
      ) : (
        <div className="space-y-3">
          {peopleHits.length > 0 && (
            <Section icon={User} title={`الأشخاص (${peopleHits.length})`}>
              {peopleHits.map((p) => (
                <Link
                  key={p.id}
                  to="/app/person/$id"
                  params={{ id: p.id }}
                  className="block bg-card border rounded-lg p-2 hover:shadow-card transition"
                >
                  <div className="font-semibold text-[12px]">{p.name}</div>
                  {p.phone && (
                    <div className="text-[10px] text-muted-foreground" dir="ltr">
                      {p.phone}
                    </div>
                  )}
                </Link>
              ))}
            </Section>
          )}

          {txHits.length > 0 && (
            <Section icon={ArrowLeftRight} title={`المعاملات (${txHits.length})`}>
              {txHits.map((t) => {
                const credit = t.direction === "credit";
                return (
                  <Link
                    key={t.id}
                    to="/app/person/$id"
                    params={{ id: t.person_id }}
                    className="block bg-card border rounded-lg p-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold truncate">
                          {pMap.get(t.person_id)?.name ?? "—"}
                        </div>
                        {t.details && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {t.details}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          {fmtDate(t.transaction_date)}
                        </div>
                      </div>
                      <div
                        className={`font-bold text-[12px] tabular-nums ${credit ? "text-success" : "text-danger"}`}
                      >
                        {credit ? "+" : "-"}
                        {fmtMoney(Number(t.amount))}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </Section>
          )}

          {peopleHits.length === 0 && txHits.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-[12px]">
              لا توجد نتائج لـ "{q}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground px-1">
        <Icon className="size-3.5" /> {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

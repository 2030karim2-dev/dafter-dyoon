import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { User, Wallet, Loader2, Search } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/format";
import { smartMatch } from "@/lib/search/match";

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
  details: string | null;
  transaction_date: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");

  // React Query cache shared across opens — no refetch storm on every open.
  const { data, isFetching } = useQuery({
    queryKey: ["global-search", user?.id],
    queryFn: async () => {
      const [{ data: p }, { data: t }] = await Promise.all([
        supabase
          .from("people")
          .select("id,name,phone")
          .eq("user_id", user!.id)
          .eq("is_archived", false)
          .limit(500),
        supabase
          .from("transactions")
          .select("id,person_id,amount,direction,details,transaction_date")
          .eq("user_id", user!.id)
          .order("transaction_date", { ascending: false })
          .limit(500),
      ]);
      return { people: (p ?? []) as Person[], txs: (t ?? []) as Tx[] };
    },
    enabled: open && !!user,
    staleTime: 60_000,
  });
  const people = data?.people ?? [];
  const txs = data?.txs ?? [];
  const loading = open && isFetching && !data;

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const nq = q.trim();
  const results = useMemo(() => {
    if (!nq) return { people: people.slice(0, 6), txs: [] as Tx[] };
    const fp = people
      .filter((p) => smartMatch(nq, { text: [p.name], phones: [p.phone] }))
      .slice(0, 8);
    const nameOf = new Map(people.map((p) => [p.id, p.name]));
    const ft = txs
      .filter((t) =>
        smartMatch(nq, {
          text: [t.details, nameOf.get(t.person_id)],
          numbers: [t.amount],
        }),
      )
      .slice(0, 10);
    return { people: fp, txs: ft };
  }, [nq, people, txs]);

  const goPerson = (id: string) => {
    onOpenChange(false);
    nav({ to: "/app/person/$id", params: { id } });
  };
  const goTx = (t: Tx) => goPerson(t.person_id);

  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden top-[10%] translate-y-0">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم متقطع، رقم هاتف، أو مبلغ..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
          />
          {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {results.people.length > 0 && (
            <Section title="الأشخاص" icon={User}>
              {results.people.map((p) => (
                <Row
                  key={p.id}
                  onClick={() => goPerson(p.id)}
                  icon={<User className="size-3.5" />}
                  title={p.name}
                  subtitle={p.phone ?? undefined}
                />
              ))}
            </Section>
          )}

          {results.txs.length > 0 && (
            <Section title="المعاملات" icon={Wallet}>
              {results.txs.map((t) => (
                <Row
                  key={t.id}
                  onClick={() => goTx(t)}
                  icon={
                    <Wallet
                      className={`size-3.5 ${t.direction === "credit" ? "text-emerald-600" : "text-rose-600"}`}
                    />
                  }
                  title={`${personName(t.person_id)} — ${fmtMoney(Number(t.amount))}`}
                  subtitle={`${fmtDate(t.transaction_date)}${t.details ? " · " + t.details : ""}`}
                />
              ))}
            </Section>
          )}

          {!loading && nq && results.people.length + results.txs.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              لا توجد نتائج لـ "{q}"
            </div>
          )}
          {!nq && !loading && (
            <div className="px-2 pb-2 text-[11px] text-muted-foreground">
              ابدأ بالكتابة للبحث الفوري في كل بياناتك.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" /> {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent text-right transition-colors"
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{title}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground truncate">{subtitle}</div>}
      </div>
    </button>
  );
}

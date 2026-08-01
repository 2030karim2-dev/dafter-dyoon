import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { User, Wallet, Loader2, Search } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/format";

interface Person { id: string; name: string; phone: string | null }
interface Tx { id: string; person_id: string; amount: number; direction: string; details: string | null; transaction_date: string }

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

function normalize(s: string) {
  return s.toLowerCase().replace(/[\u064B-\u065F\u0670]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").trim();
}

export function GlobalSearchDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (async () => {
      const [{ data: p }, { data: t }] = await Promise.all([
        supabase.from("people").select("id,name,phone").eq("is_archived", false).limit(500),
        supabase.from("transactions").select("id,person_id,amount,direction,details,transaction_date").order("transaction_date", { ascending: false }).limit(500),
      ]);
      setPeople((p ?? []) as Person[]);
      setTxs((t ?? []) as Tx[]);
      setLoading(false);
    })();
  }, [open, user]);

  useEffect(() => { if (!open) setQ(""); }, [open]);

  const nq = normalize(q);
  const results = useMemo(() => {
    if (!nq) return { people: people.slice(0, 6), txs: [] as Tx[] };
    const fp = people.filter((p) => normalize(p.name).includes(nq) || (p.phone ?? "").includes(q)).slice(0, 6);
    const ft = txs.filter((t) => normalize(t.details ?? "").includes(nq) || String(t.amount).includes(nq)).slice(0, 8);
    return { people: fp, txs: ft };
  }, [nq, q, people, txs]);

  const goPerson = (id: string) => { onOpenChange(false); nav({ to: "/app/person/$id", params: { id } }); };
  const goTx = (t: Tx) => goPerson(t.person_id);

  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden top-[10%] translate-y-0">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن شخص، مبلغ، أو وصف..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
          />
          {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {results.people.length > 0 && (
            <Section title="الأشخاص" icon={User}>
              {results.people.map((p) => (
                <Row key={p.id} onClick={() => goPerson(p.id)} icon={<User className="size-3.5" />} title={p.name} subtitle={p.phone ?? undefined} />
              ))}
            </Section>
          )}

          {results.txs.length > 0 && (
            <Section title="المعاملات" icon={Wallet}>
              {results.txs.map((t) => (
                <Row
                  key={t.id} onClick={() => goTx(t)}
                  icon={<Wallet className={`size-3.5 ${t.direction === "credit" ? "text-emerald-600" : "text-rose-600"}`} />}
                  title={`${personName(t.person_id)} — ${fmtMoney(Number(t.amount))}`}
                  subtitle={`${fmtDate(t.transaction_date)}${t.details ? " · " + t.details : ""}`}
                />
              ))}
            </Section>
          )}


          {!loading && nq && results.people.length + results.txs.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">لا توجد نتائج لـ "{q}"</div>
          )}
          {!nq && !loading && (
            <div className="px-2 pb-2 text-[11px] text-muted-foreground">ابدأ بالكتابة للبحث الفوري في كل بياناتك.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" /> {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent text-right transition-colors">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{title}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground truncate">{subtitle}</div>}
      </div>
    </button>
  );
}

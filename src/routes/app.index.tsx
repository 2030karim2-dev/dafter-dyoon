import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Users, Sparkles, LayoutGrid, Table as TableIcon } from "lucide-react";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { SmartAddDialog, type ParsedDraft } from "@/components/ai/SmartAddDialog";
import { PersonFormDialog, type PersonEditing } from "@/components/PersonFormDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { SearchBar } from "@/components/common/SearchBar";
import { smartMatch } from "@/lib/search/match";
import { FabButton } from "@/components/common/FabButton";
import { DebtsHeader } from "@/features/debts/DebtsHeader";
import { PersonRow } from "@/features/debts/PersonRow";
import { PersonTable } from "@/features/debts/PersonTable";
import { BalanceCard } from "@/components/common/BalanceCard";
import { CurrencyScope } from "@/components/common/CurrencyScope";
import { getDebtsHomeFn, archivePersonFn, deletePersonFn, type PersonWithBalances, type DebtsHomePayload } from "@/lib/home.functions";
import { processRecurringFn } from "@/lib/jobs.functions";
import { toast } from "sonner";

type Filter = "all" | "credit" | "debit";
type Sort = "active" | "name" | "recent";
type ViewMode = "cards" | "table";

const homeQO = queryOptions({
  queryKey: ["debts-home"],
  queryFn: () => getDebtsHomeFn(),
});

const EMPTY_HOME: DebtsHomePayload = {
  people: [], currencies: [], base: null, totalsPerCurrency: [], peopleCount: 0, txCount: 0,
};

// Auth is client-side (see src/routes/app.tsx), so this protected data is
// fetched after hydration — a loader would 401 during SSR/prerender.
export const Route = createFileRoute("/app/")({
  component: DebtsHome,
});

function DebtsHome() {
  const qc = useQueryClient();
  const { data: home } = useQuery(homeQO);
  const data = home ?? EMPTY_HOME;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["debts-home"] });


  // Idle-time backend housekeeping (recurring generation).
  const runRecurring = useServerFn(processRecurringFn);
  useEffect(() => {
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: object) => number };
    const h = w.requestIdleCallback?.(() => { runRecurring().catch(() => null); }, { timeout: 3000 })
      ?? window.setTimeout(() => { runRecurring().catch(() => null); }, 1500);
    return () => { (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(h); };
  }, [runRecurring]);

  const archive = useServerFn(archivePersonFn);
  const del = useServerFn(deletePersonFn);
  const archiveM = useMutation({
    mutationFn: (id: string) => archive({ data: { id } }),
    onSuccess: () => { toast.success("تمت الأرشفة"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [q, setQ] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [openSmart, setOpenSmart] = useState(false);
  const [openPerson, setOpenPerson] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonEditing | null>(null);
  const [delPerson, setDelPerson] = useState<PersonWithBalances["person"] | null>(null);
  const [archivePerson, setArchivePerson] = useState<PersonWithBalances["person"] | null>(null);
  const [prefill, setPrefill] = useState<ParsedDraft | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("active");
  const [view, setView] = useState<ViewMode>(() => (typeof localStorage !== "undefined" && (localStorage.getItem("people_view") as ViewMode)) || "cards");
  useEffect(() => { try { localStorage.setItem("people_view", view); } catch { /* ignore */ } }, [view]);

  // Selected currency = the only ledger displayed (currencies never mix).
  const [curId, setCurId] = useState<string>("");
  useEffect(() => {
    if (data.currencies.length === 0) return;
    if (curId && data.currencies.some((c) => c.id === curId)) return;
    const saved = (() => { try { return localStorage.getItem("scope_currency"); } catch { return null; } })();
    const next = data.currencies.find((c) => c.id === saved) ?? data.base ?? data.currencies[0];
    if (next) setCurId(next.id);
  }, [data.currencies, data.base, curId]);
  useEffect(() => { if (curId) { try { localStorage.setItem("scope_currency", curId); } catch { /* ignore */ } } }, [curId]);

  const activeCurrency = data.currencies.find((c) => c.id === curId) ?? data.base ?? null;

  /** Row data for the selected currency only. */
  const curMap = useMemo(
    () => new Map(data.currencies.map((c) => [c.id, c])),
    [data.currencies],
  );

  const rowsForCurrency = useMemo(() => {
    return data.people.map((p) => {
      const e = p.balances.find((b) => b.currency_id === curId);
      // Balances outside the active path stay visible so the user never has to
      // switch currency scopes just to see the full picture for a customer.
      const others = p.balances
        .filter((b) => b.currency_id !== curId && (Math.abs(b.balance) > 0.001 || b.count > 0))
        .map((b) => {
          const c = curMap.get(b.currency_id);
          return {
            currency_id: b.currency_id,
            name: c?.name ?? "",
            symbol: c?.symbol ?? "",
            net: b.balance,
            count: b.count,
          };
        });
      return {
        person: p.person,
        others,
        net: e?.balance ?? 0,
        count: e?.count ?? 0,
        credit: e?.credit ?? 0,
        debit: e?.debit ?? 0,
        lastDate: e?.lastDate ?? 0,
        lastAmount: e?.lastAmount ?? 0,
        lastDirection: e?.lastDirection ?? "",
      };
    });
  }, [data.people, curId, curMap]);

  const scopeTotal = data.totalsPerCurrency.find((t) => t.currency.id === curId);
  const totals = { owed: scopeTotal?.owed ?? 0, owe: scopeTotal?.owe ?? 0 };

  const filtered = useMemo(() => {
    const list = rowsForCurrency.filter((r) => {
      if (q && !smartMatch(q, { text: [r.person.name], phones: [r.person.phone], numbers: [Math.round(r.net)] })) return false;
      if (filter === "credit") return r.net > 0.001;
      if (filter === "debit") return r.net < -0.001;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "name") return a.person.name.localeCompare(b.person.name, "ar");
      if (sort === "recent") return b.lastDate - a.lastDate;
      return Math.abs(b.net) - Math.abs(a.net);
    });
  }, [rowsForCurrency, q, filter, sort]);

  // Adapters for legacy dialogs that still expect raw arrays
  const legacyPeople = useMemo(() => data.people.map((p) => p.person), [data.people]);

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <CurrencyScope currencies={data.currencies} value={curId} onChange={setCurId} />

      <DebtsHeader
        owed={totals.owed}
        owe={totals.owe}
        baseName={activeCurrency?.name ?? "محلي"}
        peopleCount={scopeTotal?.peopleCount ?? data.peopleCount}
        txCount={rowsForCurrency.reduce((a, r) => a + r.count, 0)}
        filter={filter}
        onFilterChange={setFilter}
      />

      {data.totalsPerCurrency.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <div className="text-[10px] font-bold text-muted-foreground tracking-wide">مسارات العملات (منفصلة تماماً)</div>
            <div className="text-[9px] text-muted-foreground tabular-nums">{data.totalsPerCurrency.length} عملة</div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {data.totalsPerCurrency.map((r) => (
              <BalanceCard
                key={r.currency.id}
                data={{ currency: r.currency, owed: r.owed, owe: r.owe }}
                defaultOpen={r.currency.id === curId}
              />
            ))}
          </div>
        </div>
      )}


      <div className="flex items-center gap-1.5">
        <div className="flex-1"><SearchBar value={q} onChange={setQ} placeholder="ابحث باسم متقطع أو رقم هاتف..." /></div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-9 rounded-lg border bg-card px-2 text-[11px] font-semibold text-foreground"
          aria-label="فرز"
        >
          <option value="active">الأكثر نشاطاً</option>
          <option value="recent">الأحدث</option>
          <option value="name">أبجدي</option>
        </select>
        <div className="inline-flex h-9 rounded-lg border bg-card overflow-hidden" role="group" aria-label="طريقة العرض">
          <button onClick={() => setView("cards")} className={`px-2 flex items-center justify-center transition-colors ${view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-label="بطاقات" aria-pressed={view === "cards"}>
            <LayoutGrid className="size-3.5" />
          </button>
          <button onClick={() => setView("table")} className={`px-2 flex items-center justify-center transition-colors border-r ${view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-label="جدول" aria-pressed={view === "table"}>
            <TableIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {filter !== "all" && (
        <div className="flex items-center justify-between text-xs px-1 animate-in slide-in-from-top-2 duration-200">
          <span className="text-muted-foreground">تصفية: {filter === "credit" ? "له فقط" : "عليه فقط"}</span>
          <button onClick={() => setFilter("all")} className="text-primary font-semibold">إلغاء التصفية</button>
        </div>
      )}

      {filtered.length === 0 ? (
        data.people.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="ابدأ بإضافة أول معاملة"
            description="سجّل ما لك وما عليك بسهولة، وسنحتفظ لك بكل التفاصيل."
            action={
              <Button onClick={() => setOpenAdd(true)} size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow">
                <Plus className="size-4" /> إضافة أول معاملة
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Users} title="لا توجد نتائج" description="جرّب كلمة بحث أخرى أو ألغِ التصفية." variant="compact" />
        )
      ) : view === "table" ? (
        <PersonTable
          rows={filtered.map((p) => ({
            person: p.person,
            balance: { net: p.net, count: p.count, lastDate: p.lastDate, totalCredit: p.credit, totalDebit: p.debit, symbol: activeCurrency?.symbol, others: p.others },
          }))}

          onEdit={(p) => { const full = legacyPeople.find((x) => x.id === p.id)!; setEditingPerson({ id: full.id, name: full.name, phone: full.phone, type: full.type, notes: full.notes ?? null, avatar_color: full.avatar_color, credit_limit: full.credit_limit ?? null }); setOpenPerson(true); }}
          onArchive={(p) => setArchivePerson(legacyPeople.find((x) => x.id === p.id) ?? null)}
          onDelete={(p) => setDelPerson(legacyPeople.find((x) => x.id === p.id) ?? null)}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((p, i) => (
            <PersonRow
              key={p.person.id}
              person={p.person}
              balance={{ net: p.net, count: p.count, lastDate: p.lastDate, lastAmount: p.lastAmount, lastDirection: p.lastDirection, totalCredit: p.credit, totalDebit: p.debit, symbol: activeCurrency?.symbol, others: p.others }}
              index={i}
              onEdit={() => { setEditingPerson({ id: p.person.id, name: p.person.name, phone: p.person.phone, type: p.person.type, notes: p.person.notes ?? null, avatar_color: p.person.avatar_color, credit_limit: p.person.credit_limit ?? null }); setOpenPerson(true); }}
              onArchive={() => setArchivePerson(p.person)}
              onDelete={() => setDelPerson(p.person)}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => { setEditingPerson(null); setOpenPerson(true); }}
        aria-label="إضافة عميل جديد"
        className="fixed bottom-52 left-4 z-20 size-11 rounded-full bg-card border-2 border-success text-success shadow-elevated flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <UserPlus className="size-4" />
      </button>

      <button
        onClick={() => setOpenSmart(true)}
        aria-label="إضافة ذكية"
        className="fixed bottom-36 left-4 z-20 size-11 rounded-full bg-card border-2 border-primary text-primary shadow-elevated flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <Sparkles className="size-4" />
      </button>

      <FabButton onClick={() => { setPrefill(null); setOpenAdd(true); }} label="إضافة معاملة" />

      <SmartAddDialog
        open={openSmart}
        onOpenChange={setOpenSmart}
        onParsed={(d) => { setPrefill(d); setOpenAdd(true); }}
      />

      <AddTransactionDialog
        open={openAdd}
        onOpenChange={(v) => { setOpenAdd(v); if (!v) setPrefill(null); }}
        people={legacyPeople}
        currencies={data.currencies}
        onSuccess={invalidate}
        prefill={prefill}
      />

      <PersonFormDialog
        open={openPerson}
        onOpenChange={(v) => { setOpenPerson(v); if (!v) setEditingPerson(null); }}
        editing={editingPerson}
        onSuccess={invalidate}
      />

      <ConfirmDialog
        open={!!archivePerson}
        onOpenChange={(v) => !v && setArchivePerson(null)}
        title={`أرشفة ${archivePerson?.name ?? ""}؟`}
        description="يمكن استعادته لاحقاً من صفحة الأرشيف."
        confirmLabel="أرشفة"
        onConfirm={async () => { if (archivePerson) await archiveM.mutateAsync(archivePerson.id); }}
      />

      <ConfirmDialog
        open={!!delPerson}
        onOpenChange={(v) => !v && setDelPerson(null)}
        title={`حذف ${delPerson?.name ?? ""} نهائياً؟`}
        description="لا يمكن الحذف إذا كانت لديه معاملات. استخدم الأرشفة بدلاً من ذلك."
        destructive
        confirmLabel="حذف"
        onConfirm={async () => { if (delPerson) await deleteM.mutateAsync(delPerson.id); }}
      />
    </div>
  );
}

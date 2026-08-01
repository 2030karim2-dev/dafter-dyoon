import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Plus } from "lucide-react";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { toast } from "sonner";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { exportPersonStatementPDF } from "@/lib/io/exportPdf";
import { exportPersonToExcel } from "@/lib/io/exportExcel";
import { PersonActionsBar } from "@/features/debts/person/PersonActionsBar";
import { PersonBalancesByCurrency } from "@/features/debts/person/PersonBalancesByCurrency";
import { PersonTimeline } from "@/features/debts/person/PersonTimeline";
import { AiReminderDialog } from "@/components/ai/AiReminderDialog";
import { CustomerHealthCard } from "@/components/CustomerHealthCard";
import { PersonAnalytics } from "@/features/debts/person/PersonAnalytics";
import { CustomerAttachments } from "@/features/attachments/CustomerAttachments";
import { computeBalancesByCurrency, computeRunningByCurrency, type OpeningBalance } from "@/lib/money/balances";
import { ClipboardList, Paperclip, BarChart3, History, CalendarClock, HandCoins, Activity } from "lucide-react";
import { CurrencyScope } from "@/components/common/CurrencyScope";
import { PersonFeed } from "@/features/person/PersonFeed";
import { PersonPromises } from "@/features/person/PersonPromises";
import { PersonActivity } from "@/features/person/PersonActivity";
import { PaymentDialog } from "@/features/today/PaymentDialog";
import { PromiseDialog } from "@/features/today/PromiseDialog";

export const Route = createFileRoute("/app/person/$id")({ component: PersonPage });

interface Currency { id: string; name: string; symbol: string; is_base: boolean }
interface Tx { id: string; person_id: string; amount: number; direction: string; currency_id: string; transaction_date: string; details: string | null; due_date: string | null; is_paid: boolean }

function PersonPage() {
  const { id } = useParams({ from: "/app/person/$id" });
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [editName, setEditName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [txs, setTxs] = useState<Tx[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [openings, setOpenings] = useState<OpeningBalance[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [company, setCompany] = useState<{ name: string | null; phone: string | null; address: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [editingTx, setEditingTx] = useState<Tx | null>(null);
  const [delTxId, setDelTxId] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelPerson, setConfirmDelPerson] = useState(false);
  const [openAi, setOpenAi] = useState(false);
  const [tab, setTab] = useState<"timeline" | "feed" | "activity" | "promises" | "attachments" | "insights">("timeline");
  const [openPay, setOpenPay] = useState(false);
  const [openPromise, setOpenPromise] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: person }, { data: t }, { data: c }, { data: p }, { data: ob }, { data: co }] = await Promise.all([
      supabase.from("people").select("name,phone").eq("id", id).single(),
      supabase.from("transactions").select("*").eq("person_id", id).order("transaction_date", { ascending: false }),
      supabase.from("currencies").select("*").order("is_base", { ascending: false }),
      supabase.from("people").select("id,name"),
      supabase.from("opening_balances").select("currency_id,amount,direction").eq("person_id", id),
      supabase.from("company_profile").select("name,phone,address").maybeSingle(),
    ]);
    setName(person?.name ?? "");
    setPhone(person?.phone ?? null);
    setDraftName(person?.name ?? "");
    setDraftPhone(person?.phone ?? "");
    setTxs((t ?? []) as Tx[]);
    setCurrencies((c ?? []) as Currency[]);
    setPeople((p ?? []) as { id: string; name: string }[]);
    setOpenings((ob ?? []) as OpeningBalance[]);
    setCompany((co as { name: string | null; phone: string | null; address: string | null } | null) ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, id]);

  const balancesByCurrency = useMemo(
    () => computeBalancesByCurrency(txs, currencies, openings),
    [txs, currencies, openings],
  );

  // Each currency is an INDEPENDENT account for this customer.
  const [curId, setCurId] = useState<string>("");
  useEffect(() => {
    if (currencies.length === 0) return;
    if (curId && currencies.some((c) => c.id === curId)) return;
    const saved = (() => { try { return localStorage.getItem("scope_currency"); } catch { return null; } })();
    const next = currencies.find((c) => c.id === saved) ?? currencies.find((c) => c.is_base) ?? currencies[0];
    if (next) setCurId(next.id);
  }, [currencies, curId]);
  useEffect(() => { if (curId) { try { localStorage.setItem("scope_currency", curId); } catch { /* ignore */ } } }, [curId]);

  const scopedTxs = useMemo(() => txs.filter((t) => t.currency_id === curId), [txs, curId]);
  const scopedOpenings = useMemo(() => openings.filter((o) => o.currency_id === curId), [openings, curId]);
  const primaryBalance = balancesByCurrency.find((b) => b.currency.id === curId) ?? balancesByCurrency[0];
  const balanceForActions = primaryBalance?.balance ?? 0;

  const running = useMemo(
    () => computeRunningByCurrency(scopedTxs, scopedOpenings),
    [scopedTxs, scopedOpenings],
  );


  const delTx = async () => {
    if (!delTxId) return;
    const tx = txs.find((t) => t.id === delTxId);
    const { error } = await supabase.from("transactions").delete().eq("id", delTxId);
    if (error) { toast.error(error.message); return; }
    setDelTxId(null);
    toast.success("تم الحذف", {
      action: tx ? {
        label: "تراجع",
        onClick: async () => {
          const { id: _id, ...rest } = tx;
          await supabase.from("transactions").insert({ ...rest, user_id: user?.id ?? "" } as never);
          toast.success("تم الاسترجاع"); load();
        },
      } : undefined,
    });
    load();
  };

  const togglePaid = async (tx: Tx) => {
    const { error } = await supabase.from("transactions").update({ is_paid: !tx.is_paid }).eq("id", tx.id);
    if (error) { toast.error(error.message); return; }
    toast.success(tx.is_paid ? "تم إلغاء السداد" : "تم تأكيد السداد");
    load();
  };

  const archivePerson = async () => {
    const { error } = await supabase.from("people").update({ is_archived: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تمت الأرشفة"); nav({ to: "/app" });
  };

  const delPerson = async () => {
    if (txs.length > 0) { toast.error("استخدم الأرشفة بدلاً من الحذف — لديه معاملات"); return; }
    const { error } = await supabase.from("people").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف"); nav({ to: "/app" });
  };

  const saveName = async () => {
    if (!draftName.trim()) { toast.error("الاسم مطلوب"); return; }
    const { error } = await supabase.from("people").update({ name: draftName.trim(), phone: draftPhone.trim() || null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); setEditName(false); load();
  };

  const buildShareText = () => {
    const companyName = company?.name?.trim() || "دفترك";
    const today = new Date().toLocaleDateString("ar-EG");
    const lines: string[] = [];
    lines.push("السلام عليكم ورحمة الله وبركاته");
    lines.push(`الأستاذ/ ${name} المحترم`);
    lines.push("تحية طيبة وبعد،");
    lines.push("");
    lines.push(`نرفق لكم كشف حساب ${primaryBalance?.currency.name ?? ""} لدى *${companyName}* حتى تاريخ ${today}:`);
    lines.push("");
    // Per-currency summary lines — each currency shown SEPARATELY.
    if (!primaryBalance) {
      lines.push("• لا توجد حركات مسجلة حالياً.");
    } else {
      const tag = primaryBalance.balance >= 0 ? "له" : "عليه";
      const amt = Math.abs(primaryBalance.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      lines.push(`• حساب ${primaryBalance.currency.name}: ${amt} ${primaryBalance.currency.symbol} (${tag})`);
    }
    lines.push("");
    lines.push(`عدد الحركات: ${scopedTxs.length}`);
    lines.push("");
    lines.push("نرجو مراجعة الكشف، والتواصل معنا في حال وجود أي استفسار أو ملاحظة.");
    lines.push("");
    lines.push("مع خالص التقدير والاحترام،");
    lines.push(companyName);
    if (company?.phone) lines.push(`📞 ${company.phone}`);
    if (company?.address) lines.push(company.address);
    return lines.join("\n");
  };

  const share = async () => {
    const text = buildShareText();
    if (navigator.share) { try { await navigator.share({ title: `كشف حساب ${name}`, text }); return; } catch { /* ignore */ } }
    await navigator.clipboard.writeText(text);
    toast.success("تم نسخ الكشف للحافظة");
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(buildShareText());
    const p = phone ? phone.replace(/\D/g, "") : "";
    window.open(p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <PersonActionsBar
        onPdf={() => exportPersonStatementPDF({ personName: name, phone, txs: scopedTxs, currencies: primaryBalance ? [primaryBalance.currency] : currencies, openings: scopedOpenings, balance: balanceForActions })}
        onExcel={() => exportPersonToExcel(id, name)}
        onShare={share}
        onWhatsApp={shareWhatsApp}
        onAiMessage={() => setOpenAi(true)}
        onEdit={() => setEditName(true)}
        onArchive={() => setConfirmArchive(true)}
        onDelete={() => setConfirmDelPerson(true)}
      />

      <CurrencyScope currencies={currencies} value={curId} onChange={setCurId} />

      <PersonBalancesByCurrency name={name} phone={phone} balances={balancesByCurrency} totalTxCount={txs.length} txs={txs} />

      {/* Quick collection actions on the active currency path */}
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!curId} onClick={() => setOpenPay(true)}>
          <HandCoins className="size-3" /> تسجيل دفعة
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!curId} onClick={() => setOpenPromise(true)}>
          <CalendarClock className="size-3" /> وعد بالسداد
        </Button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-6 gap-1 rounded-xl bg-secondary/60 p-1 ring-1 ring-border">
        {[
          { v: "timeline" as const,    label: "المعاملات",  icon: ClipboardList },
          { v: "feed" as const,        label: "السجل",      icon: History },
          { v: "activity" as const,    label: "النشاط",     icon: Activity },
          { v: "promises" as const,    label: "الوعود",     icon: CalendarClock },
          { v: "attachments" as const, label: "المرفقات",   icon: Paperclip },
          { v: "insights" as const,    label: "تحليلات",    icon: BarChart3 },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.v;
          return (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`inline-flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[9.5px] font-semibold transition ${
                active ? "bg-card text-primary shadow-sm ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "timeline" && (
        loading ? (
          <ListSkeleton rows={4} />
        ) : scopedTxs.length === 0 ? (
          <EmptyState icon={Plus} title={`لا توجد معاملات بـ${primaryBalance?.currency.name ?? "هذه العملة"}`} description="كل عملة لها مسار مستقل — أضف أول معاملة بهذا المسار." variant="compact" />
        ) : (
          <PersonTimeline
            txs={scopedTxs} currencies={currencies} running={running}
            onEdit={(t) => { setEditingTx(t); setOpenAdd(true); }}
            onDelete={(id) => setDelTxId(id)}
            onTogglePaid={togglePaid}
          />
        )
      )}

      {tab === "feed" && <PersonFeed personId={id} currencyId={curId || null} />}

      {tab === "activity" && <PersonActivity personId={id} />}

      {tab === "promises" && <PersonPromises personId={id} currencyId={curId || null} />}

      {tab === "attachments" && (
        <CustomerAttachments personId={id} personPhone={phone} />
      )}

      {tab === "insights" && (
        <div className="space-y-3">
          <CustomerHealthCard personId={id} />
          <PersonAnalytics txs={scopedTxs} />
        </div>
      )}

      {curId && (
        <>
          <PaymentDialog
            open={openPay} onOpenChange={setOpenPay}
            personId={id} personName={name} currencyId={curId}
            currencyLabel={primaryBalance?.currency.symbol || primaryBalance?.currency.name || ""}
            suggested={Math.abs(balanceForActions) || undefined}
            onDone={load}
          />
          <PromiseDialog
            open={openPromise} onOpenChange={setOpenPromise}
            personId={id} personName={name} currencyId={curId}
            currencyLabel={primaryBalance?.currency.symbol || primaryBalance?.currency.name || ""}
            suggested={Math.abs(balanceForActions) || undefined}
            onDone={load}
          />
        </>
      )}

      <button
        onClick={() => { setEditingTx(null); setOpenAdd(true); }}
        aria-label="إضافة معاملة"
        className="fixed bottom-20 left-4 z-20 size-12 rounded-full bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus className="size-5" />
      </button>

      <AddTransactionDialog
        open={openAdd}
        onOpenChange={(v) => { setOpenAdd(v); if (!v) setEditingTx(null); }}
        people={people} currencies={currencies}
        onSuccess={load} defaultPersonId={id} editing={editingTx}
      />

      <AiReminderDialog
        open={openAi} onOpenChange={setOpenAi}
        personName={name}
        amount={Math.abs(balanceForActions)}
        currency={primaryBalance?.currency.name}
        phone={phone}
      />

      <Dialog open={editName} onOpenChange={setEditName}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-right">تعديل البيانات</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="الاسم" maxLength={80} />
            <Input value={draftPhone} onChange={(e) => setDraftPhone(e.target.value)} placeholder="رقم الجوال (اختياري)" dir="ltr" maxLength={30} />
            <Button onClick={saveName} className="w-full bg-gradient-primary text-primary-foreground">حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!delTxId} onOpenChange={(v) => !v && setDelTxId(null)} title="حذف المعاملة" description="لا يمكن التراجع عن هذا الإجراء." destructive confirmLabel="حذف" onConfirm={delTx} />
      <ConfirmDialog open={confirmArchive} onOpenChange={setConfirmArchive} title={`أرشفة ${name}؟`} description="يمكن استعادة الشخص من صفحة الأرشيف لاحقاً." confirmLabel="أرشفة" onConfirm={archivePerson} />
      <ConfirmDialog open={confirmDelPerson} onOpenChange={setConfirmDelPerson} title={`حذف ${name} نهائياً؟`} description="لا يمكن الحذف إذا كانت هناك معاملات. استخدم الأرشفة بدلاً من ذلك." destructive confirmLabel="حذف" onConfirm={delPerson} />
    </div>
  );
}

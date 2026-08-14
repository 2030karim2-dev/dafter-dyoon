import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrencies } from "@/hooks/useCurrencies";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Wallet, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import { OpeningBalanceImportDialog } from "@/components/import/OpeningBalanceImportDialog";

export const Route = createFileRoute("/app/opening-balances")({ component: OpeningBalancesPage });

interface Person {
  id: string;
  name: string;
}
interface Opening {
  id: string;
  person_id: string;
  currency_id: string;
  amount: number;
  direction: string;
  note: string | null;
  opening_date: string;
}

function OpeningBalancesPage() {
  const { user } = useAuth();
  const { currencies, base } = useCurrencies();
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(true);
  const [personId, setPersonId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: pp }, { data: ob }] = await Promise.all([
      supabase
        .from("people")
        .select("id,name")
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .order("name"),
      supabase
        .from("opening_balances")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setPeople((pp ?? []) as Person[]);
    setItems((ob ?? []) as Opening[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);
  useEffect(() => {
    if (base && !currencyId) setCurrencyId(base.id);
  }, [base, currencyId]);

  const personMap = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const curMap = useMemo(() => new Map(currencies.map((c) => [c.id, c])), [currencies]);

  const add = async () => {
    if (!user) return;
    if (!personId) {
      toast.error("اختر العميل");
      return;
    }
    if (!currencyId) {
      toast.error("اختر العملة");
      return;
    }
    const v = parseFloat(amount);
    if (!v || v <= 0) {
      toast.error("مبلغ غير صحيح");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("opening_balances").insert({
      user_id: user.id,
      person_id: personId,
      currency_id: currencyId,
      amount: v,
      direction,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحفظ");
    setAmount("");
    setNote("");
    load();
  };

  const del = async () => {
    if (!pendingDelete) return;
    const { error } = await supabase
      .from("opening_balances")
      .delete()
      .eq("id", pendingDelete)
      .eq("user_id", user?.id ?? "");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحذف");
    load();
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Link
          to="/app/settings"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3.5" /> رجوع
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <div className="size-9 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
          <Wallet className="size-4" />
        </div>
        <div>
          <h1 className="font-bold text-[15px] leading-tight">الأرصدة الافتتاحية</h1>
          <p className="text-[10px] text-muted-foreground">رصيد بدء لكل عميل وعملة</p>
        </div>
      </div>

      <button
        onClick={() => setImportOpen(true)}
        className="w-full p-3 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/10 transition text-right flex items-center gap-3"
      >
        <div className="size-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow shrink-0">
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-[13px] text-primary">استيراد ذكي من ملف Excel</div>
          <div className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">
            استخراج العملاء وأرقام الجوال والمبالغ والعملات تلقائياً بالذكاء الاصطناعي
          </div>
        </div>
      </button>

      <OpeningBalanceImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={load} />

      <Card className="p-2.5 space-y-2">
        <div className="text-[11px] font-bold">إضافة رصيد افتتاحي</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 col-span-2">
            <Label className="text-[10px]">العميل</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger className="h-8 text-[12px]">
                <SelectValue placeholder="اختر العميل" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">العملة</Label>
            <Select value={currencyId} onValueChange={setCurrencyId}>
              <SelectTrigger className="h-8 text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">المبلغ</Label>
            <Input
              type="number"
              inputMode="decimal"
              dir="ltr"
              className="h-8 text-[12px]"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-[10px]">الاتجاه</Label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setDirection("credit")}
                className={`rounded-lg p-1.5 text-[11px] font-bold border-2 transition ${direction === "credit" ? "border-success bg-success-soft text-success" : "border-border text-muted-foreground"}`}
              >
                له عندك
              </button>
              <button
                type="button"
                onClick={() => setDirection("debit")}
                className={`rounded-lg p-1.5 text-[11px] font-bold border-2 transition ${direction === "debit" ? "border-danger bg-danger-soft text-danger" : "border-border text-muted-foreground"}`}
              >
                عليه
              </button>
            </div>
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-[10px]">ملاحظة</Label>
            <Input
              className="h-8 text-[12px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="اختياري"
            />
          </div>
        </div>
        <Button
          onClick={add}
          disabled={busy}
          className="w-full h-8 bg-gradient-primary text-primary-foreground text-[12px]"
        >
          <Plus className="size-3.5" /> حفظ
        </Button>
      </Card>

      <div className="space-y-1.5">
        <div className="text-[11px] font-bold text-muted-foreground px-1">
          الأرصدة الافتتاحية المسجلة
        </div>
        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="size-4 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card className="p-3 text-center text-[11px] text-muted-foreground">
            لا توجد أرصدة افتتاحية
          </Card>
        ) : (
          items.map((o) => {
            const c = curMap.get(o.currency_id);
            return (
              <Card key={o.id} className="p-2 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold truncate">
                    {personMap.get(o.person_id) ?? "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {c?.name ?? "—"} • {o.note ?? new Date(o.opening_date).toLocaleDateString("ar")}
                  </div>
                </div>
                <div
                  className={`text-[13px] font-black tabular-nums ${o.direction === "credit" ? "text-success" : "text-danger"}`}
                >
                  {o.direction === "credit" ? "+" : "-"}
                  {fmtMoney(o.amount)} <span className="text-[10px]">{c?.symbol}</span>
                </div>
                <button
                  onClick={() => setPendingDelete(o.id)}
                  className="p-1.5 text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </Card>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title="حذف الرصيد الافتتاحي؟"
        description="سيُحذف هذا الرصيد من حساب العميل."
        confirmLabel="حذف"
        destructive
        onConfirm={del}
      />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, Download, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { fmtMoney, fmtDate, monthRange } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { CurrencyScope } from "@/components/common/CurrencyScope";
import { toast } from "sonner";
import jsPDF from "jspdf";

export const Route = createFileRoute("/app/reports")({ component: ReportsPage });

interface Cur { id: string; name: string; symbol: string; is_base: boolean }
interface Person { id: string; name: string }
interface Tx { person_id: string; amount: number; direction: string; currency_id: string; transaction_date: string }

function ReportsPage() {
  const { user } = useAuth();
  const [curs, setCurs] = useState<Cur[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: c }, { data: p }, { data: t }] = await Promise.all([
        supabase.from("currencies").select("*").order("is_base", { ascending: false }),
        supabase.from("people").select("id,name"),
        supabase.from("transactions").select("*"),
      ]);
      setCurs((c ?? []) as Cur[]);
      setPeople((p ?? []) as Person[]);
      setTxs((t ?? []) as Tx[]);
    })();
  }, [user]);

  const base = curs.find((c) => c.is_base) ?? curs[0];
  const [curId, setCurId] = useState<string>("");
  useEffect(() => {
    if (curs.length === 0 || curId) return;
    const saved = (() => { try { return localStorage.getItem("scope_currency"); } catch { return null; } })();
    setCurId((curs.find((c) => c.id === saved) ?? base)?.id ?? "");
  }, [curs, base, curId]);
  const activeCur = curs.find((c) => c.id === curId) ?? base;
  // Reports are scoped to ONE currency — currencies are never mixed.
  const scoped = useMemo(() => txs.filter((t) => t.currency_id === curId), [txs, curId]);

  /** Last 6 months debt movement (credit vs debit) in base currency. */
  const monthly = useMemo(() => {
    const arr: { month: string; credit: number; debit: number; net: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const { start, end } = monthRange(d);
      let credit = 0, debit = 0;
      for (const t of scoped) {
        const ts = new Date(t.transaction_date).getTime();
        if (ts < start.getTime() || ts >= end.getTime()) continue;
        const v = Number(t.amount);
        if (t.direction === "credit") credit += v; else debit += v;
      }
      arr.push({
        month: `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`,
        credit: Math.round(credit), debit: Math.round(debit), net: Math.round(credit - debit),
      });
    }
    return arr;
  }, [scoped]);

  const topPeople = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of scoped) {
      const sign = t.direction === "credit" ? 1 : -1;
      m.set(t.person_id, (m.get(t.person_id) ?? 0) + Number(t.amount) * sign);
    }
    return Array.from(m.entries())
      .map(([id, net]) => ({ id, name: people.find((p) => p.id === id)?.name ?? "—", net }))
      .filter((x) => Math.abs(x.net) > 0.01)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 8);
  }, [scoped, people]);

  const totals = useMemo(() => {
    let owe = 0, owed = 0;
    for (const t of scoped) {
      const v = Number(t.amount);
      if (t.direction === "credit") owed += v; else owe += v;
    }
    return { owe, owed, net: owed - owe };
  }, [scoped]);

  const exportCSV = () => {
    const rows = [["نوع", "تاريخ", "المبلغ", "العملة", "العميل"]];
    for (const t of txs) {
      const cur = curs.find((c) => c.id === t.currency_id)?.name ?? "";
      const person = people.find((p) => p.id === t.person_id)?.name ?? "";
      rows.push([t.direction === "credit" ? "له" : "عليه", fmtDate(t.transaction_date), String(t.amount), cur, person]);
    }
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `daftarak-report-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url); toast.success("تم التنزيل");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text("Daftarak Report", 14, 20);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, 14, 28);
    doc.setFontSize(12); doc.text(`Total Owed to you: ${fmtMoney(totals.owed)} ${activeCur?.name ?? ""}`, 14, 42);
    doc.text(`Total You owe: ${fmtMoney(totals.owe)} ${activeCur?.name ?? ""}`, 14, 50);
    doc.text(`Net: ${fmtMoney(totals.net)}`, 14, 58);
    doc.text("Top balances:", 14, 72);
    let y = 80;
    topPeople.forEach((p) => {
      doc.text(`${p.name}: ${p.net >= 0 ? "+" : ""}${fmtMoney(p.net)}`, 14, y); y += 8;
    });
    doc.save(`daftarak-report-${Date.now()}.pdf`);
    toast.success("تم التنزيل");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="size-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
          <BarChart3 className="size-5" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">تقارير الديون</h1>
          <p className="text-xs text-muted-foreground">مسار {activeCur?.name ?? "العملة"} فقط</p>
        </div>
      </div>

      <CurrencyScope currencies={curs} value={curId} onChange={setCurId} />

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="size-3 text-success" />لك</div><div className="font-bold text-success text-sm mt-1">{fmtMoney(totals.owed)}</div></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingDown className="size-3 text-danger" />عليك</div><div className="font-bold text-danger text-sm mt-1">{fmtMoney(totals.owe)}</div></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground">الصافي</div><div className={`font-bold text-sm mt-1 ${totals.net >= 0 ? "text-success" : "text-danger"}`}>{fmtMoney(totals.net)}</div></Card>
      </div>

      <Tabs defaultValue="movement">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="movement">حركة الديون</TabsTrigger>
          <TabsTrigger value="people">العملاء</TabsTrigger>
        </TabsList>

        <TabsContent value="movement" className="space-y-3 mt-3">
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3">آخر 6 أشهر (له / عليه)</h3>
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: unknown) => fmtMoney(Number(v ?? 0))} />
                  <Bar dataKey="credit" name="له" fill="var(--success)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="debit" name="عليه" fill="var(--danger)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3">اتجاه صافي الديون</h3>
            <div className="h-40">
              <ResponsiveContainer>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: unknown) => fmtMoney(Number(v ?? 0))} />
                  <Line type="monotone" dataKey="net" name="الصافي" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="people" className="space-y-2 mt-3">
          <Card className="p-3">
            <h3 className="font-semibold text-sm mb-2">أكبر الأرصدة</h3>
            {topPeople.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">لا توجد بيانات</div>
            ) : topPeople.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm font-medium">{p.name}</span>
                <span className={`font-bold text-sm ${p.net >= 0 ? "text-success" : "text-danger"}`}>
                  {p.net >= 0 ? "+" : ""}{fmtMoney(p.net)}
                </span>
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={exportCSV} variant="outline"><FileText className="size-4" /> تصدير CSV</Button>
        <Button onClick={exportPDF} className="bg-gradient-primary text-primary-foreground"><Download className="size-4" /> تصدير PDF</Button>
      </div>
    </div>
  );
}

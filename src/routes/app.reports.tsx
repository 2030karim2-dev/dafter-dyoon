import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart3,
  CalendarRange,
  Download,
  FileText,
  Loader2,
  ReceiptText,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { getAgingReportFn, BUCKET_LABEL } from "@/lib/aging.functions";
import type { AgingReport, AgingBucket } from "@/lib/aging.functions";
import { fmtMoney, fmtDate, monthRange } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { CurrencyScope } from "@/components/common/CurrencyScope";
import { toast } from "sonner";
import jsPDF from "jspdf";

export const Route = createFileRoute("/app/reports")({ component: ReportsPage });

interface Cur {
  id: string;
  name: string;
  symbol: string;
  is_base: boolean;
}
interface Person {
  id: string;
  name: string;
}
interface Tx {
  person_id: string;
  amount: number;
  direction: string;
  currency_id: string;
  transaction_date: string;
}

/** ألوان فئات الأعمار: من الأخضر (حديث) إلى الأحمر الداكن (متأخر جداً). */
const BUCKET_TONE: Record<AgingBucket, string> = {
  current: "text-success",
  late_30: "text-amber-600 dark:text-amber-400",
  late_60: "text-orange-600 dark:text-orange-400",
  late_90: "text-danger",
  late_90plus: "text-danger",
};
const BUCKET_BG: Record<AgingBucket, string> = {
  current: "bg-success/10 text-success ring-success/20",
  late_30: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  late_60: "bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20",
  late_90: "bg-danger/10 text-danger ring-danger/20",
  late_90plus: "bg-danger/15 text-danger ring-danger/30",
};

function ReportsPage() {
  const { user } = useAuth();
  const [curs, setCurs] = useState<Cur[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: c }, { data: p }, { data: t }] = await Promise.all([
        supabase
          .from("currencies")
          .select("*")
          .eq("user_id", user.id)
          .order("is_base", { ascending: false }),
        supabase.from("people").select("id,name").eq("user_id", user.id),
        // Bounded to the most recent 5000 rows to avoid unbounded memory use.
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("transaction_date", { ascending: false })
          .limit(5000),
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
    const saved = (() => {
      try {
        return (
          localStorage.getItem("daftarak.scope_currency") ?? localStorage.getItem("scope_currency")
        );
      } catch {
        return null;
      }
    })();
    setCurId((curs.find((c) => c.id === saved) ?? base)?.id ?? "");
  }, [curs, base, curId]);
  const activeCur = curs.find((c) => c.id === curId) ?? base;
  // Reports are scoped to ONE currency — currencies are never mixed.
  const scoped = useMemo(() => txs.filter((t) => t.currency_id === curId), [txs, curId]);

  // ===== أعمار الديون =====
  const getAging = useServerFn(getAgingReportFn);
  const [aging, setAging] = useState<AgingReport | null>(null);
  const [agingLoading, setAgingLoading] = useState(false);
  useEffect(() => {
    if (!curId) return;
    let cancel = false;
    setAgingLoading(true);
    getAging({ data: { currency_id: curId } })
      .then((r) => {
        if (!cancel) setAging(r);
      })
      .catch(() => {
        if (!cancel) toast.error("تعذّر تحميل تقرير أعمار الديون");
      })
      .finally(() => {
        if (!cancel) setAgingLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [curId, getAging]);

  /** Last 6 months debt movement (credit vs debit) in base currency. */
  const monthly = useMemo(() => {
    const arr: { month: string; credit: number; debit: number; net: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const { start, end } = monthRange(d);
      let credit = 0,
        debit = 0;
      for (const t of scoped) {
        const ts = new Date(t.transaction_date).getTime();
        if (ts < start.getTime() || ts >= end.getTime()) continue;
        const v = Number(t.amount);
        if (t.direction === "credit") credit += v;
        else debit += v;
      }
      arr.push({
        month: `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`,
        credit: Math.round(credit),
        debit: Math.round(debit),
        net: Math.round(credit - debit),
      });
    }
    return arr;
  }, [scoped]);

  const allPeopleNet = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of scoped) {
      const sign = t.direction === "credit" ? 1 : -1;
      m.set(t.person_id, (m.get(t.person_id) ?? 0) + Number(t.amount) * sign);
    }
    return Array.from(m.entries()).map(([id, net]) => ({
      id,
      name: people.find((p) => p.id === id)?.name ?? "—",
      net,
    }));
  }, [scoped, people]);

  const topPeople = useMemo(() => {
    return allPeopleNet
      .filter((x) => Math.abs(x.net) > 0.01)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 8);
  }, [allPeopleNet]);

  const totals = useMemo(() => {
    let owe = 0,
      owed = 0;
    for (const p of allPeopleNet) {
      if (p.net > 0) owed += p.net;
      else if (p.net < 0) owe += Math.abs(p.net);
    }
    return { owe, owed, net: owed - owe };
  }, [allPeopleNet]);

  const exportCSV = () => {
    const rows = [["نوع", "تاريخ", "المبلغ", "العملة", "العميل"]];
    for (const t of txs) {
      const cur = curs.find((c) => c.id === t.currency_id)?.name ?? "";
      const person = people.find((p) => p.id === t.person_id)?.name ?? "";
      rows.push([
        t.direction === "credit" ? "له" : "عليه",
        fmtDate(t.transaction_date),
        String(t.amount),
        cur,
        person,
      ]);
    }
    // Neutralize spreadsheet formula injection (=, +, -, @ prefixes).
    const safeCell = (c: unknown) => {
      const s = String(c);
      const v = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${v.replace(/"/g, '""')}"`;
    };
    const csv = "\uFEFF" + rows.map((r) => r.map(safeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daftarak-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم التنزيل");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Daftarak Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, 14, 28);
    doc.setFontSize(12);
    doc.text(`Total Owed to you: ${fmtMoney(totals.owed)} ${activeCur?.name ?? ""}`, 14, 42);
    doc.text(`Total You owe: ${fmtMoney(totals.owe)} ${activeCur?.name ?? ""}`, 14, 50);
    doc.text(`Net: ${fmtMoney(totals.net)}`, 14, 58);
    doc.text("Top balances:", 14, 72);
    let y = 80;
    topPeople.forEach((p) => {
      doc.text(`${p.name}: ${p.net >= 0 ? "+" : ""}${fmtMoney(p.net)}`, 14, y);
      y += 8;
    });
    doc.save(`daftarak-report-${Date.now()}.pdf`);
    toast.success("تم التنزيل");
  };

  const exportAgingCSV = () => {
    if (!aging) return;
    const rows: string[][] = [
      [
        "العميل",
        "البيان",
        "تاريخ المعاملة",
        "تاريخ الاستحقاق",
        "العمر (يوم)",
        "الفئة",
        "المبلغ",
        "المستحق",
      ],
    ];
    for (const r of aging.rows) {
      rows.push([
        r.person_name,
        r.details ?? "",
        fmtDate(r.transaction_date),
        r.due_date ? fmtDate(r.due_date) : "—",
        String(r.age_days),
        BUCKET_LABEL[r.bucket],
        String(r.amount),
        String(r.outstanding),
      ]);
    }
    // تعطيل حقن الصيغ في الجداول (=، +، -، @)
    const safeCell = (c: unknown) => {
      const s = String(c);
      const v = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${v.replace(/"/g, '""')}"`;
    };
    const csv = "\uFEFF" + rows.map((r) => r.map(safeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daftarak-aging-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم التنزيل");
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 lg:size-12 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
            <BarChart3 className="size-5 lg:size-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg lg:text-xl leading-tight">تقارير الديون</h1>
            <p className="text-xs text-muted-foreground">مسار {activeCur?.name ?? "العملة"} فقط</p>
          </div>
        </div>
        <Link
          to="/app/receipts"
          className="inline-flex items-center gap-1.5 text-[11px] lg:text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 rounded-lg px-2.5 py-1.5 transition-colors"
        >
          <ReceiptText className="size-3.5" /> سندات القبض
        </Link>
      </div>

      <CurrencyScope currencies={curs} value={curId} onChange={setCurId} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card className="p-4 lg:p-6">
          <div className="text-[10px] lg:text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="size-3 lg:size-4 text-success" />
            لك
          </div>
          <div className="font-bold text-success text-sm lg:text-base mt-1">
            {fmtMoney(totals.owed)}
          </div>
        </Card>
        <Card className="p-4 lg:p-6">
          <div className="text-[10px] lg:text-xs text-muted-foreground flex items-center gap-1">
            <TrendingDown className="size-3 lg:size-4 text-danger" />
            عليك
          </div>
          <div className="font-bold text-danger text-sm lg:text-base mt-1">
            {fmtMoney(totals.owe)}
          </div>
        </Card>
        <Card className="p-4 lg:p-6">
          <div className="text-[10px] lg:text-xs text-muted-foreground">الصافي</div>
          <div
            className={`font-bold text-sm lg:text-base mt-1 ${totals.net >= 0 ? "text-success" : "text-danger"}`}
          >
            {fmtMoney(totals.net)}
          </div>
        </Card>
        <Card className="p-4 lg:p-6">
          <div className="text-[10px] lg:text-xs text-muted-foreground">عدد المعاملات</div>
          <div className="font-bold text-sm lg:text-base mt-1">{scoped.length}</div>
        </Card>
      </div>

      <Tabs defaultValue="movement">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="movement">حركة الديون</TabsTrigger>
          <TabsTrigger value="aging">أعمار الديون</TabsTrigger>
          <TabsTrigger value="people">العملاء</TabsTrigger>
        </TabsList>

        <TabsContent value="movement" className="space-y-4 lg:space-y-6 mt-4">
          <Card className="p-4 lg:p-6">
            <h3 className="font-semibold text-sm lg:text-base mb-3">آخر 6 أشهر (له / عليه)</h3>
            <div className="h-56 lg:h-72">
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

          <Card className="p-4 lg:p-6">
            <h3 className="font-semibold text-sm lg:text-base mb-3">اتجاه صافي الديون</h3>
            <div className="h-56 lg:h-72">
              <ResponsiveContainer>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: unknown) => fmtMoney(Number(v ?? 0))} />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="الصافي"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="people" className="space-y-3 mt-4">
          <Card className="p-4 lg:p-6">
            <h3 className="font-semibold text-sm lg:text-base mb-3">أكبر الأرصدة</h3>
            {topPeople.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">لا توجد بيانات</div>
            ) : (
              <div className="space-y-2">
                {topPeople.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2.5 border-b last:border-0"
                  >
                    <span className="text-sm lg:text-base font-medium">{p.name}</span>
                    <span
                      className={`font-bold text-sm lg:text-base ${p.net >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {p.net >= 0 ? "+" : ""}
                      {fmtMoney(p.net)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="aging" className="space-y-3 lg:space-y-4 mt-4">
          {agingLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : !aging || aging.rows.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              لا توجد ديون مستحقة ضمن هذا المسار
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 lg:gap-3">
                {aging.totals.map((t) => (
                  <Card key={t.bucket} className="p-3 lg:p-4">
                    <div className="flex items-center gap-1.5 text-[10px] lg:text-xs text-muted-foreground">
                      <CalendarRange className={`size-3 ${BUCKET_TONE[t.bucket]}`} />
                      {t.label}
                    </div>
                    <div className={`font-bold text-sm lg:text-base mt-1 ${BUCKET_TONE[t.bucket]}`}>
                      {fmtMoney(t.total)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{t.count} مستحق</div>
                  </Card>
                ))}
              </div>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse" dir="rtl">
                    <thead>
                      <tr className="bg-gradient-to-l from-primary/15 via-primary/10 to-primary/5 text-foreground">
                        <th className="px-2 py-2 text-right font-bold border-b-2 border-border">
                          العميل
                        </th>
                        <th className="px-2 py-2 text-right font-bold border-b-2 border-l border-border">
                          البيان
                        </th>
                        <th className="px-2 py-2 text-center font-bold border-b-2 border-l border-border">
                          تاريخ الاستحقاق
                        </th>
                        <th className="px-2 py-2 text-center font-bold border-b-2 border-l border-border">
                          العمر
                        </th>
                        <th className="px-2 py-2 text-center font-bold border-b-2 border-l border-border">
                          الفئة
                        </th>
                        <th className="px-2 py-2 text-left font-bold border-b-2 border-border">
                          المستحق
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {aging.rows.map((r, i) => (
                        <tr
                          key={r.transaction_id}
                          className={`border-b border-border/60 hover:bg-primary/5 transition-colors ${
                            i % 2 === 1 ? "bg-muted/30" : ""
                          }`}
                        >
                          <td className="px-2 py-1.5 font-semibold">{r.person_name}</td>
                          <td className="px-2 py-1.5 text-muted-foreground max-w-[180px]">
                            <span className="block truncate">{r.details || "—"}</span>
                          </td>
                          <td className="px-2 py-1.5 text-center tabular-nums">
                            {r.due_date ? fmtDate(r.due_date) : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-center tabular-nums">
                            {r.age_days > 0 ? `${r.age_days} يوم` : "غير مستحق"}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded-full ring-1 ${BUCKET_BG[r.bucket]}`}
                            >
                              {BUCKET_LABEL[r.bucket]}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-left font-bold tabular-nums text-danger">
                            {fmtMoney(r.outstanding)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/40 font-bold">
                        <td colSpan={5} className="px-2 py-2 text-right">
                          إجمالي المستحق ({activeCur?.name ?? ""}):{" "}
                          <span className={aging.overdueTotal > 0 ? "text-danger" : ""}>
                            {fmtMoney(aging.grandTotal)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-left">
                          متأخر: {fmtMoney(aging.overdueTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>

              <Button onClick={exportAgingCSV} variant="outline" className="h-9">
                <FileText className="size-4" /> تصدير CSV
              </Button>
            </>
          )}
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={exportCSV} variant="outline" className="h-10">
          <FileText className="size-4" /> تصدير CSV
        </Button>
        <Button onClick={exportPDF} className="bg-gradient-primary text-primary-foreground h-10">
          <Download className="size-4" /> تصدير PDF
        </Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  Loader2,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { parseExcelFile, type Row } from "@/lib/io/importExcel";
import { aiExtractOpeningBalances } from "@/lib/ai-import.functions";
import {
  commitOpeningBalances,
  type AiOpeningRow,
  type CommitResult,
} from "@/lib/io/commitOpeningBalances";
import { fmtMoney } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}

const BATCH = 50;

export function OpeningBalanceImportDialog({ open, onOpenChange, onDone }: Props) {
  const { user } = useAuth();
  const aiExtract = useServerFn(aiExtractOpeningBalances);
  const [stage, setStage] = useState<"upload" | "extract" | "preview" | "commit" | "done">(
    "upload",
  );
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Row[]>([]);
  const [extracted, setExtracted] = useState<AiOpeningRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CommitResult | null>(null);

  const reset = () => {
    setStage("upload");
    setHeaders([]);
    setRawRows([]);
    setExtracted([]);
    setProgress(0);
    setResult(null);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { headers: h, rows } = await parseExcelFile(f);
      if (!rows.length) {
        toast.error("الملف فارغ");
        return;
      }
      setHeaders(h);
      setRawRows(rows);
      toast.success(`تم تحميل ${rows.length} صف`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر قراءة الملف");
    }
  };

  const runExtract = async () => {
    if (!rawRows.length) return;
    setStage("extract");
    setProgress(0);
    const all: AiOpeningRow[] = [];
    const totalBatches = Math.ceil(rawRows.length / BATCH);
    try {
      for (let i = 0; i < rawRows.length; i += BATCH) {
        const chunk = rawRows.slice(i, i + BATCH) as Record<string, unknown>[];
        const out = await aiExtract({ data: { headers, rows: chunk } });
        all.push(...(out.rows as AiOpeningRow[]));
        setProgress(Math.round(((i / BATCH + 1) / totalBatches) * 100));
      }
      setExtracted(all);
      setStage("preview");
      toast.success(`استخرج AI ${all.length} عميل`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الاستخراج");
      setStage("upload");
    }
  };

  const runCommit = async () => {
    if (!user || !extracted.length) return;
    setStage("commit");
    const r = await commitOpeningBalances(user.id, extracted);
    setResult(r);
    setStage("done");
    onDone?.();
  };

  const totals = extracted.reduce(
    (a, r) => {
      const k = r.currency;
      if (!a[k]) a[k] = { credit: 0, debit: 0 };
      a[k][r.direction] += Number(r.amount) || 0;
      return a;
    },
    {} as Record<string, { credit: number; debit: number }>,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right text-[13px] flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> استيراد الأرصدة الافتتاحية بالذكاء
            الاصطناعي
          </DialogTitle>
        </DialogHeader>

        {stage === "upload" && (
          <div className="space-y-3">
            <Card className="p-3 bg-primary/5 border-primary/30">
              <div className="flex gap-2">
                <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-foreground">
                  سيقوم الذكاء الاصطناعي بـ:
                  <ul className="list-disc pr-4 mt-1 space-y-0.5 text-muted-foreground">
                    <li>فصل اسم العميل عن رقم الجوال المدمج</li>
                    <li>تحديد المبلغ (له/عليه) والعملة (ر.س/ر.ي)</li>
                    <li>استخراج آخر دفعة وتاريخها</li>
                    <li>تجاهل الإجماليات والصفوف المكررة</li>
                  </ul>
                </div>
              </div>
            </Card>
            <label className="block">
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
              <div className="border-2 border-dashed border-primary/40 rounded-xl p-6 text-center cursor-pointer hover:bg-primary/5 transition">
                <FileSpreadsheet className="size-8 mx-auto text-primary mb-2" />
                <div className="text-[12px] font-bold">اختر ملف Excel</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  يدعم .xlsx .xls .csv حتى 5000 صف
                </div>
                {rawRows.length > 0 && (
                  <div className="mt-2 text-[11px] text-success font-bold">
                    ✓ {rawRows.length} صف جاهز
                  </div>
                )}
              </div>
            </label>
            {rawRows.length > 0 && (
              <Button
                onClick={runExtract}
                className="w-full bg-gradient-primary text-primary-foreground"
              >
                <Sparkles className="size-4" /> ابدأ الاستخراج الذكي
              </Button>
            )}
          </div>
        )}

        {stage === "extract" && (
          <div className="py-8 space-y-3 text-center">
            <Loader2 className="size-8 animate-spin text-primary mx-auto" />
            <div className="text-[12px] font-bold">يقوم الذكاء الاصطناعي بتحليل البيانات…</div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">
              {progress}% من {rawRows.length} صف
            </div>
          </div>
        )}

        {stage === "preview" && (
          <div className="space-y-3">
            <Card className="p-2.5">
              <div className="text-[11px] font-bold mb-1.5">المعاينة — {extracted.length} عميل</div>
              <div className="space-y-1">
                {Object.entries(totals).map(([cur, t]) => (
                  <div key={cur} className="flex justify-between text-[11px]">
                    <span className="font-bold">{cur}</span>
                    <span className="text-success">له: {fmtMoney(t.credit)}</span>
                    <span className="text-danger">عليه: {fmtMoney(t.debit)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              <table className="w-full text-[10px]">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-1 text-right">الاسم</th>
                    <th>الجوال</th>
                    <th>المبلغ</th>
                    <th>العملة</th>
                  </tr>
                </thead>
                <tbody>
                  {extracted.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1 text-right truncate max-w-[120px]">{r.name}</td>
                      <td className="text-center text-muted-foreground">{r.phone || "—"}</td>
                      <td
                        className={`text-center font-bold tabular-nums ${r.direction === "credit" ? "text-success" : "text-danger"}`}
                      >
                        {r.direction === "credit" ? "+" : "-"}
                        {fmtMoney(r.amount)}
                      </td>
                      <td className="text-center">{r.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {extracted.length > 100 && (
                <div className="text-center text-[10px] text-muted-foreground p-1">
                  …و {extracted.length - 100} صف آخر
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStage("upload")} className="flex-1">
                رجوع
              </Button>
              <Button
                onClick={runCommit}
                className="flex-1 bg-gradient-primary text-primary-foreground"
              >
                <Upload className="size-4" /> حفظ الكل
              </Button>
            </div>
          </div>
        )}

        {stage === "commit" && (
          <div className="py-10 text-center space-y-2">
            <Loader2 className="size-8 animate-spin text-primary mx-auto" />
            <div className="text-[12px] font-bold">جاري حفظ {extracted.length} رصيد افتتاحي…</div>
          </div>
        )}

        {stage === "done" && result && (
          <div className="space-y-3">
            <div className="text-center py-2">
              <CheckCircle2 className="size-10 text-success mx-auto" />
              <div className="text-[14px] font-black mt-1">اكتمل الاستيراد</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Card className="p-2">
                <div className="text-muted-foreground">عملاء جدد</div>
                <div className="font-black text-success">{result.peopleCreated}</div>
              </Card>
              <Card className="p-2">
                <div className="text-muted-foreground">عملاء مدمجين</div>
                <div className="font-black">{result.peopleMerged}</div>
              </Card>
              <Card className="p-2">
                <div className="text-muted-foreground">أرصدة افتتاحية</div>
                <div className="font-black text-primary">{result.openingsInserted}</div>
              </Card>
              <Card className="p-2">
                <div className="text-muted-foreground">تم تحديثها</div>
                <div className="font-black">{result.openingsUpdated}</div>
              </Card>
              <Card className="p-2 col-span-2">
                <div className="text-muted-foreground">دفعات مسجلة</div>
                <div className="font-black text-primary">{result.paymentsInserted}</div>
              </Card>
            </div>
            {result.errors.length > 0 && (
              <Card className="p-2 bg-danger-soft border-danger/30">
                <div className="text-[11px] font-bold text-danger flex items-center gap-1">
                  <AlertTriangle className="size-3" /> {result.errors.length} تحذير
                </div>
              </Card>
            )}
            <Button onClick={() => onOpenChange(false)} className="w-full">
              تم
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

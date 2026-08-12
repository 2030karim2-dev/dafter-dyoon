import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  parseExcelFile,
  mapRows,
  type ColumnMapping,
  type Row,
  type MappedTx,
} from "@/lib/io/importExcel";
import { extractPdfText } from "@/lib/io/importPdf";
import { commitImportedTxs } from "@/lib/io/commitImport";
import { aiSuggestImportMapping, aiExtractFromPdfText } from "@/lib/ai-import.functions";
import { ImportStep1Upload } from "./ImportStep1Upload";
import { ImportStep2Map } from "./ImportStep2Map";
import { ImportStep3Preview } from "./ImportStep3Preview";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}
type Step = 1 | 2 | 3;

function guessLocal(h: string[]): ColumnMapping {
  const g = (kws: string[]) => h.find((c) => kws.some((k) => c.toLowerCase().includes(k))) ?? "";
  return {
    name: g(["name", "اسم", "client", "عميل"]),
    amount: g(["amount", "مبلغ", "value", "قيمة"]),
    direction: g(["type", "نوع", "direction", "حركة"]),
    date: g(["date", "تاريخ"]),
    details: g(["detail", "note", "تفاصيل", "ملاحظ", "وصف"]),
    phone: g(["phone", "mobile", "جوال", "هاتف", "موبايل"]),
    currency: g(["currency", "عملة"]),
    opening_balance: g(["opening", "افتتاح", "رصيد سابق", "previous"]),
  };
}

export function ImportWizard({ open, onOpenChange, onDone }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ name: "", amount: "" });
  const [mapped, setMapped] = useState<MappedTx[]>([]);
  const [errors, setErrors] = useState<{ row: number; reason: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const aiSuggest = useServerFn(aiSuggestImportMapping);
  const aiPdf = useServerFn(aiExtractFromPdfText);

  const reset = () => {
    setStep(1);
    setRows([]);
    setHeaders([]);
    setMapping({ name: "", amount: "" });
    setMapped([]);
    setErrors([]);
  };

  const handleExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { headers: h, rows: r } = await parseExcelFile(f);
      if (!r.length) {
        toast.error("الملف فارغ");
        return;
      }
      setHeaders(h);
      setRows(r);
      setMapping(guessLocal(h));
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر قراءة الملف");
    }
  };

  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPdfBusy(true);
    try {
      const text = await extractPdfText(f);
      if (text.length < 20) {
        toast.error("لم يتم العثور على نص قابل للقراءة في PDF");
        return;
      }
      const res = await aiPdf({ data: { text } });
      if (!res.rows.length) {
        toast.error("لم يتم استخراج صفوف");
        return;
      }
      const pseudoRows: Row[] = res.rows.map((r) => ({
        name: r.name,
        amount: r.amount,
        direction: r.direction,
        date: r.date ?? "",
        details: r.details ?? "",
        phone: r.phone ?? "",
      }));
      setHeaders(["name", "amount", "direction", "date", "details", "phone"]);
      setRows(pseudoRows);
      setMapping({
        name: "name",
        amount: "amount",
        direction: "direction",
        date: "date",
        details: "details",
        phone: "phone",
      });
      toast.success(`استخرج AI ${res.rows.length} صف من PDF`);
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تحليل PDF");
    } finally {
      setPdfBusy(false);
    }
  };

  const runAiMap = async () => {
    if (!headers.length) return;
    setAiBusy(true);
    try {
      const out = await aiSuggest({
        data: { headers, sampleRows: rows.slice(0, 5) as Record<string, unknown>[] },
      });
      setMapping(out);
      toast.success("تم اقتراح الأعمدة بواسطة AI");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الاقتراح");
    } finally {
      setAiBusy(false);
    }
  };

  const preview = () => {
    if (!mapping.name || !mapping.amount) {
      toast.error("اختر عمودي الاسم والمبلغ");
      return;
    }
    const { ok, errors } = mapRows(rows, mapping);
    setMapped(ok);
    setErrors(errors);
    setStep(3);
  };

  const commit = async () => {
    if (!user || !mapped.length) return;
    setBusy(true);
    const { data: cur } = await supabase
      .from("currencies")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_base", true)
      .maybeSingle();
    if (!cur?.id) {
      toast.error("لا توجد عملة أساسية");
      setBusy(false);
      return;
    }
    const res = await commitImportedTxs(user.id, cur.id, mapped);
    setBusy(false);
    toast.success(
      `استورد ${res.inserted} معاملة، ${res.people} عميل جديد${res.openings ? "، " + res.openings + " رصيد افتتاحي" : ""}${res.failed ? ` (فشل ${res.failed})` : ""}`,
    );
    onDone?.();
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-right text-[13px]">استيراد ذكي — خطوة {step}/3</DialogTitle>
        </DialogHeader>
        {step === 1 && (
          <ImportStep1Upload pdfBusy={pdfBusy} onExcel={handleExcel} onPdf={handlePdf} />
        )}
        {step === 2 && (
          <ImportStep2Map
            headers={headers}
            rowCount={rows.length}
            mapping={mapping}
            setMapping={setMapping}
            aiBusy={aiBusy}
            onAi={runAiMap}
            onBack={() => setStep(1)}
            onNext={preview}
          />
        )}
        {step === 3 && (
          <ImportStep3Preview
            mapped={mapped}
            errors={errors}
            busy={busy}
            onBack={() => setStep(2)}
            onCommit={commit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

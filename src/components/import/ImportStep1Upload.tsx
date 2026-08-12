import { UploadCloud, FileText, Loader2, Sparkles } from "lucide-react";

interface Props {
  pdfBusy: boolean;
  onExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPdf: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ImportStep1Upload({ pdfBusy, onExcel, onPdf }: Props) {
  return (
    <div className="space-y-2.5">
      <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-primary/40 rounded-xl p-5 cursor-pointer hover:bg-primary/5 transition-colors">
        <UploadCloud className="size-7 text-primary" />
        <div className="text-[12px] font-semibold">Excel / CSV</div>
        <div className="text-[10px] text-muted-foreground">.xlsx، .xls، .csv</div>
        <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={onExcel} />
      </label>
      <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-accent/40 rounded-xl p-5 cursor-pointer hover:bg-accent/5 transition-colors">
        {pdfBusy ? (
          <Loader2 className="size-7 text-accent animate-spin" />
        ) : (
          <FileText className="size-7 text-accent" />
        )}
        <div className="text-[12px] font-semibold">PDF (استخراج بـ AI)</div>
        <div className="text-[10px] text-muted-foreground">يستخرج الصفوف تلقائياً</div>
        <input type="file" accept=".pdf" hidden disabled={pdfBusy} onChange={onPdf} />
      </label>
      <div className="text-[10px] text-muted-foreground bg-secondary p-2 rounded-md">
        <Sparkles className="size-3 inline ms-0.5 text-primary" /> AI يقترح ربط الأعمدة تلقائياً بعد
        الرفع
      </div>
    </div>
  );
}

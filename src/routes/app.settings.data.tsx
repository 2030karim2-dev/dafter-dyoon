import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SettingsRow } from "@/components/common/SettingsRow";
import { SettingsGroup } from "@/components/common/SettingsGroup";
import { Database, Download, Upload, FileSpreadsheet, Trash2, Cloud, History, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  buildSnapshot, uploadBackup, listBackups, downloadBackup, deleteBackup, restoreFromSnapshot,
} from "@/lib/backup";
import { exportAllToExcel } from "@/lib/io/exportExcel";
import { ImportWizard } from "@/components/import/ImportWizard";
import { BackupsList, type BackupItem } from "@/features/data/BackupsList";
import { AutoBackupFrequency, type BackupFrequency } from "@/features/data/AutoBackupFrequency";

export const Route = createFileRoute("/app/settings/data")({ component: DataPage });

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function DataPage() {
  const { user } = useAuth();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [frequency, setFrequency] = useState<BackupFrequency>("off");
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadBackups = async () => {
    if (!user) return;
    setBackups((await listBackups(user.id)) as BackupItem[]);
  };

  useEffect(() => {
    if (!user) return;
    loadBackups();
    supabase.from("profiles").select("backup_frequency").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setFrequency((data?.backup_frequency ?? "off") as BackupFrequency));
  }, [user]);

  const exportJSON = async () => {
    if (!user) return;
    setBusy(true);
    const snap = await buildSnapshot(user.id);
    download(new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" }), `daftarak-backup-${Date.now()}.json`);
    setBusy(false);
    toast.success("تم تنزيل النسخة");
  };

  const exportCSV = async (kind: "transactions") => {
    const { data } = await supabase.from(kind).select("*");
    if (!data?.length) { toast.info("لا توجد بيانات"); return; }
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map((r: Record<string, unknown>) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `daftarak-${kind}-${Date.now()}.csv`);
    toast.success("تم التصدير");
  };

  const cloudBackup = async () => {
    if (!user) return;
    setBusy(true);
    const r = await uploadBackup(user.id, "manual");
    setBusy(false);
    if (!r) { toast.error("فشل الرفع"); return; }
    toast.success("تم حفظ النسخة في السحابة");
    loadBackups();
  };

  const setFreq = async (v: BackupFrequency) => {
    if (!user) return;
    setFrequency(v);
    await supabase.from("profiles").update({ backup_frequency: v }).eq("user_id", user.id);
    toast.success("تم الحفظ");
  };

  const restore = async () => {
    if (!user || !restoreId) return;
    const b = backups.find((x) => x.id === restoreId);
    if (!b) return;
    setBusy(true);
    const snap = await downloadBackup(b.path);
    if (!snap) { setBusy(false); toast.error("تعذّر تحميل النسخة"); return; }
    const n = await restoreFromSnapshot(user.id, snap, "merge");
    setBusy(false);
    toast.success(`تم استرجاع ${n} عنصر`);
    setRestoreId(null);
  };

  const removeBackup = async (b: BackupItem) => {
    await deleteBackup(b.id, b.path);
    toast.success("تم الحذف");
    loadBackups();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const snap = JSON.parse(await file.text());
      if (!snap.version) throw new Error("ملف غير صالح");
      const n = await restoreFromSnapshot(user.id, snap, "merge");
      toast.success(`تم استيراد ${n} عنصر`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الاستيراد");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const wipe = async () => {
    if (!user) return;
    setBusy(true);
    const tables = ["transactions", "reminders", "recurring_rules", "people"];
    for (const t of tables) {
      await (supabase.from(t as never) as never as { delete: () => { eq: (k: string, v: string) => Promise<unknown> } }).delete().eq("user_id", user.id);
    }
    setBusy(false);
    toast.success("تم مسح البيانات");
  };

  return (
    <div className="space-y-2.5">
      <PageHeader icon={Database} title="البيانات والنسخ الاحتياطي" subtitle="السحابة، التصدير، الاستيراد" back="/app/settings" />

      <SettingsGroup title="النسخ الاحتياطي السحابي">
        <SettingsRow icon={Cloud} label="إنشاء نسخة احتياطية الآن" desc="رفع فوري إلى التخزين السحابي" tone="primary" onClick={cloudBackup} />
        <SettingsRow icon={History} label="سجل النشاط" desc="آخر العمليات" to="/app/activity" tone="muted" />
      </SettingsGroup>

      <AutoBackupFrequency value={frequency} onChange={setFreq} />

      <BackupsList backups={backups} onRestore={setRestoreId} onDelete={removeBackup} />

      <SettingsGroup title="التصدير والاستيراد المحلي">
        <SettingsRow icon={FileSpreadsheet} label="تصدير شامل إلى Excel" desc="أشخاص + معاملات + كشوف" tone="success" onClick={async () => { if (!user) return; setBusy(true); await exportAllToExcel(user.id); setBusy(false); toast.success("تم التصدير"); }} />
        <SettingsRow icon={Upload} label="استيراد معاملات من Excel" desc=".xlsx أو .csv — مع معاينة" tone="accent" onClick={() => setImportOpen(true)} />
        <SettingsRow icon={Download} label="نسخة احتياطية كاملة (JSON)" desc="تحميل ملف على جهازك" tone="primary" onClick={exportJSON} />
        <SettingsRow icon={FileText} label="تصدير المعاملات (CSV)" desc="ديون فقط" onClick={() => exportCSV("transactions")} />
        <SettingsRow icon={Upload} label="استيراد من نسخة JSON" desc="استعادة من ملف نسخة احتياطية" onClick={() => fileRef.current?.click()} />
      </SettingsGroup>

      <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleImport} />

      <Card className="p-1.5">
        <SettingsRow icon={Trash2} label="مسح كل البيانات" desc="لا يمكن التراجع" onClick={() => setConfirmWipe(true)} danger />
      </Card>

      <ConfirmDialog
        open={confirmWipe} onOpenChange={setConfirmWipe}
        title="مسح كل البيانات؟"
        description="سيتم حذف جميع العملاء والمعاملات والتذكيرات. هذا الإجراء لا يمكن التراجع عنه."
        confirmLabel={busy ? "جارٍ..." : "مسح كل شيء"} destructive onConfirm={wipe}
      />
      <ConfirmDialog
        open={!!restoreId} onOpenChange={(v) => !v && setRestoreId(null)}
        title="استعادة هذه النسخة؟"
        description="سيتم دمج بيانات النسخة مع بياناتك الحالية. لن يُحذف شيء."
        confirmLabel={busy ? "جارٍ..." : "استعادة"} onConfirm={restore}
      />
      <ImportWizard open={importOpen} onOpenChange={setImportOpen} onDone={loadBackups} />
    </div>
  );
}

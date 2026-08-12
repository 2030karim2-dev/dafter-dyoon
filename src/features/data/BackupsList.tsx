import { Cloud, RefreshCw, Trash2 } from "lucide-react";
import { SettingsGroup } from "@/components/common/SettingsGroup";
import { fmtDate } from "@/lib/format";

export interface BackupItem {
  id: string;
  path: string;
  size_bytes: number;
  kind: string;
  created_at: string;
}

interface Props {
  backups: BackupItem[];
  onRestore: (id: string) => void;
  onDelete: (b: BackupItem) => void;
}

export function BackupsList({ backups, onRestore, onDelete }: Props) {
  if (!backups.length) return null;
  return (
    <SettingsGroup title={`النسخ المحفوظة (${backups.length}/10)`}>
      {backups.map((b) => (
        <div key={b.id} className="flex items-center gap-2 p-2 hover:bg-secondary rounded-lg">
          <div className="size-8 rounded-lg bg-secondary text-primary flex items-center justify-center shrink-0 ring-1 ring-border">
            <Cloud className="size-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[12px] flex items-center gap-1.5 leading-tight">
              <span>{b.kind === "auto" ? "تلقائي" : "يدوي"}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{(b.size_bytes / 1024).toFixed(1)} KB</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(b.created_at)}</div>
          </div>
          <button
            onClick={() => onRestore(b.id)}
            className="text-primary p-1 hover:bg-primary/10 rounded-md"
            aria-label="استعادة"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            onClick={() => onDelete(b)}
            className="text-danger p-1 hover:bg-danger-soft rounded-md"
            aria-label="حذف"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
    </SettingsGroup>
  );
}

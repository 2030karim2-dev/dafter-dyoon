import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Trash2,
  Pencil,
  Share2,
  MessageCircle,
  Archive,
  FileText,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react";

interface Props {
  onPdf: () => void;
  onExcel: () => void;
  onShare: () => void;
  onWhatsApp: () => void;
  onAiMessage: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function PersonActionsBar(p: Props) {
  const Btn = ({
    onClick,
    label,
    color,
    children,
  }: {
    onClick: () => void;
    label: string;
    color: string;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      aria-label={label}
      className={`p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:${color}`}
    >
      {children}
    </button>
  );
  return (
    <div className="flex items-center justify-between">
      <Link
        to="/app"
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-3.5" /> رجوع
      </Link>
      <div className="flex items-center gap-0.5">
        <Btn onClick={p.onAiMessage} label="رسالة ذكية" color="text-primary">
          <Sparkles className="size-3.5" />
        </Btn>
        <Btn onClick={p.onPdf} label="PDF" color="text-danger">
          <FileText className="size-3.5" />
        </Btn>
        <Btn onClick={p.onExcel} label="Excel" color="text-success">
          <FileSpreadsheet className="size-3.5" />
        </Btn>
        <Btn onClick={p.onShare} label="مشاركة" color="text-primary">
          <Share2 className="size-3.5" />
        </Btn>
        <Btn onClick={p.onWhatsApp} label="واتساب" color="text-success">
          <MessageCircle className="size-3.5" />
        </Btn>
        <Btn onClick={p.onEdit} label="تعديل" color="text-primary">
          <Pencil className="size-3.5" />
        </Btn>
        <Btn onClick={p.onArchive} label="أرشفة" color="text-primary">
          <Archive className="size-3.5" />
        </Btn>
        <Btn onClick={p.onDelete} label="حذف" color="text-danger">
          <Trash2 className="size-3.5" />
        </Btn>
      </div>
    </div>
  );
}

import { MoreVertical, Pencil, Trash2, Archive } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  size?: "sm" | "md";
}

/** Compact 3-dot menu (Edit / Archive / Delete). Stops event propagation to avoid triggering parent link. */
export function RowActions({ onEdit, onArchive, onDelete, size = "sm" }: Props) {
  const stop = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  const sz = size === "sm" ? "size-7" : "size-8";
  const icon = size === "sm" ? "size-3.5" : "size-4";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={stop}
          onPointerDown={stop}
          aria-label="إجراءات"
          className={`${sz} inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition`}
        >
          <MoreVertical className={icon} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-36 p-1" onClick={stop}>
        {onEdit && (
          <button
            onClick={(e) => {
              stop(e);
              onEdit();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] rounded-md hover:bg-secondary text-right"
          >
            <Pencil className="size-3.5 text-primary" /> تعديل
          </button>
        )}
        {onArchive && (
          <button
            onClick={(e) => {
              stop(e);
              onArchive();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] rounded-md hover:bg-secondary text-right"
          >
            <Archive className="size-3.5 text-amber-600" /> أرشفة
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              stop(e);
              onDelete();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] rounded-md hover:bg-danger/10 text-right text-danger"
          >
            <Trash2 className="size-3.5" /> حذف
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

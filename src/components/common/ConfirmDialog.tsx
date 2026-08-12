import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Disables both buttons while an async confirm is in flight. */
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  destructive,
  busy,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-right">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-right">{description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              if (busy) return; // double-click protection
              const r = onConfirm();
              if (r instanceof Promise) {
                r.then(() => onOpenChange(false)).catch((e) =>
                  toast.error((e as { message?: string })?.message ?? "حدث خطأ"),
                );
              } else {
                onOpenChange(false);
              }
            }}
            className={`flex-1 ${destructive ? "bg-danger text-danger-foreground hover:bg-danger/90" : "bg-gradient-primary text-primary-foreground"}`}
          >
            {busy ? "جارٍ التنفيذ..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Upload,
  Trash2,
  FileText,
  ImageIcon,
  Download,
  Share2,
  Filter,
  Receipt,
  FileSignature,
  IdCard,
  Files,
  ArrowDownToLine,
  ArrowUpFromLine,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { fmtDate, fmtMoney } from "@/lib/format";
import { waPhone } from "@/lib/phone";

export const ATTACHMENT_CATEGORIES = [
  {
    value: "invoice",
    label: "فاتورة",
    icon: Receipt,
    color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40",
  },
  {
    value: "receipt_in",
    label: "سند قبض",
    icon: ArrowDownToLine,
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
  },
  {
    value: "receipt_out",
    label: "سند صرف",
    icon: ArrowUpFromLine,
    color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40",
  },
  {
    value: "contract",
    label: "عقد",
    icon: FileSignature,
    color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40",
  },
  {
    value: "id",
    label: "هوية",
    icon: IdCard,
    color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
  },
  {
    value: "other",
    label: "أخرى",
    icon: Files,
    color: "text-slate-600 bg-slate-100 dark:bg-slate-800/40",
  },
] as const;

type CatVal = (typeof ATTACHMENT_CATEGORIES)[number]["value"];

interface Attachment {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: string | null;
  note: string | null;
  amount: number | null;
  doc_date: string | null;
  created_at: string;
}

interface Props {
  personId: string;
  personPhone?: string | null;
}

export function CustomerAttachments({ personId, personPhone }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Attachment[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<CatVal | "all">("all");
  const [busy, setBusy] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; isImg: boolean } | null>(
    null,
  );
  const [draft, setDraft] = useState<{
    file: File | null;
    category: CatVal;
    note: string;
    amount: string;
    doc_date: string;
  }>({
    file: null,
    category: "invoice",
    note: "",
    amount: "",
    doc_date: new Date().toISOString().slice(0, 10),
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", "person")
      .eq("entity_id", personId)
      .order("doc_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Attachment[];
    setItems(list);
    // Generate signed thumbs for images
    const imgs = list.filter((a) => (a.mime_type ?? "").startsWith("image/"));
    const updates: Record<string, string> = {};
    await Promise.all(
      imgs.slice(0, 30).map(async (a) => {
        const { data: s } = await supabase.storage
          .from("receipts")
          .createSignedUrl(a.storage_path, 1200);
        if (s?.signedUrl) updates[a.id] = s.signedUrl;
      }),
    );
    setThumbs(updates);
  };

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [personId]);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((a) => (a.category ?? "other") === filter)),
    [items, filter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of items) c[a.category ?? "other"] = (c[a.category ?? "other"] ?? 0) + 1;
    return c;
  }, [items]);

  const handleUpload = async () => {
    if (!user || !draft.file) {
      toast.error("اختر ملفاً");
      return;
    }
    if (draft.file.size > 8 * 1024 * 1024) {
      toast.error("الحد الأقصى 8MB");
      return;
    }
    setBusy(true);
    const ext = draft.file.name.split(".").pop() || "bin";
    const path = `${user.id}/person/${personId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, draft.file);
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const { error: e2 } = await supabase.from("attachments").insert({
      user_id: user.id,
      entity_type: "person",
      entity_id: personId,
      storage_path: path,
      file_name: draft.file.name,
      mime_type: draft.file.type,
      size_bytes: draft.file.size,
      category: draft.category,
      note: draft.note || null,
      amount: draft.amount ? Number(draft.amount) : null,
      doc_date: draft.doc_date ? new Date(draft.doc_date).toISOString() : null,
    } as never);
    setBusy(false);
    if (e2) {
      toast.error(e2.message);
      return;
    }
    toast.success("تم الرفع");
    setOpenDialog(false);
    setDraft({
      file: null,
      category: "invoice",
      note: "",
      amount: "",
      doc_date: new Date().toISOString().slice(0, 10),
    });
    load();
  };

  const openFile = async (a: Attachment) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(a.storage_path, 600);
    if (!data?.signedUrl) return;
    const isImg = (a.mime_type ?? "").startsWith("image/");
    setPreview({ url: data.signedUrl, name: a.file_name, isImg });
  };

  const downloadFile = async (a: Attachment) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(a.storage_path, 600);
    if (!data?.signedUrl) return;
    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.download = a.file_name;
    link.click();
  };

  const shareWa = async (a: Attachment) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(a.storage_path, 3600);
    if (!data?.signedUrl) return;
    const cat = ATTACHMENT_CATEGORIES.find((c) => c.value === (a.category ?? "other"))?.label ?? "";
    const text = encodeURIComponent(`${cat}: ${a.file_name}\n${data.signedUrl}`);
    const p = waPhone(personPhone);
    window.open(p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  };

  const remove = async () => {
    const a = pendingDelete;
    if (!a) return;
    await supabase.storage.from("receipts").remove([a.storage_path]);
    const { error } = await supabase.from("attachments").delete().eq("id", a.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحذف");
    load();
  };

  return (
    <div className="space-y-2">
      {/* Filter chips */}
      <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 pb-1">
        <button
          onClick={() => setFilter("all")}
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] ring-1 transition ${
            filter === "all"
              ? "bg-primary text-primary-foreground ring-primary"
              : "bg-secondary ring-border text-foreground"
          }`}
        >
          <Filter className="size-3" /> الكل ({items.length})
        </button>
        {ATTACHMENT_CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = filter === c.value;
          return (
            <button
              key={c.value}
              onClick={() => setFilter(c.value)}
              className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] ring-1 transition ${
                active
                  ? "bg-primary text-primary-foreground ring-primary"
                  : `${c.color} ring-border`
              }`}
            >
              <Icon className="size-3" /> {c.label} {counts[c.value] ? `(${counts[c.value]})` : ""}
            </button>
          );
        })}
      </div>

      {/* Upload button */}
      <Button
        size="sm"
        onClick={() => setOpenDialog(true)}
        className="w-full bg-gradient-primary text-primary-foreground h-8 text-[12px]"
      >
        <Upload className="size-3.5" /> رفع فاتورة / سند / ملف
      </Button>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Files}
          title="لا توجد مرفقات"
          description="ارفع الفواتير والسندات والملفات الخاصة بهذا العميل."
          variant="compact"
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {filtered.map((a) => {
            const cat =
              ATTACHMENT_CATEGORIES.find((c) => c.value === (a.category ?? "other")) ??
              ATTACHMENT_CATEGORIES[5];
            const Icon = cat.icon;
            const isImg = (a.mime_type ?? "").startsWith("image/");
            const thumb = thumbs[a.id];
            return (
              <div
                key={a.id}
                className="group rounded-lg overflow-hidden ring-1 ring-border bg-card hover:ring-primary/40 transition"
              >
                <button
                  onClick={() => openFile(a)}
                  className="block w-full aspect-[4/3] bg-secondary relative"
                >
                  {isImg && thumb ? (
                    <img
                      src={thumb}
                      alt={a.file_name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {isImg ? (
                        <ImageIcon className="size-7 text-muted-foreground" />
                      ) : (
                        <FileText className="size-7 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <span
                    className={`absolute top-1 right-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] ring-1 ring-border ${cat.color}`}
                  >
                    <Icon className="size-2.5" /> {cat.label}
                  </span>
                </button>
                <div className="p-1.5">
                  <div className="text-[10.5px] font-semibold truncate" title={a.file_name}>
                    {a.file_name}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground flex items-center justify-between">
                    <span>{a.doc_date ? fmtDate(a.doc_date) : fmtDate(a.created_at)}</span>
                    {a.amount ? (
                      <span className="font-bold text-primary">{fmtMoney(Number(a.amount))}</span>
                    ) : null}
                  </div>
                  {a.note ? (
                    <div className="text-[10.5px] text-muted-foreground truncate" title={a.note}>
                      {a.note}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between mt-1">
                    <button
                      onClick={() => downloadFile(a)}
                      title="تنزيل"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Download className="size-3.5" />
                    </button>
                    <button
                      onClick={() => shareWa(a)}
                      title="واتساب"
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      <Share2 className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setPendingDelete(a)}
                      title="حذف"
                      className="text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-right text-[14px]">رفع مرفق</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setDraft((d) => ({ ...d, file: e.target.files?.[0] ?? null }))}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-[12px]"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-3.5" />{" "}
              {draft.file ? draft.file.name : "اختر ملفاً (صورة أو PDF)"}
            </Button>
            <Select
              value={draft.category}
              onValueChange={(v) => setDraft((d) => ({ ...d, category: v as CatVal }))}
            >
              <SelectTrigger className="h-8 text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTACHMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={draft.doc_date}
                onChange={(e) => setDraft((d) => ({ ...d, doc_date: e.target.value }))}
                className="h-8 text-[12px]"
              />
              <Input
                type="number"
                inputMode="decimal"
                placeholder="المبلغ (اختياري)"
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                className="h-8 text-[12px]"
              />
            </div>
            <Input
              placeholder="ملاحظة (اختياري)"
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              className="h-8 text-[12px]"
              maxLength={200}
            />
            <Button
              onClick={handleUpload}
              disabled={busy || !draft.file}
              className="w-full h-9 bg-gradient-primary text-primary-foreground text-[12px]"
            >
              {busy ? "..." : "رفع"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview lightbox */}
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader>
            <DialogTitle className="text-right text-[12px] truncate flex items-center justify-between gap-2">
              <span className="truncate">{preview?.name}</span>
              <button onClick={() => setPreview(null)} className="text-muted-foreground">
                <X className="size-4" />
              </button>
            </DialogTitle>
          </DialogHeader>
          {preview &&
            (preview.isImg ? (
              <img
                src={preview.url}
                alt={preview.name}
                className="w-full max-h-[75vh] object-contain rounded"
              />
            ) : (
              <iframe
                src={preview.url}
                title={preview.name}
                className="w-full h-[75vh] rounded border-0"
              />
            ))}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title="حذف المرفق نهائياً؟"
        description={pendingDelete ? `سيُحذف "${pendingDelete.file_name}" نهائياً.` : undefined}
        confirmLabel="حذف"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}

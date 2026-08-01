import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Paperclip, Trash2, Upload, FileText, ImageIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Attachment {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
}

interface Props {
  entityType: "transaction" | "person";
  entityId: string;
  compact?: boolean;
}

export function AttachmentsManager({ entityType, entityId, compact }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!entityId) return;
    const { data } = await supabase
      .from("attachments")
      .select("id,storage_path,file_name,mime_type,size_bytes")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Attachment[]);
  };

  useEffect(() => { load(); }, [entityType, entityId]);

  const upload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("الحد الأقصى 5MB"); return; }
    setBusy(true);
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${entityType}/${entityId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file);
    if (error) { setBusy(false); toast.error(error.message); return; }
    const { error: e2 } = await supabase.from("attachments").insert({
      user_id: user.id, entity_type: entityType, entity_id: entityId,
      storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
    } as never);
    setBusy(false);
    if (e2) { toast.error(e2.message); return; }
    toast.success("تم الرفع");
    load();
  };

  const open = async (a: Attachment) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(a.storage_path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const remove = async (a: Attachment) => {
    if (!confirm("حذف المرفق؟")) return;
    await supabase.storage.from("receipts").remove([a.storage_path]);
    const { error } = await supabase.from("attachments").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    load();
  };

  return (
    <div className="space-y-1.5">
      {!compact && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Paperclip className="size-3" /> المرفقات ({items.length})
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {items.map((a) => {
          const isImg = (a.mime_type ?? "").startsWith("image/");
          return (
            <div key={a.id} className="group flex items-center gap-1 bg-secondary rounded-md px-1.5 py-1 text-[11px] ring-1 ring-border">
              {isImg ? <ImageIcon className="size-3" /> : <FileText className="size-3" />}
              <button type="button" onClick={() => open(a)} className="max-w-[120px] truncate hover:underline">
                {a.file_name}
              </button>
              <button type="button" onClick={() => open(a)} className="text-muted-foreground hover:text-foreground"><ExternalLink className="size-3" /></button>
              <button type="button" onClick={() => remove(a)} className="text-danger opacity-60 hover:opacity-100"><Trash2 className="size-3" /></button>
            </div>
          );
        })}
        <input
          ref={inputRef} type="file" className="hidden"
          accept="image/*,application/pdf"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <button
          type="button" disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 text-primary px-2 py-1 text-[11px] hover:bg-primary/5 disabled:opacity-50"
        >
          <Upload className="size-3" /> {busy ? "…" : "إرفاق"}
        </button>
      </div>
    </div>
  );
}

/**
 * Server-only per-customer activity log: audit entries, sent messages,
 * queued/failed reminders, promises and attachments in one chronological list.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient;

export type ActivityKind = "audit" | "message" | "outbox" | "promise" | "attachment" | "tx";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  at: string;
  title: string;
  detail: string | null;
  tone: "neutral" | "success" | "danger" | "warning";
  meta: string | null;
}

const ACTION_AR: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  archive: "أرشفة",
  restore: "استعادة",
  import: "استيراد",
  export: "تصدير",
  payment: "تسجيل دفعة",
  message: "رسالة",
};

const ENTITY_AR: Record<string, string> = {
  person: "العميل",
  transaction: "معاملة",
  attachment: "مرفق",
  opening_balance: "رصيد افتتاحي",
  promise: "وعد سداد",
  reminder: "تذكير",
};

const MSG_KIND_AR: Record<string, string> = {
  upcoming: "تذكير قبل الاستحقاق",
  due_today: "تذكير استحقاق اليوم",
  overdue: "تذكير بمبلغ متأخر",
  statement: "كشف حساب",
  thanks: "شكر بعد السداد",
};

const CHANNEL_AR: Record<string, string> = {
  whatsapp: "واتساب",
  telegram: "تليجرام",
  sms: "رسالة نصية",
  manual: "يدوي",
};

export async function loadPersonActivity(
  supabase: DB,
  userId: string,
  personId: string,
): Promise<ActivityItem[]> {
  const [auditRes, msgRes, outRes, prRes, atRes, txRes] = await Promise.all([
    supabase
      .from("audit_log")
      .select("id,action,entity,entity_id,metadata,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("message_log")
      .select("id,channel,kind,body,sent_at,destination")
      .eq("user_id", userId)
      .eq("person_id", personId)
      .order("sent_at", { ascending: false })
      .limit(100),
    supabase
      .from("outbox")
      .select("id,channel,kind,status,scheduled_at,created_at,last_error,attempts")
      .eq("user_id", userId)
      .eq("person_id", personId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("payment_promises")
      .select("id,amount,promised_date,status,note,created_at")
      .eq("user_id", userId)
      .eq("person_id", personId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("attachments")
      .select("id,file_name,category,created_at")
      .eq("user_id", userId)
      .eq("entity_type", "person")
      .eq("entity_id", personId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("transactions")
      .select("id,amount,direction,details,transaction_date,created_at")
      .eq("user_id", userId)
      .eq("person_id", personId)
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  const items: ActivityItem[] = [];

  for (const a of auditRes.data ?? []) {
    const meta = (a.metadata ?? {}) as Record<string, unknown>;
    const belongs =
      a.entity_id === personId || meta["person_id"] === personId || meta["personId"] === personId;
    if (!belongs) continue;
    items.push({
      id: `au:${a.id}`,
      kind: "audit",
      at: a.created_at,
      title: `${ACTION_AR[a.action] ?? a.action} ${ENTITY_AR[a.entity] ?? a.entity}`,
      detail: typeof meta["note"] === "string" ? (meta["note"] as string) : null,
      tone: a.action === "delete" ? "danger" : a.action === "create" ? "success" : "neutral",
      meta: null,
    });
  }

  for (const t of txRes.data ?? []) {
    const credit = t.direction === "credit";
    items.push({
      id: `tx:${t.id}`,
      kind: "tx",
      at: t.created_at ?? t.transaction_date,
      title: credit ? "إضافة دين على العميل" : "تسجيل دفعة / تسوية",
      detail: t.details ?? null,
      tone: credit ? "danger" : "success",
      meta: Number(t.amount).toLocaleString("en-US"),
    });
  }

  for (const m of msgRes.data ?? []) {
    items.push({
      id: `ms:${m.id}`,
      kind: "message",
      at: m.sent_at,
      title: `إرسال ${MSG_KIND_AR[m.kind] ?? "رسالة"}`,
      detail: (m.body ?? "").split("\n")[0]?.slice(0, 90) ?? null,
      tone: "success",
      meta: CHANNEL_AR[m.channel] ?? m.channel,
    });
  }

  for (const o of outRes.data ?? []) {
    if (o.status === "sent") continue; // already covered by message_log
    items.push({
      id: `ob:${o.id}`,
      kind: "outbox",
      at: o.created_at ?? o.scheduled_at,
      title: o.status === "failed" ? "فشل إرسال تذكير" : "تذكير في قائمة الصادر",
      detail: o.last_error ?? MSG_KIND_AR[o.kind] ?? null,
      tone: o.status === "failed" ? "danger" : "warning",
      meta: CHANNEL_AR[o.channel] ?? o.channel,
    });
  }

  for (const p of prRes.data ?? []) {
    const tone = p.status === "kept" ? "success" : p.status === "broken" ? "danger" : "warning";
    items.push({
      id: `pr:${p.id}`,
      kind: "promise",
      at: p.created_at,
      title:
        p.status === "kept"
          ? "وعد سداد تم الوفاء به"
          : p.status === "broken"
            ? "وعد سداد لم يُلتزم به"
            : "وعد بالسداد",
      detail: p.note ?? `تاريخ الوعد: ${p.promised_date}`,
      tone,
      meta: Number(p.amount).toLocaleString("en-US"),
    });
  }

  for (const a of atRes.data ?? []) {
    items.push({
      id: `at:${a.id}`,
      kind: "attachment",
      at: a.created_at,
      title: "رفع مرفق",
      detail: a.file_name,
      tone: "neutral",
      meta: a.category ?? null,
    });
  }

  return items
    .filter((i) => !!i.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 250);
}

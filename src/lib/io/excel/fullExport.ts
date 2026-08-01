import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { CatRow, CurRow, ExpRow, PersonRow, TxRow } from "./types";
import { downloadWorkbook } from "./download";

/** Full-account backup workbook: people, transactions and expenses sheets. */
export async function exportFullAccountWorkbook(
  userId: string,
  fileName = `daftarak-${Date.now()}.xlsx`,
) {
  const [{ data: people }, { data: txs }, { data: expenses }, { data: currencies }, { data: cats }] =
    await Promise.all([
      supabase.from("people").select("id,name,phone").eq("user_id", userId),
      supabase
        .from("transactions")
        .select("person_id,amount,direction,transaction_date,details,currency_id")
        .eq("user_id", userId),
      supabase.from("expenses").select("amount,expense_date,note,category_id,currency_id").eq("user_id", userId),
      supabase.from("currencies").select("id,name,symbol,rate").eq("user_id", userId),
      supabase.from("expense_categories").select("id,name").eq("user_id", userId),
    ]);

  const peopleList = (people as PersonRow[]) ?? [];
  const txList = (txs as TxRow[]) ?? [];
  const expList = (expenses as unknown as ExpRow[]) ?? [];
  const pMap = new Map<string, PersonRow>(peopleList.map((p) => [p.id, p]));
  const cMap = new Map<string, CurRow>(((currencies as CurRow[]) ?? []).map((c) => [c.id, c]));
  const catMap = new Map<string, CatRow>(((cats as CatRow[]) ?? []).map((c) => [c.id, c]));

  const peopleSheet = peopleList.map((p) => {
    let bal = 0;
    for (const t of txList.filter((x) => x.person_id === p.id)) {
      const rate = cMap.get(t.currency_id)?.rate ?? 1;
      bal += Number(t.amount) * (t.direction === "credit" ? 1 : -1) * rate;
    }
    return { "الاسم": p.name, "الجوال": p.phone ?? "", "الرصيد": Math.abs(bal), "الحالة": bal >= 0 ? "له" : "عليه" };
  });

  const txSheet = txList.map((t) => ({
    "التاريخ": new Date(t.transaction_date).toLocaleDateString("ar-EG"),
    "الاسم": pMap.get(t.person_id ?? "")?.name ?? "—",
    "النوع": t.direction === "credit" ? "له" : "عليه",
    "المبلغ": Number(t.amount),
    "العملة": cMap.get(t.currency_id)?.name ?? "",
    "التفاصيل": t.details ?? "",
  }));

  const expSheet = expList.map((e) => ({
    "التاريخ": new Date(e.expense_date).toLocaleDateString("ar-EG"),
    "التصنيف": catMap.get(e.category_id)?.name ?? "—",
    "المبلغ": Number(e.amount),
    "العملة": cMap.get(e.currency_id)?.name ?? "",
    "الوصف": e.note ?? "",
  }));

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(peopleSheet), "الأشخاص");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txSheet), "المعاملات");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expSheet), "المصاريف");

  downloadWorkbook(XLSX.write(wb, { type: "array", bookType: "xlsx" }), fileName);
}

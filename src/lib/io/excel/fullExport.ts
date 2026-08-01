import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { CurRow, PersonRow, TxRow } from "./types";
import { downloadWorkbook } from "./download";

/** Full-account backup workbook: people and transactions sheets. */
export async function exportFullAccountWorkbook(
  userId: string,
  fileName = `daftarak-${Date.now()}.xlsx`,
) {
  const [{ data: people }, { data: txs }, { data: currencies }] =
    await Promise.all([
      supabase.from("people").select("id,name,phone").eq("user_id", userId),
      supabase
        .from("transactions")
        .select("person_id,amount,direction,transaction_date,details,currency_id")
        .eq("user_id", userId),
      supabase.from("currencies").select("id,name,symbol").eq("user_id", userId),
    ]);

  const peopleList = (people as PersonRow[]) ?? [];
  const txList = (txs as TxRow[]) ?? [];
  const pMap = new Map<string, PersonRow>(peopleList.map((p) => [p.id, p]));
  const cMap = new Map<string, CurRow>(((currencies as CurRow[]) ?? []).map((c) => [c.id, c]));

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

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(peopleSheet), "الأشخاص");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txSheet), "المعاملات");

  downloadWorkbook(XLSX.write(wb, { type: "array", bookType: "xlsx" }), fileName);
}

import type { CompanyInfo } from "./format";
import { dmy, esc, fmt } from "./format";
import { C } from "./theme";
import { ensureArabicFontLoaded, fetchCompany, logoDataUrl } from "./company";
import { renderHtmlToPdf } from "./render";

export interface PlanInstallmentPdf {
  id: string;
  amount: number;
  promised_date: string;
  status: string;
}

export interface PlanSchedulePdfOpts {
  personName: string;
  personPhone?: string | null;
  currencyName: string;
  totalAmount: number;
  installmentAmount: number;
  frequency: string;
  startDate: string;
  status: string;
  note?: string | null;
  installments: PlanInstallmentPdf[];
  keptCount: number;
  paidTotal: number;
}

const STATUS_AR: Record<string, { label: string; bg: string; fg: string }> = {
  open: { label: "قائم", bg: C.primarySoft, fg: C.primary },
  kept: { label: "مسدّد", bg: C.accentSoft, fg: C.accent },
  broken: { label: "متأخر", bg: C.dangerSoft, fg: C.danger },
  cancelled: { label: "ملغى", bg: "#e5e7eb", fg: "#4b5563" },
};

/** جدول أقساط — HTML جاهز للالتقاط ثم التحويل إلى PDF عبر المسار الحالي. */
function buildPlanHtml(
  o: PlanSchedulePdfOpts & { company: CompanyInfo | null; logo: string | null },
): string {
  const { company, logo } = o;
  const contact = [
    company?.phone && `هاتف: ${esc(company.phone)}`,
    company?.email && esc(company.email),
    company?.tax_number && `الرقم الضريبي: ${esc(company.tax_number)}`,
  ]
    .filter(Boolean)
    .join("  •  ");
  const freqLabel = o.frequency === "monthly" ? "شهري" : "أسبوعي";
  const remaining = o.totalAmount - o.paidTotal;

  const rows = o.installments
    .map((ins, i) => {
      const st = STATUS_AR[ins.status] ?? STATUS_AR.cancelled!;
      return `
        <tr>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:center;">${i + 1}</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:center;white-space:nowrap;">${dmy(ins.promised_date)}</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;font-weight:700;white-space:nowrap;">${fmt(ins.amount)}</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:center;">
            <span style="display:inline-block;background:${st.bg};color:${st.fg};font-weight:700;border-radius:999px;padding:2px 10px;font-size:10px;">${st.label}</span>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div id="__plan_root" dir="rtl" lang="ar" style="
      width: 794px; padding: 28px; background: #fff; color: ${C.text};
      font-family: 'Tajawal','Cairo','Noto Sans Arabic','IBM Plex Sans Arabic','Segoe UI',Arial,sans-serif;
      font-size: 12px; line-height: 1.55; -webkit-font-smoothing: antialiased;">

      <div style="background:${C.primary};color:#fff;padding:14px 16px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${logo ? `<img src="${esc(logo)}" style="width:48px;height:48px;border-radius:8px;background:#fff;object-fit:contain;padding:3px;" crossorigin="anonymous" />` : ""}
          <div>
            <div style="font-size:18px;font-weight:800;">${esc(company?.name) || "دفترك"}</div>
            <div style="font-size:10.5px;opacity:.9;margin-top:2px;">${contact}</div>
            ${company?.address ? `<div style="font-size:10.5px;opacity:.85;margin-top:2px;">${esc(company.address)}</div>` : ""}
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:16px;font-weight:800;">جدول سداد</div>
          <div style="font-size:10.5px;opacity:.9;">Payment Schedule</div>
          <div style="font-size:10.5px;opacity:.9;margin-top:3px;">التاريخ: ${dmy(new Date())}</div>
        </div>
      </div>

      <div style="margin-top:12px;background:${C.primarySoft};border:1px solid ${C.primary};border-radius:6px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:10.5px;color:${C.muted};">العميل</div>
          <div style="font-size:14px;font-weight:800;">${esc(o.personName)}</div>
        </div>
        ${o.personPhone ? `<div style="text-align:left;"><div style="font-size:10.5px;color:${C.muted};">رقم الهاتف</div><div style="font-size:13px;font-weight:700;direction:ltr;">${esc(o.personPhone)}</div></div>` : ""}
      </div>

      <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">
        <div style="border:1px solid ${C.border};background:${C.bgAlt};border-radius:6px;padding:8px 10px;">
          <div style="font-size:10px;color:${C.muted};">إجمالي الدين (${esc(o.currencyName)})</div>
          <div style="font-size:14px;font-weight:800;color:${C.text};margin-top:2px;">${fmt(o.totalAmount)}</div>
        </div>
        <div style="border:1px solid ${C.border};background:${C.bgAlt};border-radius:6px;padding:8px 10px;">
          <div style="font-size:10px;color:${C.muted};">القسط الدوري (${freqLabel})</div>
          <div style="font-size:14px;font-weight:800;color:${C.primary};margin-top:2px;">${fmt(o.installmentAmount)}</div>
        </div>
        <div style="border:1px solid ${C.border};background:${C.accentSoft};border-radius:6px;padding:8px 10px;">
          <div style="font-size:10px;color:${C.muted};">المسدد</div>
          <div style="font-size:14px;font-weight:800;color:${C.accent};margin-top:2px;">${fmt(o.paidTotal)}</div>
        </div>
        <div style="border:1px solid ${C.border};background:${C.dangerSoft};border-radius:6px;padding:8px 10px;">
          <div style="font-size:10px;color:${C.muted};">المتبقي</div>
          <div style="font-size:14px;font-weight:800;color:${C.danger};margin-top:2px;">${fmt(Math.max(0, remaining))}</div>
        </div>
      </div>

      ${o.note ? `<div style="margin-top:8px;font-size:10.5px;color:${C.muted};font-style:italic;">ملاحظة: ${esc(o.note)}</div>` : ""}


      <div style="margin-top:12px;border:1px solid ${C.border};border-radius:6px;overflow:hidden;">
        <div style="background:${C.primary};color:#fff;padding:8px 12px;font-weight:700;font-size:12px;text-align:center;">أقساط السداد — ${o.installments.length} قسطاً</div>
        <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
          <thead>
            <tr style="background:${C.primarySoft};color:${C.primary};">
              <th style="padding:7px 8px;border:1px solid ${C.border};width:36px;">#</th>
              <th style="padding:7px 8px;border:1px solid ${C.border};text-align:center;">تاريخ الاستحقاق</th>
              <th style="padding:7px 8px;border:1px solid ${C.border};text-align:left;">المبلغ (${esc(o.currencyName)})</th>
              <th style="padding:7px 8px;border:1px solid ${C.border};text-align:center;">الحالة</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div style="margin-top:22px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;">
        <div style="width:45%;border-top:2px solid ${C.border};padding-top:6px;font-size:11px;color:${C.muted};text-align:center;">توقيع العميل</div>
        <div style="width:45%;border-top:2px solid ${C.border};padding-top:6px;font-size:11px;color:${C.muted};text-align:center;">توقيع / ختم المستلم</div>
      </div>

      <div style="margin-top:18px;border-top:1px solid ${C.border};padding-top:8px;display:flex;justify-content:space-between;color:${C.muted};font-size:10px;">
        <div>تم إنشاء هذا الجدول بواسطة دفترك  •  Daftarak</div>
        <div>${new Date().toLocaleString("ar-EG")}</div>
      </div>
    </div>`;
}

/** توليد وتنزيل جدول أقساط احترافي بالعربية. */
export async function exportPlanSchedulePDF(opts: PlanSchedulePdfOpts) {
  const company = await fetchCompany();
  const logo = company?.logo_path ? await logoDataUrl(company.logo_path) : null;
  await ensureArabicFontLoaded();

  const html = buildPlanHtml({ ...opts, company, logo });
  await renderHtmlToPdf(html, `plan-${opts.personName}-${Date.now()}.pdf`);
}

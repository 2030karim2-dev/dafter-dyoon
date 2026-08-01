import type { CompanyInfo, Currency, Tx } from "./format";
import { dmy, esc, fmt, fmtInt } from "./format";
import { C } from "./theme";

interface TemplateOpts {
  personName: string;
  phone?: string | null;
  company: CompanyInfo | null;
  logo: string | null;
  filteredTxs: Tx[];
  base?: Currency;
  totalCredit: number;
  totalDebit: number;
  sections: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

/** Full statement document markup, ready to mount offscreen for capture. */
export function buildStatementHtml(o: TemplateOpts): string {
  const { company, logo, personName, phone, filteredTxs, sections } = o;
  const baseSym = o.base?.symbol ?? "";
  const periodLabel = o.dateFrom || o.dateTo
    ? `الفترة: ${o.dateFrom ? dmy(o.dateFrom) : "—"} ← ${o.dateTo ? dmy(o.dateTo) : "—"}`
    : "";

  const contact = [
    company?.phone && `هاتف: ${esc(company.phone)}`,
    company?.email && esc(company.email),
    company?.tax_number && `الرقم الضريبي: ${esc(company.tax_number)}`,
  ].filter(Boolean).join("  •  ");

  return `
    <div id="__statement_root" dir="rtl" lang="ar" style="
      width: 794px; padding: 28px; background: #fff; color: ${C.text};
      font-family: 'Tajawal','Cairo','Noto Sans Arabic','IBM Plex Sans Arabic','Segoe UI',Arial,sans-serif;
      font-size: 12px; line-height: 1.55; -webkit-font-smoothing: antialiased;">

      <div style="background:${C.primary};color:#fff;padding:14px 16px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${logo ? `<img src="${logo}" style="width:48px;height:48px;border-radius:8px;background:#fff;object-fit:contain;padding:3px;" crossorigin="anonymous" />` : ""}
          <div>
            <div style="font-size:18px;font-weight:800;">${esc(company?.name) || "دفترك"}</div>
            <div style="font-size:10.5px;opacity:.9;margin-top:2px;">${contact}</div>
            ${company?.address ? `<div style="font-size:10.5px;opacity:.85;margin-top:2px;">${esc(company.address)}</div>` : ""}
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:16px;font-weight:800;">كشف حساب</div>
          <div style="font-size:10.5px;opacity:.9;">Statement of Account</div>
          <div style="font-size:10.5px;opacity:.9;margin-top:3px;">التاريخ: ${dmy(new Date())}</div>
        </div>
      </div>

      <div style="margin-top:12px;background:${C.primarySoft};border:1px solid ${C.primary};border-radius:6px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:10.5px;color:${C.muted};">العميل</div>
          <div style="font-size:14px;font-weight:800;">${esc(personName)}</div>
        </div>
        ${phone ? `<div style="text-align:left;">
          <div style="font-size:10.5px;color:${C.muted};">رقم الهاتف</div>
          <div style="font-size:13px;font-weight:700;direction:ltr;">${esc(phone)}</div>
        </div>` : ""}
      </div>

      ${periodLabel ? `<div style="margin-top:8px;font-size:10.5px;color:${C.muted};font-style:italic;">${periodLabel}</div>` : ""}

      <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        <div style="border:1px solid ${C.border};background:${C.accentSoft};border-radius:6px;padding:8px 10px;">
          <div style="font-size:10px;color:${C.muted};">إجمالي الدائن (${esc(baseSym)})</div>
          <div style="font-size:14px;font-weight:800;color:${C.accent};margin-top:2px;">${fmt(o.totalCredit)}</div>
        </div>
        <div style="border:1px solid ${C.border};background:${C.dangerSoft};border-radius:6px;padding:8px 10px;">
          <div style="font-size:10px;color:${C.muted};">إجمالي المدين (${esc(baseSym)})</div>
          <div style="font-size:14px;font-weight:800;color:${C.danger};margin-top:2px;">${fmt(o.totalDebit)}</div>
        </div>
        <div style="border:1px solid ${C.border};background:${C.primarySoft};border-radius:6px;padding:8px 10px;">
          <div style="font-size:10px;color:${C.muted};">عدد المعاملات</div>
          <div style="font-size:14px;font-weight:800;color:${C.primary};margin-top:2px;">${fmtInt(filteredTxs.length)}</div>
        </div>
      </div>

      ${sections || `<div style="margin-top:20px;padding:24px;text-align:center;color:${C.muted};border:1px dashed ${C.border};border-radius:6px;">لا توجد معاملات ضمن الفترة المحددة</div>`}

      ${company?.notes ? `
        <div style="margin-top:14px;padding:10px 12px;border:1px solid ${C.border};border-radius:6px;background:${C.bgAlt};">
          <div style="font-size:10.5px;color:${C.muted};font-weight:700;margin-bottom:4px;">ملاحظات</div>
          <div style="font-size:11px;white-space:pre-wrap;">${esc(company.notes)}</div>
        </div>` : ""}

      <div style="margin-top:18px;border-top:1px solid ${C.border};padding-top:8px;display:flex;justify-content:space-between;color:${C.muted};font-size:10px;">
        <div>تم إنشاء هذا الكشف بواسطة دفترك  •  Daftarak</div>
        <div>${new Date().toLocaleString("ar-EG")}</div>
      </div>
    </div>`;
}

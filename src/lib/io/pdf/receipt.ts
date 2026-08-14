import type { CompanyInfo } from "./format";
import { dmy, esc, fmt } from "./format";
import { C } from "./theme";
import { ensureArabicFontLoaded, fetchCompany, logoDataUrl } from "./company";
import { renderHtmlToPdf } from "./render";

export interface ReceiptPdfOpts {
  serialNumber: number;
  personName: string;
  phone?: string | null;
  currencyName: string;
  amount: number;
  amountWords: string;
  note?: string | null;
  issuedAt: string; // ISO
}

/** ترويسة سند القبض — HTML جاهز للالتقاط ثم التحويل إلى PDF عبر المسار الحالي. */
function buildReceiptHtml(
  o: ReceiptPdfOpts & { company: CompanyInfo | null; logo: string | null },
): string {
  const { company, logo } = o;
  const contact = [
    company?.phone && `هاتف: ${esc(company.phone)}`,
    company?.email && esc(company.email),
    company?.tax_number && `الرقم الضريبي: ${esc(company.tax_number)}`,
  ]
    .filter(Boolean)
    .join("  •  ");

  return `
    <div id="__receipt_root" dir="rtl" lang="ar" style="
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
          <div style="font-size:16px;font-weight:800;">سند قبض</div>
          <div style="font-size:10.5px;opacity:.9;">Receipt Voucher</div>
          <div style="font-size:11px;opacity:.95;margin-top:4px;font-weight:700;">رقم السند: ${String(o.serialNumber).padStart(5, "0")}</div>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:8px;align-items:stretch;">
        <div style="flex:1;background:${C.primarySoft};border:1px solid ${C.primary};border-radius:6px;padding:10px 12px;">
          <div style="font-size:10.5px;color:${C.muted};">العميل / المستلم</div>
          <div style="font-size:14px;font-weight:800;">${esc(o.personName)}</div>
        </div>
        ${
          o.phone
            ? `<div style="background:${C.primarySoft};border:1px solid ${C.primary};border-radius:6px;padding:10px 12px;">
          <div style="font-size:10.5px;color:${C.muted};">رقم الهاتف</div>
          <div style="font-size:13px;font-weight:700;direction:ltr;">${esc(o.phone)}</div>
        </div>`
            : ""
        }
      </div>

      <div style="margin-top:14px;border:2px solid ${C.primary};border-radius:8px;overflow:hidden;">
        <div style="background:${C.primary};color:#fff;padding:8px 12px;font-size:12px;font-weight:700;text-align:center;">إيصال استلام مبلغ</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tr>
            <td style="padding:10px 12px;border:1px solid ${C.border};width:170px;color:${C.muted};">المبلغ (رقماً)</td>
            <td style="padding:10px 12px;border:1px solid ${C.border};font-size:15px;font-weight:800;color:${C.accent};text-align:left;" dir="ltr">${fmt(o.amount)} ${esc(o.currencyName)}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid ${C.border};color:${C.muted};">المبلغ (كتابة)</td>
            <td style="padding:10px 12px;border:1px solid ${C.border};font-weight:700;">${esc(o.amountWords)}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid ${C.border};color:${C.muted};">تاريخ السند</td>
            <td style="padding:10px 12px;border:1px solid ${C.border};font-weight:700;">${dmy(o.issuedAt)}</td>
          </tr>
          ${
            o.note
              ? `<tr>
            <td style="padding:10px 12px;border:1px solid ${C.border};color:${C.muted};">البيان</td>
            <td style="padding:10px 12px;border:1px solid ${C.border};">${esc(o.note)}</td>
          </tr>`
              : ""
          }
        </table>
      </div>

      <div style="margin-top:26px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;">
        <div style="width:45%;border-top:2px solid ${C.border};padding-top:6px;font-size:11px;color:${C.muted};text-align:center;">توقيع العميل</div>
        <div style="width:45%;border-top:2px solid ${C.border};padding-top:6px;font-size:11px;color:${C.muted};text-align:center;">توقيع / ختم المستلم</div>
      </div>

      <div style="margin-top:18px;border-top:1px solid ${C.border};padding-top:8px;display:flex;justify-content:space-between;color:${C.muted};font-size:10px;">
        <div>تم إنشاء هذا السند بواسطة دفترك  •  Daftarak</div>
        <div>${new Date().toLocaleString("ar-EG")}</div>
      </div>
    </div>`;
}

/** توليد وتنزيل سند قبض احترافي بالعربية. */
export async function exportReceiptPDF(opts: ReceiptPdfOpts) {
  const company = await fetchCompany();
  const logo = company?.logo_path ? await logoDataUrl(company.logo_path) : null;
  await ensureArabicFontLoaded();

  const html = buildReceiptHtml({ ...opts, company, logo });
  await renderHtmlToPdf(html, `receipt-${opts.serialNumber}-${Date.now()}.pdf`);
}

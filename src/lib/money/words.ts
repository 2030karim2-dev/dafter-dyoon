/**
 * تحويل الأرقام إلى كتابة عربية (تفقيط) — تُستخدم في سندات القبض.
 * يدعم الأعداد حتى المليارات مع الجزء العشري (أجزاء من مئة).
 * دالة نقية تعمل على الخادم والمتصفح معاً.
 */

const ONES = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];

const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];

const HUNDREDS = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

interface Scale {
  value: number;
  singular: string;
  dual: string;
  plural: string;
  acc: string; // المفرد المنصوب (التمييز): "ألفاً"
}

const SCALES: Scale[] = [
  { value: 1_000_000_000, singular: "مليار", dual: "ملياران", plural: "مليارات", acc: "ملياراً" },
  { value: 1_000_000, singular: "مليون", dual: "مليونان", plural: "ملايين", acc: "مليوناً" },
  { value: 1_000, singular: "ألف", dual: "ألفان", plural: "آلاف", acc: "ألفاً" },
];

/** صيغة اسم المقياس حسب قيمة المجموعة (توافق نحوي للتمييز). */
function scaleKind(g: number): "single" | "dual" | "plural" | "acc" {
  if (g === 1) return "single";
  if (g === 2) return "dual";
  if (g <= 10) return "plural"; // 3-10: جمع مجرور (خمسة آلاف)
  if (g < 100) return "acc"; // 11-99: مفرد منصوب (اثنا عشر ألفاً)
  // 100 فأكثر: القرار وفق آخر رقمين (المعطوف)
  const last2 = g % 100;
  if (last2 >= 3 && last2 <= 10) return "plural"; // مائة وثلاثة آلاف
  if (last2 >= 11 && last2 <= 99) return "acc"; // مائة وأحد عشر ألفاً
  return "single"; // مائة ألف / مائتا ألف
}

/** الأعداد من 1 إلى 999 كلمات (بدون فاصلة واصلة إضافية). */
function three(n: number, idafa = false): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h > 0) {
    // 200 في الإضافة: "مائتا ألف" (بدون نون) بدل "مائتان ألف"
    parts.push(h === 2 && rest === 0 && idafa ? "مائتا" : HUNDREDS[h]!);
  }
  if (rest > 0) {
    if (rest < 20) parts.push(ONES[rest]!);
    else {
      const t = Math.floor(rest / 10);
      const o = rest % 10;
      parts.push(o > 0 ? `${ONES[o]} و${TENS[t]}` : TENS[t]!);
    }
  }
  return parts.join(" و");
}

/** العدد الصحيح كتابةً (يدعم حتى المليارات). */
export function numberToArabicWords(n: number): string {
  if (!Number.isFinite(n)) return "";
  const neg = n < 0;
  let value = Math.floor(Math.abs(n));
  if (value === 0) return neg ? "سالب صفر" : "صفر";

  const groups: string[] = [];
  for (const s of SCALES) {
    if (value >= s.value) {
      const g = Math.floor(value / s.value);
      value %= s.value;
      if (g === 1) groups.push(s.singular);
      else if (g === 2) groups.push(s.dual);
      else {
        const kind = scaleKind(g);
        const noun = kind === "plural" ? s.plural : kind === "acc" ? s.acc : s.singular;
        groups.push(`${three(g, true)} ${noun}`);
      }
    }
  }
  if (value > 0) groups.push(three(value));

  const out = groups.join(" و");
  return neg ? `سالب ${out}` : out;
}

/**
 * الصيغة المعتمدة في سند القبض:
 * "فقط … لا غير" مع ذكر العملة والجزء العشري عند الحاجة.
 */
export function amountToArabicWords(amount: number, currency?: string): string {
  const abs = Math.abs(amount);
  let intPart = Math.floor(abs);
  let fracPart = Math.round((abs - intPart) * 100);
  // تنظيم التقريب: مبلغ كـ 0.999 قد يرفع الجزء العشري إلى 100
  if (fracPart >= 100) {
    intPart += 1;
    fracPart -= 100;
  }
  let out = numberToArabicWords(intPart);
  if (currency) out += ` ${currency}`;
  if (fracPart > 0) out += ` و${numberToArabicWords(fracPart)} جزءاً من مئة`;
  return `فقط ${out} لا غير`;
}

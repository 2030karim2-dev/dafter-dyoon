/** Visual theme + number/date formatting for professional Arabic statements. */

export const COL_HEAD_BG = "FF0B3D91"; // Deep professional blue
export const COL_HEAD_TXT = "FFFFFFFF";
export const COL_SUBHEAD_BG = "FF1E40AF";
export const COL_SECTION_BG = "FFE0E7FF";
export const COL_INFO_BG = "FFF1F5F9";
export const COL_ZEBRA = "FFF8FAFC";
export const COL_TOTAL_BG = "FFFEF3C7";
export const COL_CREDIT = "FF047857";
export const COL_DEBIT = "FFB91C1C";
export const COL_OPENING_BG = "FFFFF7ED";
export const COL_OPENING_TXT = "FF9A3412";
export const COL_TEXT = "FF111827";
export const COL_LABEL = "FF1F2937";
export const COL_MUTED = "FF6B7280";
export const COL_BORDER = "FF94A3B8";
export const COL_BORDER_STRONG = "FF0B3D91";

export const FONT = "Arial";

export const thinBorder = {
  top: { style: "thin" as const, color: { argb: COL_BORDER } },
  left: { style: "thin" as const, color: { argb: COL_BORDER } },
  bottom: { style: "thin" as const, color: { argb: COL_BORDER } },
  right: { style: "thin" as const, color: { argb: COL_BORDER } },
};

/** English digits, thousands separator, 2 decimals, red negatives, dash for zero. */
export const NUM_FMT = '#,##0.00;[Red]-#,##0.00;"-"';

export const solid = (argb: string) =>
  ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

export const rtl = (horizontal: "right" | "center" | "left" = "right", wrapText = false) =>
  ({ horizontal, vertical: "middle" as const, readingOrder: "rtl" as const, wrapText });

/** dd/MM/yyyy using Latin digits. */
export const fmtDateEN = (d: string | Date) => new Date(d).toLocaleDateString("en-GB");

export const fmtNumEN = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

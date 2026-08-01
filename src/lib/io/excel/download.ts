import { XLSX_MIME } from "./types";

/** Trigger a browser download for a generated workbook. */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadWorkbook(buf: ArrayBuffer | Uint8Array, name: string) {
  downloadBlob(new Blob([buf as BlobPart], { type: XLSX_MIME }), name);
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Strip characters that are illegal in file names. */
export const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_");

export const todayISO = () => new Date().toISOString().slice(0, 10);

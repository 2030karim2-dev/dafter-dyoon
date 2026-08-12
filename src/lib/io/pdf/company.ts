import { supabase } from "@/integrations/supabase/client";
import type { CompanyInfo } from "./format";

export async function fetchCompany(): Promise<CompanyInfo | null> {
  const { data } = await supabase.from("company_profile").select("*").maybeSingle();
  return data ?? null;
}

/** Resolve a stored logo path into an inlineable data URL. */
export async function logoDataUrl(path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 600);
    if (!data?.signedUrl) return null;
    const blob = await (await fetch(data.signedUrl)).blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Ensure the Arabic web font is fully loaded before capturing. */
export async function ensureArabicFontLoaded() {
  try {
    const f: FontFaceSet | undefined = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!f) return;
    await Promise.all([
      f.load('700 16px "Tajawal"'),
      f.load('500 14px "Tajawal"'),
      f.load('400 12px "Tajawal"'),
    ]);
    await f.ready;
  } catch {
    /* ignore */
  }
}

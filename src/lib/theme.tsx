import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
export type AccentId = "blue" | "green" | "violet" | "rose" | "amber";
export type FontSizeId = "sm" | "md" | "lg";

/**
 * Full accent palettes — every accent variable (primary, glow, ring and both
 * gradients) for light & dark modes, so picking an accent re-skins the whole
 * app consistently instead of only swapping --primary.
 */
interface AccentVars {
  primary: string;
  glow: string;
  heroFrom: string;
  heroTo: string;
  gradFrom: string;
  gradTo: string;
}
export const ACCENTS: Record<
  AccentId,
  { name: string; swatch: string; light: AccentVars; dark: AccentVars }
> = {
  blue: {
    name: "أزرق",
    swatch: "oklch(0.55 0.18 245)",
    light: {
      primary: "oklch(0.45 0.22 255)",
      glow: "oklch(0.55 0.22 255 / 0.55)",
      heroFrom: "oklch(0.4 0.22 255)",
      heroTo: "oklch(0.5 0.18 200)",
      gradFrom: "oklch(0.45 0.22 255)",
      gradTo: "oklch(0.5 0.2 235)",
    },
    dark: {
      primary: "oklch(0.72 0.2 255)",
      glow: "oklch(0.72 0.2 255 / 0.55)",
      heroFrom: "oklch(0.4 0.22 255)",
      heroTo: "oklch(0.5 0.18 200)",
      gradFrom: "oklch(0.45 0.22 255)",
      gradTo: "oklch(0.5 0.2 235)",
    },
  },
  green: {
    name: "أخضر",
    swatch: "oklch(0.6 0.17 165)",
    light: {
      primary: "oklch(0.5 0.17 165)",
      glow: "oklch(0.58 0.17 165 / 0.55)",
      heroFrom: "oklch(0.42 0.17 165)",
      heroTo: "oklch(0.52 0.15 185)",
      gradFrom: "oklch(0.5 0.17 165)",
      gradTo: "oklch(0.55 0.16 150)",
    },
    dark: {
      primary: "oklch(0.72 0.17 165)",
      glow: "oklch(0.72 0.17 165 / 0.55)",
      heroFrom: "oklch(0.42 0.17 165)",
      heroTo: "oklch(0.52 0.15 185)",
      gradFrom: "oklch(0.5 0.17 165)",
      gradTo: "oklch(0.55 0.16 150)",
    },
  },
  violet: {
    name: "بنفسجي",
    swatch: "oklch(0.55 0.2 295)",
    light: {
      primary: "oklch(0.5 0.2 295)",
      glow: "oklch(0.58 0.2 295 / 0.55)",
      heroFrom: "oklch(0.42 0.2 295)",
      heroTo: "oklch(0.52 0.17 270)",
      gradFrom: "oklch(0.5 0.2 295)",
      gradTo: "oklch(0.55 0.19 280)",
    },
    dark: {
      primary: "oklch(0.74 0.17 295)",
      glow: "oklch(0.74 0.17 295 / 0.55)",
      heroFrom: "oklch(0.42 0.2 295)",
      heroTo: "oklch(0.52 0.17 270)",
      gradFrom: "oklch(0.5 0.2 295)",
      gradTo: "oklch(0.55 0.19 280)",
    },
  },
  rose: {
    name: "وردي",
    swatch: "oklch(0.6 0.2 15)",
    light: {
      primary: "oklch(0.55 0.2 15)",
      glow: "oklch(0.62 0.2 15 / 0.55)",
      heroFrom: "oklch(0.45 0.2 15)",
      heroTo: "oklch(0.55 0.18 350)",
      gradFrom: "oklch(0.55 0.2 15)",
      gradTo: "oklch(0.6 0.19 0)",
    },
    dark: {
      primary: "oklch(0.72 0.18 15)",
      glow: "oklch(0.72 0.18 15 / 0.55)",
      heroFrom: "oklch(0.45 0.2 15)",
      heroTo: "oklch(0.55 0.18 350)",
      gradFrom: "oklch(0.55 0.2 15)",
      gradTo: "oklch(0.6 0.19 0)",
    },
  },
  amber: {
    name: "كهرماني",
    swatch: "oklch(0.7 0.16 75)",
    light: {
      primary: "oklch(0.6 0.16 75)",
      glow: "oklch(0.68 0.16 75 / 0.55)",
      heroFrom: "oklch(0.5 0.16 75)",
      heroTo: "oklch(0.6 0.14 50)",
      gradFrom: "oklch(0.6 0.16 75)",
      gradTo: "oklch(0.65 0.15 60)",
    },
    dark: {
      primary: "oklch(0.78 0.15 75)",
      glow: "oklch(0.78 0.15 75 / 0.55)",
      heroFrom: "oklch(0.5 0.16 75)",
      heroTo: "oklch(0.6 0.14 50)",
      gradFrom: "oklch(0.6 0.16 75)",
      gradTo: "oklch(0.65 0.15 60)",
    },
  },
};

/**
 * Font sizes are RELATIVE to the app's compact 12.5px base — never to the
 * browser default of 16px. `md` = null means "let the stylesheet decide"
 * (12.5px mobile / 14px desktop).
 */
export const FONT_SIZES: Record<FontSizeId, { label: string; px: number | null }> = {
  sm: { label: "صغير", px: 12 },
  md: { label: "عادي", px: null },
  lg: { label: "كبير", px: 14 },
};

const Ctx = createContext<
  | {
      theme: Theme;
      toggle: () => void;
      set: (t: Theme) => void;
      accent: AccentId;
      setAccent: (a: AccentId) => void;
      fontSize: FontSizeId;
      setFontSize: (s: FontSizeId) => void;
    }
  | undefined
>(undefined);

export function resolveIsDark(t: Theme): boolean {
  if (typeof window === "undefined") return false;
  return (
    t === "dark" || (t === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches)
  );
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const isDark = resolveIsDark(t);
  document.documentElement.classList.toggle("dark", isDark);
  // Keep the browser chrome (address bar) in sync with the active theme.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", isDark ? "#151d2e" : "#1e40af");
}

function applyAccent(id: AccentId, isDark: boolean) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (id === "blue") {
    // Default: fall back to the stylesheet values (already mode-aware).
    ["--primary", "--primary-glow", "--ring", "--gradient-hero", "--gradient-primary"].forEach(
      (p) => el.style.removeProperty(p),
    );
    return;
  }
  const v = ACCENTS[id][isDark ? "dark" : "light"];
  el.style.setProperty("--primary", v.primary);
  el.style.setProperty("--primary-glow", v.glow);
  el.style.setProperty("--ring", v.primary);
  el.style.setProperty("--gradient-hero", `linear-gradient(135deg, ${v.heroFrom}, ${v.heroTo})`);
  el.style.setProperty("--gradient-primary", `linear-gradient(135deg, ${v.gradFrom}, ${v.gradTo})`);
}

function applyFontSize(id: FontSizeId) {
  if (typeof document === "undefined") return;
  const px = FONT_SIZES[id].px;
  if (px === null) document.documentElement.style.removeProperty("font-size");
  else document.documentElement.style.fontSize = `${px}px`;
}

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    readStored("theme", ["light", "dark", "system"] as const, "system"),
  );
  const [accent, setAccent] = useState<AccentId>(() =>
    readStored("daftarak.accent", ["blue", "green", "violet", "rose", "amber"] as const, "blue"),
  );
  const [fontSize, setFontSize] = useState<FontSizeId>(() =>
    readStored("daftarak.fontsize", ["sm", "md", "lg"] as const, "md"),
  );

  // Single effect applies theme + accent + font size globally on every page,
  // persists them, and re-applies accent vars when the OS dark mode flips.
  useEffect(() => {
    const isDark = resolveIsDark(theme);
    applyTheme(theme);
    applyAccent(accent, isDark);
    applyFontSize(fontSize);
    try {
      localStorage.setItem("theme", theme);
      localStorage.setItem("daftarak.accent", accent);
      localStorage.setItem("daftarak.fontsize", fontSize);
    } catch {
      /* ignore */
    }
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyTheme("system");
      applyAccent(accent, resolveIsDark("system"));
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme, accent, fontSize]);

  return (
    <Ctx.Provider
      value={{
        theme,
        toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
        set: setTheme,
        accent,
        setAccent,
        fontSize,
        setFontSize,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be inside ThemeProvider");
  return c;
}

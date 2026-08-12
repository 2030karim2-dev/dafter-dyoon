import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";
import { PinLockGate } from "@/components/PinLockGate";
import { OnboardingGate } from "@/components/OnboardingGate";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">الرابط الذي تبحث عنه غير متوفر.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1e40af" },
      { title: "دفترك - متابعة الديون والعملاء باحتراف" },
      {
        name: "description",
        content:
          "دفترك: منصة احترافية لإدارة الديون ومتابعة العملاء والتذكير بالاستحقاقات، كشوف حسابات، تذكيرات ذكية، ومزامنة سحابية آمنة.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "دفترك - متابعة الديون والعملاء باحتراف" },
      {
        property: "og:description",
        content:
          "دفترك: منصة احترافية لإدارة الديون ومتابعة العملاء والتذكير بالاستحقاقات، كشوف حسابات، تذكيرات ذكية، ومزامنة سحابية آمنة.",
      },
      { property: "og:locale", content: "ar_SA" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "دفترك - متابعة الديون والعملاء باحتراف" },
      {
        name: "twitter:description",
        content:
          "دفترك: منصة احترافية لإدارة الديون ومتابعة العملاء والتذكير بالاستحقاقات، كشوف حسابات، تذكيرات ذكية، ومزامنة سحابية آمنة.",
      },
      { property: "og:image", content: "/og-cover.png" },
      { name: "twitter:image", content: "/og-cover.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/icon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/icon-180.png" },
      // Tajawal is self-hosted via @fontsource (see styles.css) — no Google Fonts request.
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

/**
 * Runs BEFORE first paint to eliminate theme/accent/font FOUC: reads the
 * persisted appearance prefs and applies the dark class, font size and
 * primary color inline. ThemeProvider re-applies the full variable set right
 * after hydration using the same localStorage keys.
 */
const BOOT_SCRIPT = `(function(){try{
var d=document.documentElement;
var t=localStorage.getItem("theme")||"system";
var dark=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
d.classList.toggle("dark",dark);
var fs=localStorage.getItem("daftarak.fontsize");
if(fs==="sm")d.style.fontSize="12px";else if(fs==="lg")d.style.fontSize="14px";
var a=localStorage.getItem("daftarak.accent")||"blue";
var P={green:["oklch(0.5 0.17 165)","oklch(0.72 0.17 165)"],violet:["oklch(0.5 0.2 295)","oklch(0.74 0.17 295)"],rose:["oklch(0.55 0.2 15)","oklch(0.72 0.18 15)"],amber:["oklch(0.6 0.16 75)","oklch(0.78 0.15 75)"]};
var v=P[a];
if(v){var p=v[dark?1:0];d.style.setProperty("--primary",p);d.style.setProperty("--ring",p);}
}catch(e){}})();`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <PinLockGate>
            <OnboardingGate>
              <Outlet />
            </OnboardingGate>
          </PinLockGate>
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

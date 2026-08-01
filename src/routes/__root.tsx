import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
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
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
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
      { name: "description", content: "دفترك: منصة احترافية لإدارة الديون ومتابعة العملاء والتذكير بالاستحقاقات، كشوف حسابات، تذكيرات ذكية، ومزامنة سحابية آمنة." },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "دفترك - متابعة الديون والعملاء باحتراف" },
      { property: "og:description", content: "دفترك: منصة احترافية لإدارة الديون ومتابعة العملاء والتذكير بالاستحقاقات، كشوف حسابات، تذكيرات ذكية، ومزامنة سحابية آمنة." },
      { property: "og:locale", content: "ar_SA" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "دفترك - متابعة الديون والعملاء باحتراف" },
      { name: "twitter:description", content: "دفترك: منصة احترافية لإدارة الديون ومتابعة العملاء والتذكير بالاستحقاقات، كشوف حسابات، تذكيرات ذكية، ومزامنة سحابية آمنة." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e6a05cd6-61bb-41b3-9c54-da8e73c303ce/id-preview-7bcd9df1--00e31430-83e2-407e-a84e-1f113e43ee71.lovable.app-1782682571190.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e6a05cd6-61bb-41b3-9c54-da8e73c303ce/id-preview-7bcd9df1--00e31430-83e2-407e-a84e-1f113e43ee71.lovable.app-1782682571190.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/icon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head><HeadContent /></head>
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

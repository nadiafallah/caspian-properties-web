import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, Vazirmatn } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { routing } from "@/i18n/routing";
import { localeMeta } from "@/i18n/locales";
import { resolveLocale } from "@/i18n/server";
import { allowIndexing, brandName, siteUrl } from "@/config/site";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AttributionCapture } from "@/components/AttributionCapture";
import "../globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Only downloaded on Persian/Arabic pages (the browser fetches fonts it actually uses).
const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Unknown locale segments fall through to app/global-not-found.tsx.
export const dynamicParams = false;

export const viewport: Viewport = {
  themeColor: "#383838",
  colorScheme: "light",
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    metadataBase: new URL(siteUrl),
    title: { template: `%s · ${brandName}`, default: t("siteName") },
    applicationName: brandName,
    formatDetection: { telephone: false, email: false, address: false },
    robots: allowIndexing ? undefined : { index: false, follow: false },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    <html
      lang={locale}
      dir={localeMeta[locale].dir}
      className={`${cormorant.variable} ${inter.variable} ${vazirmatn.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        {/* Locale only: client navigation needs it; UI text is rendered on the server. */}
        <NextIntlClientProvider locale={locale} messages={{}}>
          <a
            href="#main"
            className="btn btn-primary fixed start-4 top-3 z-50 -translate-y-24 focus-visible:translate-y-0"
          >
            {t("skipToContent")}
          </a>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
        <AttributionCapture />
        {process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true" ? <Analytics /> : null}
      </body>
    </html>
  );
}

import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ChatAssistant } from "@/components/chat/ChatAssistant";

/** Public website chrome: header, footer and the Caspian assistant. */
export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    <>
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
      <ChatAssistant locale={locale} />
    </>
  );
}

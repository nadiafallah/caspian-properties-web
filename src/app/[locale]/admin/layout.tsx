import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";

export async function generateMetadata({ params }: LayoutProps<"/[locale]/admin">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Admin" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** Private client panel. Never cached, never indexed (see also src/proxy.ts). */
export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  return <div className="flex min-h-dvh flex-1 flex-col bg-ivory">{children}</div>;
}

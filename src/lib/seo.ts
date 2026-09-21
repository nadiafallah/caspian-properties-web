import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { localeMeta, locales, type AppLocale } from "@/i18n/locales";
import { allowIndexing, brandName, siteUrl } from "@/config/site";

export type PageKey =
  | "home"
  | "about"
  | "approach"
  | "journey"
  | "contact"
  | "consultation"
  | "thankYou"
  | "opportunities"
  | "insights"
  | "privacy"
  | "terms";

export function absoluteUrl(locale: AppLocale, path: string): string {
  const pathname = getPathname({ locale, href: path });
  return `${siteUrl}${pathname === "/" ? "" : pathname}` || siteUrl;
}

/** Localised title/description, canonical URL and hreflang alternates (en/fa/ar + x-default → English). */
export async function pageMetadata({
  locale,
  page,
  path,
  noindex = false,
}: {
  locale: AppLocale;
  page: PageKey;
  path: string;
  noindex?: boolean;
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const title = t(`${page}.title`);
  const description = t(`${page}.description`);
  const url = absoluteUrl(locale, path);

  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = absoluteUrl(l, path);
  languages["x-default"] = absoluteUrl("en", path);

  return {
    title: page === "home" ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      type: "website",
      siteName: brandName,
      title,
      description,
      url,
      locale: localeMeta[locale].ogLocale,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => localeMeta[l].ogLocale),
    },
    twitter: { card: "summary_large_image", title, description },
    // Preview deployments (and temporary addresses) must never be indexed.
    robots: !allowIndexing || noindex ? { index: false, follow: !noindex } : undefined,
  };
}

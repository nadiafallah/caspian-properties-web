import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { publishedInsights } from "@/content";
import { ButtonLink, PageIntro, Section } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/[locale]/insights">) {
  const locale = await resolveLocale(params);
  return pageMetadata({ locale, page: "insights", path: "/insights", noindex: publishedInsights.length === 0 });
}

export default async function InsightsPage({ params }: PageProps<"/[locale]/insights">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Insights");
  const tCommon = await getTranslations("Common");

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <Section labelledBy="insights-status">
        {publishedInsights.length === 0 ? (
          <div className="max-w-2xl rounded-card border border-stone bg-ivory p-8">
            <h2 id="insights-status" className="type-h3">
              {t("emptyTitle")}
            </h2>
            <p className="mt-3 text-charcoal">{t("emptyBody")}</p>
            <ButtonLink href="/consultation" className="mt-6">
              {tCommon("bookConsultation")}
            </ButtonLink>
          </div>
        ) : (
          <>
            <h2 id="insights-status" className="sr-only">
              {t("title")}
            </h2>
            <ul className="grid gap-6 md:grid-cols-2">
              {publishedInsights.map((item) => (
                <li key={item.slug} className="rounded-card border border-stone p-6">
                  <h3 className="type-h3">{item.title[locale]}</h3>
                  <p className="mt-2 text-muted">{item.summary[locale]}</p>
                  <p className="type-caption mt-4 text-muted">
                    {tCommon("lastUpdated", { date: formatDate(locale, item.lastUpdated) })}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </>
  );
}

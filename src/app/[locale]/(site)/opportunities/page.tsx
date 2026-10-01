import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { publishedOpportunities } from "@/content";
import { ButtonLink, PageIntro, Section } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/[locale]/opportunities">) {
  const locale = await resolveLocale(params);
  // Not indexed and not linked from navigation until verified content exists.
  return pageMetadata({ locale, page: "opportunities", path: "/opportunities", noindex: publishedOpportunities.length === 0 });
}

export default async function OpportunitiesPage({ params }: PageProps<"/[locale]/opportunities">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Opportunities");
  const tCommon = await getTranslations("Common");

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <Section labelledBy="opportunities-status">
        {publishedOpportunities.length === 0 ? (
          <div className="max-w-2xl rounded-card border border-stone bg-ivory p-8">
            <h2 id="opportunities-status" className="type-h3">
              {t("emptyTitle")}
            </h2>
            <p className="mt-3 text-charcoal">{t("emptyBody")}</p>
            <ButtonLink href="/consultation" className="mt-6">
              {tCommon("bookConsultation")}
            </ButtonLink>
          </div>
        ) : (
          <>
            <h2 id="opportunities-status" className="sr-only">
              {t("title")}
            </h2>
            <ul className="grid gap-6 md:grid-cols-2">
              {publishedOpportunities.map((item) => (
                <li key={item.slug} className="rounded-card border border-stone p-6">
                  <h3 className="type-h3">{item.title[locale]}</h3>
                  <p className="mt-2 text-muted">{item.thesis[locale]}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </>
  );
}

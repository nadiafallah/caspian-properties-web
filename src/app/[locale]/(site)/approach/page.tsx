import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbGraph } from "@/lib/structured-data";
import { PageIntro, Section } from "@/components/ui";
import { MethodSteps } from "@/components/home/AdvisoryMethod";
import { ConsultationInvite } from "@/components/home/ConsultationInvite";

const evidence = ["source", "date", "type", "scope", "assumptions"] as const;
const principles = ["guarantees", "urgency", "exclusive", "publish", "pressure"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/approach">) {
  const locale = await resolveLocale(params);
  return pageMetadata({ locale, page: "approach", path: "/approach" });
}

export default async function ApproachPage({ params }: PageProps<"/[locale]/approach">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Approach");
  const tMeta = await getTranslations("Metadata");

  return (
    <>
      <JsonLd data={breadcrumbGraph(locale, tMeta("siteName"), tMeta("approach.title"), "/approach")} />
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

      <section aria-label={tMeta("approach.title")} className="bg-white py-16 md:py-24">
        <div className="mx-auto w-full max-w-content px-5 md:px-6">
          <MethodSteps detailed headingLevel={2} />
        </div>
      </section>

      <Section surface="ivory" labelledBy="evidence-title">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="evidence-title" className="type-h2">
              {t("evidenceTitle")}
            </h2>
            <p className="mt-5 max-w-measure text-charcoal">{t("evidenceLead")}</p>
          </div>
          <ol className="grid gap-px self-start overflow-hidden rounded-card border border-stone bg-stone lg:col-span-6 lg:col-start-7">
            {evidence.map((item) => (
              <li key={item} className="flex items-start gap-4 bg-white px-6 py-4">
                <span aria-hidden="true" className="mt-[0.8em] h-px w-4 shrink-0 bg-bronze" />
                <span className="text-ink">{t(`evidence.${item}`)}</span>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section labelledBy="principles-title">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="principles-title" className="type-h2">
              {t("principlesTitle")}
            </h2>
          </div>
          <ul className="divide-y divide-stone border-y border-stone lg:col-span-6 lg:col-start-7">
            {principles.map((item) => (
              <li key={item} className="flex gap-4 py-4 text-charcoal">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-1 h-4 w-4 shrink-0 text-bronze-deep" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
                </svg>
                <span>{t(`principles.${item}`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <hr className="horizon mt-16 w-24" />
        <p className="type-h2 mt-8 max-w-3xl !text-[1.75rem] !leading-snug md:!text-[2rem]">{t("quote")}</p>
      </Section>

      <ConsultationInvite />
    </>
  );
}

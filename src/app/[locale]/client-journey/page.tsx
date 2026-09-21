import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbGraph } from "@/lib/structured-data";
import { PageIntro, Section } from "@/components/ui";
import { JourneyStages } from "@/components/home/JourneyStages";
import { ConsultationInvite } from "@/components/home/ConsultationInvite";

const faq = ["pitch", "abroad", "languages", "documents", "otherAdvice", "publication"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/client-journey">) {
  const locale = await resolveLocale(params);
  return pageMetadata({ locale, page: "journey", path: "/client-journey" });
}

export default async function ClientJourneyPage({ params }: PageProps<"/[locale]/client-journey">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("JourneyPage");
  const tMeta = await getTranslations("Metadata");

  return (
    <>
      <JsonLd data={breadcrumbGraph(locale, tMeta("siteName"), tMeta("journey.title"), "/client-journey")} />
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

      <section aria-label={tMeta("journey.title")} className="bg-white py-16 md:py-24">
        <div className="mx-auto w-full max-w-content px-5 md:px-6">
          <JourneyStages detailed />
          <p className="type-small mt-12 max-w-measure text-muted">{t("note")}</p>
        </div>
      </section>

      <Section surface="ivory" labelledBy="privacy-title">
        <div className="max-w-3xl">
          <h2 id="privacy-title" className="type-h2">
            {t("privacyTitle")}
          </h2>
          <p className="type-lead mt-5 text-charcoal">{t("privacyBody")}</p>
        </div>
      </Section>

      <Section labelledBy="faq-title">
        <h2 id="faq-title" className="type-h2">
          {t("faqTitle")}
        </h2>
        <div className="mt-10 max-w-3xl divide-y divide-stone border-y border-stone">
          {faq.map((item) => (
            <details key={item} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-lg font-semibold text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                <h3>{t(`faq.${item}.q`)}</h3>
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-bronze-deep transition-transform group-open:rotate-45" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                </svg>
              </summary>
              <p className="max-w-measure pb-6 text-charcoal">{t(`faq.${item}.a`)}</p>
            </details>
          ))}
        </div>
      </Section>

      <ConsultationInvite />
    </>
  );
}

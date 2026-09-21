import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { advisor, company } from "@/config/company";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbGraph, organizationGraph } from "@/lib/structured-data";
import { PageIntro, Section } from "@/components/ui";
import { ContentNeeded, ImagePlaceholder } from "@/components/placeholders";
import { CredentialsBlock } from "@/components/credentials/CredentialsBlock";
import { ConsultationInvite } from "@/components/home/ConsultationInvite";

const values = ["integrity", "mastery", "access", "family", "discretion"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/about">) {
  const locale = await resolveLocale(params);
  return pageMetadata({ locale, page: "about", path: "/about" });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("About");
  const tCommon = await getTranslations("Common");
  const tMeta = await getTranslations("Metadata");

  const facts = [
    { label: t("facts.legalName"), value: company.legalNameEn.value, ltr: true },
    { label: t("facts.licence"), value: company.licenceNumber.value, ltr: true },
    { label: t("facts.established"), value: formatDate(locale, company.establishedOn.value), ltr: false },
    { label: t("facts.activities"), value: t("facts.activitiesValue"), ltr: false },
    { label: t("facts.orn"), value: company.orn.value, ltr: true },
  ];

  return (
    <>
      <JsonLd data={organizationGraph()} />
      <JsonLd data={breadcrumbGraph(locale, tMeta("siteName"), tMeta("about.title"), "/about")} />
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

      <Section labelledBy="nadia-title">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <ImagePlaceholder label={tCommon("placeholderPortrait")} className="nadia-frame aspect-[4/5] w-full max-w-80" />
          </div>
          <div className="md:col-span-7 md:col-start-6">
            <h2 id="nadia-title" className="type-h2">
              {advisor.displayName.value}
            </h2>
            <p className="proof-label mt-3 text-bronze-deep">{t("nadiaRole")}</p>
            <div className="mt-6 max-w-measure space-y-5 text-charcoal">
              <p className="type-lead">{t("nadiaP1")}</p>
              <p>{t("nadiaP2")}</p>
            </div>
            <div className="mt-8 max-w-measure">
              <ContentNeeded label={tCommon("contentNeeded")} what={t("bioNeeded")} />
            </div>
          </div>
        </div>
      </Section>

      <Section surface="ivory" labelledBy="values-title">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="proof-label text-bronze-deep">{t("missionTitle")}</p>
            <p className="type-h2 mt-4 !text-[1.625rem] !leading-snug md:!text-[1.875rem]">{t("mission")}</p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <h2 id="values-title" className="type-h3">
              {t("valuesTitle")}
            </h2>
            <dl className="mt-6 divide-y divide-stone border-y border-stone">
              {values.map((value) => (
                <div key={value} className="py-5">
                  <dt className="font-semibold text-ink">{t(`values.${value}.title`)}</dt>
                  <dd className="mt-1 text-muted">{t(`values.${value}.body`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section labelledBy="caspian-title">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="proof-label text-bronze-deep">{tCommon("since2007")}</p>
            <h2 id="caspian-title" className="type-h2 mt-4" dir="ltr">
              {t("caspianTitle")}
            </h2>
            <p className="mt-6 max-w-measure text-charcoal">{t("caspianBody")}</p>
          </div>
          <dl className="self-start rounded-card border border-stone lg:col-span-5 lg:col-start-8">
            {facts.map((fact) => (
              <div key={fact.label} className="border-b border-stone px-6 py-4 last:border-b-0">
                <dt className="type-small text-muted">{fact.label}</dt>
                <dd className="mt-1 font-medium text-ink" dir={fact.ltr ? "ltr" : undefined}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <CredentialsBlock />
      <ConsultationInvite />
    </>
  );
}

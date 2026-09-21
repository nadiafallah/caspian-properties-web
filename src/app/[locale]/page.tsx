import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { JsonLd, organizationGraph } from "@/lib/structured-data";
import { ArrowLink, Section, SectionHeading } from "@/components/ui";
import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { NadiaIntro } from "@/components/home/NadiaIntro";
import { MethodSteps } from "@/components/home/AdvisoryMethod";
import { Services } from "@/components/home/Services";
import { CaspianLegacy } from "@/components/home/CaspianLegacy";
import { DecisionLenses } from "@/components/home/DecisionLenses";
import { JourneyStages } from "@/components/home/JourneyStages";
import { ConsultationInvite } from "@/components/home/ConsultationInvite";

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  return pageMetadata({ locale, page: "home", path: "/" });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  await resolveLocale(params);
  const tMethod = await getTranslations("Home.method");
  const tJourney = await getTranslations("Home.journey");

  return (
    <>
      <JsonLd data={organizationGraph()} />
      <Hero />
      <TrustStrip />
      <NadiaIntro />

      <Section surface="ivory" labelledBy="method-title">
        <SectionHeading id="method-title" eyebrow={tMethod("eyebrow")} title={tMethod("title")} lead={tMethod("lead")} />
        <div className="mt-12">
          <MethodSteps />
        </div>
        <ArrowLink href="/approach" className="mt-8">
          {tMethod("link")}
        </ArrowLink>
      </Section>

      <Services />
      <CaspianLegacy />
      <DecisionLenses />

      {/* Curated opportunities and market insights appear here once verified content exists. */}

      <Section surface="ivory" labelledBy="journey-title">
        <SectionHeading id="journey-title" eyebrow={tJourney("eyebrow")} title={tJourney("title")} />
        <div className="mt-12">
          <JourneyStages />
        </div>
        <ArrowLink href="/client-journey" className="mt-10">
          {tJourney("link")}
        </ArrowLink>
      </Section>

      <ConsultationInvite />
    </>
  );
}

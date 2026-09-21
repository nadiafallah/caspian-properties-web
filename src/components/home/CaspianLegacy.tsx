import { getTranslations } from "next-intl/server";
import { Eyebrow, Section } from "@/components/ui";

const pillars = ["continuity", "accountability", "access", "evidence", "navigation"] as const;

export async function CaspianLegacy() {
  const t = await getTranslations("Home.legacy");
  const tPillars = await getTranslations("Pillars");

  return (
    <Section surface="dark" labelledBy="legacy-title">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h2 id="legacy-title" className="type-h2 mt-4 text-white">
            {t("title")}
          </h2>
          <p className="mt-6 max-w-measure text-stone">{t("body")}</p>
          <hr className="horizon mt-10 w-24" />
          <blockquote className="type-h2 mt-8 !text-[1.75rem] !leading-snug text-bronze-light">
            <p>{t("quote")}</p>
          </blockquote>
        </div>
        <dl className="grid gap-px self-start overflow-hidden rounded-card border border-white/10 bg-white/10 sm:grid-cols-2 lg:col-span-6 lg:col-start-7">
          {pillars.map((pillar, index) => (
            <div key={pillar} className={index === 0 ? "bg-charcoal p-6 sm:col-span-2" : "bg-charcoal p-6"}>
              <dt className="font-semibold text-bronze-light">{tPillars(`${pillar}.title`)}</dt>
              <dd className="mt-2 text-stone">{tPillars(`${pillar}.body`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

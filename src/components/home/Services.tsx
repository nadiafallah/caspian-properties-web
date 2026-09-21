import { getTranslations } from "next-intl/server";
import { Section, SectionHeading } from "@/components/ui";

const services = ["offPlan", "resale", "leasing", "holidayHome"] as const;

export async function Services() {
  const t = await getTranslations("Home.services");
  const tServices = await getTranslations("Services");

  return (
    <Section labelledBy="services-title">
      <SectionHeading id="services-title" eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <ul className="mt-12 grid gap-5 md:grid-cols-2">
        {services.map((service) => (
          <li key={service} className="flex flex-col rounded-card border border-stone bg-white p-6 md:p-8">
            <p className="proof-label text-bronze-deep">{tServices(`${service}.name`)}</p>
            <h3 className="type-h3 mt-4">{tServices(`${service}.question`)}</h3>
            <p className="mt-3 text-muted">{tServices(`${service}.body`)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

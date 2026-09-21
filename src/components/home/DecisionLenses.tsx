import { getTranslations } from "next-intl/server";
import { Section, SectionHeading } from "@/components/ui";

export async function DecisionLenses() {
  const t = await getTranslations("Home.lenses");
  const lenses = [
    { title: t("capitalTitle"), questions: t("capitalQuestions") },
    { title: t("familyTitle"), questions: t("familyQuestions") },
  ];

  return (
    <Section labelledBy="lenses-title">
      <SectionHeading id="lenses-title" eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {lenses.map((lens) => (
          <article key={lens.title} className="rounded-card border border-stone bg-ivory p-6 md:p-8">
            <h3 className="type-h3">{lens.title}</h3>
            <p className="mt-4 text-charcoal">{lens.questions}</p>
          </article>
        ))}
      </div>
      <p className="type-h2 mt-12 max-w-3xl !text-[1.75rem] !leading-snug text-ink md:!text-[2rem]">{t("closing")}</p>
    </Section>
  );
}

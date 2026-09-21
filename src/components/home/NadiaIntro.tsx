import { getTranslations } from "next-intl/server";
import { ArrowLink, Eyebrow, Section } from "@/components/ui";
import { ImagePlaceholder } from "@/components/placeholders";

export async function NadiaIntro() {
  const t = await getTranslations("Home.intro");
  const tCommon = await getTranslations("Common");

  return (
    <Section labelledBy="intro-title">
      <div className="grid gap-10 md:grid-cols-12 md:items-start">
        <div className="hidden md:col-span-4 md:block">
          <ImagePlaceholder label={tCommon("placeholderPortrait")} className="aspect-[4/5] w-full max-w-72 rounded-card" />
        </div>
        <div className="md:col-span-7 md:col-start-6">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h2 id="intro-title" className="type-h2 mt-4">
            {t("title")}
          </h2>
          <div className="mt-6 max-w-measure space-y-5 text-charcoal">
            <p className="type-lead">{t("p1")}</p>
            <p>{t("p2")}</p>
            <p>{t("p3")}</p>
          </div>
          <ArrowLink href="/about" className="mt-6">
            {t("link")}
          </ArrowLink>
        </div>
      </div>
    </Section>
  );
}

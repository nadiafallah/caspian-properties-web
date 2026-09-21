import { getTranslations } from "next-intl/server";
import { advisor } from "@/config/company";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";
import { ImagePlaceholder } from "@/components/placeholders";

export async function Hero() {
  const t = await getTranslations("Home.hero");
  const tCommon = await getTranslations("Common");

  return (
    <section aria-labelledby="hero-title" className="bg-ivory">
      <Container className="grid gap-14 pt-12 pb-20 md:pt-16 lg:grid-cols-12 lg:items-center lg:gap-12 lg:pb-24">
        <div className="lg:col-span-7">
          <Eyebrow>{tCommon("tagline")}</Eyebrow>
          <h1 id="hero-title" className="type-display mt-5">
            {t("title")}
          </h1>
          <p className="type-lead mt-6 max-w-[52ch] text-muted">{t("lead")}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/consultation">{tCommon("bookConsultation")}</ButtonLink>
            <ButtonLink href="/approach" variant="secondary">
              {tCommon("seeHowIAdvise")}
            </ButtonLink>
          </div>
        </div>

        <div className="relative lg:col-span-5">
          <ImagePlaceholder label={tCommon("placeholderPhoto")} className="nadia-frame aspect-[4/3] w-full lg:aspect-[4/5]" />
          {/* A small, human portrait — supporting authority, never a celebrity treatment. */}
          <figure className="absolute -bottom-8 start-5 w-36 rounded-card bg-white p-2 shadow-card sm:w-44">
            <ImagePlaceholder label={tCommon("placeholderPortrait")} className="aspect-[4/5] w-full rounded-sm" />
            <figcaption className="px-1 pt-2 pb-1">
              <span className="block text-sm font-semibold text-ink">{advisor.displayName.value}</span>
              <span className="type-caption block text-muted">{tCommon("advisorRole")}</span>
            </figcaption>
          </figure>
        </div>
      </Container>
    </section>
  );
}

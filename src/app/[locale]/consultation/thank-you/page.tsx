import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { formatNumber } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/[locale]/consultation/thank-you">) {
  const locale = await resolveLocale(params);
  return pageMetadata({ locale, page: "thankYou", path: "/consultation/thank-you", noindex: true });
}

export default async function ThankYouPage({ params }: PageProps<"/[locale]/consultation/thank-you">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("ThankYou");
  const tCommon = await getTranslations("Common");
  const next = [t("next1"), t("next2"), t("next3")];

  return (
    <section aria-labelledby="page-title" className="bg-ivory py-16 md:py-24">
      <Container>
        <div className="max-w-3xl">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h1 id="page-title" className="type-h1 mt-4">
            {t("title")}
          </h1>
          <p className="type-lead mt-5 text-charcoal">{t("lead")}</p>
          <hr className="horizon my-10 w-24" />
          <h2 className="type-h3">{t("nextTitle")}</h2>
          <ol className="mt-6 space-y-4">
            {next.map((item, index) => (
              <li key={item} className="flex gap-4">
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-bronze-deep text-sm font-semibold text-bronze-deep">
                  {formatNumber(locale, index + 1)}
                </span>
                <span className="pt-1 text-charcoal">{item}</span>
              </li>
            ))}
          </ol>
          <ButtonLink href="/" variant="secondary" className="mt-10">
            {tCommon("backToHome")}
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}

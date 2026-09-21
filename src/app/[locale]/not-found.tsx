import { getTranslations } from "next-intl/server";
import { ButtonLink, Section } from "@/components/ui";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  const tCommon = await getTranslations("Common");

  return (
    <Section surface="ivory" labelledBy="not-found-title" className="min-h-[60vh]">
      <p className="proof-label text-bronze-deep">404</p>
      <h1 id="not-found-title" className="type-h1 mt-4">
        {t("title")}
      </h1>
      <p className="type-lead mt-5 max-w-measure text-muted">{t("body")}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/">{tCommon("backToHome")}</ButtonLink>
        <ButtonLink href="/consultation" variant="secondary">
          {tCommon("bookConsultation")}
        </ButtonLink>
      </div>
    </Section>
  );
}

import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { TERMS_LAST_UPDATED } from "@/config/site";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { LegalDocument } from "@/components/LegalDocument";

const sections = ["info", "noGuarantee", "thirdParty", "licensing", "links", "ip", "changes"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">) {
  const locale = await resolveLocale(params);
  return pageMetadata({ locale, page: "terms", path: "/terms" });
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Terms");
  const tCommon = await getTranslations("Common");

  return (
    <LegalDocument
      eyebrow={t("eyebrow")}
      title={t("title")}
      updated={tCommon("lastUpdated", { date: formatDate(locale, TERMS_LAST_UPDATED) })}
      intro={t("intro")}
      sections={sections.map((key) => ({
        id: key,
        title: t(`${key}Title`),
        body: <p>{t(`${key}Body`)}</p>,
      }))}
    />
  );
}

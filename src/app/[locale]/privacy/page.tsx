import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { Link } from "@/i18n/navigation";
import { PRIVACY_LAST_UPDATED } from "@/config/site";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { LegalDocument } from "@/components/LegalDocument";

const services = ["supabase", "google", "notifications", "cal", "vercel", "upstash"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">) {
  const locale = await resolveLocale(params);
  return pageMetadata({ locale, page: "privacy", path: "/privacy" });
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Privacy");
  const tCommon = await getTranslations("Common");

  return (
    <LegalDocument
      eyebrow={t("eyebrow")}
      title={t("title")}
      updated={tCommon("lastUpdated", { date: formatDate(locale, PRIVACY_LAST_UPDATED) })}
      intro={t("intro")}
      sections={[
        {
          id: "who",
          title: t("whoTitle"),
          body: (
            <p>
              {t.rich("whoBody", {
                link: (chunks) => (
                  <Link href="/contact" className="link">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          ),
        },
        {
          id: "collect",
          title: t("collectTitle"),
          body: (
            <>
              <p>{t("collectBody")}</p>
              <p className="font-medium text-ink">{t("notCollected")}</p>
            </>
          ),
        },
        { id: "use", title: t("useTitle"), body: <p>{t("useBody")}</p> },
        {
          id: "services",
          title: t("servicesTitle"),
          body: (
            <>
              <ul className="list-disc space-y-2 ps-5">
                {services.map((service) => (
                  <li key={service}>{t(`services.${service}`)}</li>
                ))}
              </ul>
              <p>{t("servicesNote")}</p>
            </>
          ),
        },
        { id: "cookies", title: t("cookiesTitle"), body: <p>{t("cookiesBody")}</p> },
        { id: "retention", title: t("retentionTitle"), body: <p>{t("retentionBody")}</p> },
        { id: "rights", title: t("rightsTitle"), body: <p>{t("rightsBody")}</p> },
        { id: "security", title: t("securityTitle"), body: <p>{t("securityBody")}</p> },
        { id: "changes", title: t("changesTitle"), body: <p>{t("changesBody")}</p> },
      ]}
    />
  );
}

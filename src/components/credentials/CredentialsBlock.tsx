import { getLocale, getTranslations } from "next-intl/server";
import { advisor, company } from "@/config/company";
import { dldVerificationUrl } from "@/config/site";
import type { AppLocale } from "@/i18n/locales";
import { formatDate } from "@/lib/format";
import { ExternalIcon, Section, SectionHeading } from "@/components/ui";
import { CardPreview } from "./CardPreview";

export const CARD_PREVIEW_SRC = "/credentials/rera-card-preview.webp";

/** Public licence details so visitors can verify Nadia and the brokerage independently. */
export async function CredentialsBlock() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Credentials");
  const tCommon = await getTranslations("Common");

  const rows = [
    { label: t("broker"), value: advisor.displayName.value, ltr: false },
    { label: t("brn"), value: advisor.brn.value, ltr: true },
    { label: t("brokerage"), value: company.legalNameEn.value, ltr: true },
    { label: t("orn"), value: company.orn.value, ltr: true },
  ];

  return (
    <Section surface="ivory" id="licence" labelledBy="licence-title">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionHeading id="licence-title" eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
          <dl className="mt-8 divide-y divide-stone border-y border-stone">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
                <dt className="type-small text-muted">{row.label}</dt>
                <dd className="font-semibold text-ink" dir={row.ltr ? "ltr" : undefined}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="type-small mt-4 text-muted">
            {t("validUntil", { date: formatDate(locale, advisor.brnExpiry.value) })}
          </p>
          <a
            href={dldVerificationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary mt-8"
          >
            {t("verifyCta")}
            <ExternalIcon />
            <span className="sr-only">{tCommon("opensInNewTab")}</span>
          </a>
        </div>

        <figure className="lg:col-span-6 lg:col-start-7">
          <p className="proof-label mb-3 text-muted">{t("previewTitle")}</p>
          <CardPreview src={CARD_PREVIEW_SRC} label={t("previewAlt")} />
          <figcaption className="type-small mt-3 text-muted">{t("previewNote")}</figcaption>
        </figure>
      </div>
    </Section>
  );
}

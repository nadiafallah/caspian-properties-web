import { getLocale, getTranslations } from "next-intl/server";
import { company, displayValue } from "@/config/company";
import { isLaunch } from "@/config/site";
import type { AppLocale } from "@/i18n/locales";
import { formatNumeral } from "@/lib/format";
import { ButtonLink, Eyebrow, Section } from "@/components/ui";

export async function ConsultationInvite() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Home.invite");
  const tSteps = await getTranslations("Consultation.steps");
  const tCommon = await getTranslations("Common");
  const steps = [tSteps("about"), tSteps("goals"), tSteps("schedule")];
  const showResponseTime = displayValue(company.responseTime, isLaunch) !== null;

  return (
    <Section labelledBy="invite-title">
      <div className="nadia-frame grid gap-10 bg-ivory p-8 md:grid-cols-12 md:p-12">
        <div className="md:col-span-7">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h2 id="invite-title" className="type-h2 mt-4">
            {t("title")}
          </h2>
          <p className="mt-5 max-w-measure text-charcoal">{t("body")}</p>
          {showResponseTime ? <p className="type-small mt-3 text-muted">{t("response")}</p> : null}
          <ButtonLink href="/consultation" className="mt-8">
            {tCommon("bookConsultation")}
          </ButtonLink>
        </div>
        <div className="md:col-span-4 md:col-start-9">
          <p className="proof-label text-muted">{t("stepsLabel")}</p>
          <ol className="mt-4 space-y-4">
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-bronze-deep text-sm font-semibold text-bronze-deep"
                >
                  {formatNumeral(locale, index + 1)}
                </span>
                <span className="font-medium text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  );
}

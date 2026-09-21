import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/locales";
import { cx, formatNumeral } from "@/lib/format";

export const methodSteps = ["discover", "diagnose", "decide", "deliver"] as const;

/** The Nadia Advisory Method. `detailed` adds the full explanation (used on /approach). */
export async function MethodSteps({ detailed = false, headingLevel = 3 }: { detailed?: boolean; headingLevel?: 2 | 3 }) {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Method");
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <ol className={cx("grid gap-px overflow-hidden rounded-card border border-stone bg-stone", detailed ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-4")}>
      {methodSteps.map((step, index) => (
        <li key={step} className="flex flex-col bg-white p-6 md:p-8">
          <span aria-hidden="true" className="font-display text-5xl leading-none font-semibold text-bronze [:root[dir=rtl]_&]:font-rtl">
            {formatNumeral(locale, index + 1)}
          </span>
          <span className="sr-only">{t("stage", { number: formatNumeral(locale, index + 1) })}</span>
          <Heading className="type-h3 mt-6">{t(`${step}.title`)}</Heading>
          <p className="mt-2 text-charcoal">{t(`${step}.summary`)}</p>
          {detailed ? <p className="mt-4 text-muted">{t(`${step}.detail`)}</p> : null}
          <div className="mt-auto pt-6">
            <p className="proof-label text-muted">{t("receives")}</p>
            <p className="mt-1 font-medium text-ink">{t(`${step}.output`)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

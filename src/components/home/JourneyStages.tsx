import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/locales";
import { cx, formatNumeral } from "@/lib/format";

export const journeyStages = ["brief", "strategy", "readiness", "transaction", "ownership"] as const;
const points = ["p1", "p2", "p3"] as const;

/** The five-stage client journey (brand guide §5.1). `detailed` lists every checkpoint. */
export async function JourneyStages({ detailed = false }: { detailed?: boolean }) {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Journey");

  return (
    <ol className={cx("grid gap-8", detailed ? "md:gap-10" : "md:grid-cols-5 md:gap-6")}>
      {journeyStages.map((stage, index) => (
        <li key={stage} className={cx("relative border-t border-stone pt-6", detailed && "md:grid md:grid-cols-12 md:gap-6")}>
          <span aria-hidden="true" className="absolute -top-px start-0 h-px w-12 bg-bronze" />
          <p className={cx("proof-label text-bronze-deep", detailed && "md:col-span-3")}>
            {formatNumeral(locale, index + 1)}
          </p>
          <div className={cx(detailed && "md:col-span-9")}>
            <h3 className={cx("mt-3 font-semibold text-ink", detailed ? "type-h3 md:mt-0" : "text-lg")}>{t(`${stage}.title`)}</h3>
            {detailed ? (
              <ul className="mt-4 space-y-2 text-charcoal">
                {points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[0.7em] h-px w-3 shrink-0 bg-bronze" />
                    <span>{t(`${stage}.${point}`)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="type-small mt-2 text-muted">{t(`${stage}.summary`)}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

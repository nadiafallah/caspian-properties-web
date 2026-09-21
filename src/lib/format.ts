import { localeMeta, type AppLocale } from "@/i18n/locales";

/** Joins truthy class names. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Gregorian date in the locale's script, e.g. "8 May 2027" / "۸ مهٔ ۲۰۲۷" / "8 مايو 2027". */
export function formatDate(locale: AppLocale, isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat(localeMeta[locale].intl, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Ordinary numbers in the locale's digits (Persian digits for fa, Western digits for en/ar). */
export function formatNumber(locale: AppLocale, value: number): string {
  return new Intl.NumberFormat(localeMeta[locale].intl, { useGrouping: false }).format(value);
}

/** Picks a subset of top-level message namespaces for a client provider. */
export function pickMessages<T extends Record<string, unknown>, K extends keyof T>(
  messages: T,
  keys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = messages[key];
  return out;
}

/** Two-digit section numeral in the locale's digits: "01", "۰۱". */
export function formatNumeral(locale: AppLocale, value: number): string {
  return new Intl.NumberFormat(localeMeta[locale].intl, { minimumIntegerDigits: 2, useGrouping: false }).format(value);
}

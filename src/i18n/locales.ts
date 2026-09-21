export const locales = ["en", "fa", "ar"] as const;
export type AppLocale = (typeof locales)[number];

// English is the entry language everywhere; Persian and Arabic are opt-in.
export const defaultLocale: AppLocale = "en";

type LocaleMeta = {
  dir: "ltr" | "rtl";
  /** Native-script label shown in the language switcher. */
  label: string;
  /** BCP 47 tag for Intl formatting. Gregorian calendar everywhere so legal dates match documents. */
  intl: string;
  ogLocale: string;
};

export const localeMeta: Record<AppLocale, LocaleMeta> = {
  en: { dir: "ltr", label: "English", intl: "en-GB", ogLocale: "en_GB" },
  fa: { dir: "rtl", label: "فارسی", intl: "fa-IR-u-ca-gregory", ogLocale: "fa_IR" },
  // UAE convention: Western digits in Arabic text.
  ar: { dir: "rtl", label: "العربية", intl: "ar-AE-u-ca-gregory-nu-latn", ogLocale: "ar_AE" },
};

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}

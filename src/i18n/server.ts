import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import type { AppLocale } from "./locales";

/** Resolves and validates the `[locale]` route param. */
export async function resolveLocale(params: Promise<{ locale: string }>): Promise<AppLocale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}

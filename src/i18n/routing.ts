import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./locales";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // English lives at "/about"; Persian and Arabic at "/fa/about" and "/ar/about".
  localePrefix: "as-needed",
  // Visitors always enter in English — no Accept-Language or cookie redirects.
  localeDetection: false,
  // Detection is off, so no locale cookie is needed.
  localeCookie: false,
  // hreflang alternates are emitted in page metadata instead (see src/lib/seo.ts).
  alternateLinks: false,
});

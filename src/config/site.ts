import type { AppLocale } from "@/i18n/locales";

/**
 * "preview": search engines blocked; missing-content markers and photo placeholders visible.
 * "launch": markers and unverified details removed (see `allowIndexing` for search engines).
 */
export const siteStage: "preview" | "launch" =
  process.env.NEXT_PUBLIC_SITE_STAGE === "launch" ? "launch" : "preview";
export const isLaunch = siteStage === "launch";

/**
 * Search-engine indexing: never in preview; in launch unless NEXT_PUBLIC_ALLOW_INDEXING=false
 * (a clean public site on a temporary address, before the real domain is connected).
 */
export const allowIndexing = isLaunch && process.env.NEXT_PUBLIC_ALLOW_INDEXING !== "false";

// Falls back to the project's Vercel production domain when NEXT_PUBLIC_SITE_URL is not set.
const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (vercelProductionHost ? `https://${vercelProductionHost}` : "http://localhost:3000")
).replace(/\/$/, "");

export const brandName = "Caspian Properties by Nadia";

export const calcom = {
  link: (process.env.NEXT_PUBLIC_CALCOM_LINK || "").replace(/^\/+|\/+$/g, ""),
  namespace: process.env.NEXT_PUBLIC_CALCOM_NAMESPACE || "private-consultation",
  origin: (process.env.NEXT_PUBLIC_CALCOM_ORIGIN || "https://app.cal.com").replace(/\/$/, ""),
};

export const isCalcomConfigured = calcom.link.length > 0;

/** Public booking page, used as the fallback when the embed cannot load. */
export function calcomBookingUrl(leadId?: string): string | null {
  if (!isCalcomConfigured) return null;
  const url = new URL(`https://cal.com/${calcom.link}`);
  if (leadId) url.searchParams.set("metadata[leadId]", leadId);
  return url.toString();
}

/**
 * Languages Nadia currently holds consultations in (brand guide v2: Persian + English).
 * Add "ar" once an Arabic-speaking advisor is confirmed; the form and copy follow automatically.
 */
export const consultationLanguages = ["en", "fa"] as const satisfies readonly AppLocale[];

/** Bump whenever the privacy notice changes materially; stored with every lead. */
export const CONSENT_VERSION = "privacy-2026-09-22";
export const PRIVACY_LAST_UPDATED = "2026-09-22";
export const TERMS_LAST_UPDATED = "2026-09-22";

/** Dubai Land Department public licence and permit verification (Trakheesi). */
export const dldVerificationUrl =
  "https://dubailand.gov.ae/en/eservices/validate-real-estate-licenses-and-permits/";

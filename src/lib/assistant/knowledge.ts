import en from "@/messages/en.json";
import fa from "@/messages/fa.json";
import ar from "@/messages/ar.json";
import { advisor, company } from "@/config/company";
import type { AppLocale } from "@/i18n/locales";

const messages = { en, fa, ar };

// Public, current site copy the assistant may draw on. Edit the message files and the
// assistant follows; nothing here is invented.
const SOURCES = ["Services", "Method", "Journey", "About", "Credentials", "JourneyPage", "Contact"] as const;
const SKIP_KEYS = new Set(["bioNeeded", "detailsNeeded", "previewAlt", "previewNote", "eyebrow"]);

function flatten(value: unknown, key = ""): string[] {
  if (typeof value === "string") return SKIP_KEYS.has(key) ? [] : [value.replace(/<\/?\w+>/g, "")];
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => flatten(v, k));
  return [];
}

const cache = new Map<AppLocale, string>();

/** Verified facts plus the site's own wording, in the visitor's language. */
export function knowledgeFor(locale: AppLocale): string {
  const cached = cache.get(locale);
  if (cached) return cached;
  const facts = [
    `Brokerage: ${company.legalNameEn.value} (${company.legalNameAr.value}), Dubai DET licence ${company.licenceNumber.value}, RERA office registration (ORN) ${company.orn.value}, established ${company.establishedOn.value}.`,
    `Advisor: ${advisor.displayName.value}, ${advisor.role.value}, broker registration (BRN) ${advisor.brn.value}.`,
    `Phone and WhatsApp for Nadia: ${company.phone.value}.`,
    "Consultations are held in English and Persian.",
  ].filter(Boolean);
  const site = SOURCES.flatMap((ns) => flatten((messages[locale] as Record<string, unknown>)[ns]));
  const text = [...facts, ...site].join("\n");
  cache.set(locale, text);
  return text;
}

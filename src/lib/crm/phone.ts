import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

/** Persian (۰–۹) and Arabic-Indic (٠–٩) digits → ASCII. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

export type PhoneResult =
  | { status: "ok"; e164: string }
  /** A local number that is valid in more than one likely country, or none we can assume. */
  | { status: "needs_country" }
  | { status: "invalid" };

// Where a number without a country code is most likely from, in order. A local number
// is accepted only when exactly one of these countries considers it valid.
const LIKELY_COUNTRIES: CountryCode[] = ["AE", "IR"];

const MAX_INPUT = 32;

/**
 * Parses a phone number typed in any script. Checks the format only — it never
 * confirms that the number exists, belongs to the visitor, or uses WhatsApp.
 */
export function normalizePhone(input: string, countryCallingCode?: string): PhoneResult {
  const raw = toLatinDigits(input).trim();
  if (!raw || raw.length > MAX_INPUT || /[^\d+\s().\-]/.test(raw)) return { status: "invalid" };

  let compact = raw.replace(/[\s().\-]/g, "");
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;
  if (compact.indexOf("+") > 0 || !/^\+?\d{6,15}$/.test(compact)) return { status: "invalid" };

  if (compact.startsWith("+")) return validated(compact);

  if (countryCallingCode) {
    const code = countryCallingCode.replace(/\D/g, "");
    if (!code) return { status: "invalid" };
    return validated(`+${code}${compact.replace(/^0+/, "")}`);
  }

  // A number without a country code is only guessed when written in national format
  // (leading 0); anything else could be from anywhere.
  if (!compact.startsWith("0")) return { status: "needs_country" };
  const matches = new Set<string>();
  for (const country of LIKELY_COUNTRIES) {
    const parsed = parsePhoneNumberFromString(compact, country);
    if (parsed?.isValid()) matches.add(parsed.number);
  }
  if (matches.size === 1) return { status: "ok", e164: [...matches][0]! };
  return { status: "needs_country" };
}

function validated(candidate: string): PhoneResult {
  const parsed = parsePhoneNumberFromString(candidate);
  return parsed?.isValid() ? { status: "ok", e164: parsed.number } : { status: "invalid" };
}

/** Finds something that looks like a phone number inside free text (any digits script). */
export function findPhoneInText(text: string): string | null {
  const match = toLatinDigits(text).match(/(?:\+|00)?\d[\d\s().\-]{5,20}\d/);
  return match ? match[0] : null;
}

/** Removes phone-like sequences before text is shared with an outside service. */
export function redactPhones(text: string): string {
  return toLatinDigits(text).replace(/(?:\+|00)?\d[\d\s().\-]{5,20}\d/g, "[phone]");
}

/** Readable international form, e.g. "+971 52 887 7200". */
export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

/**
 * Single source of truth for company, advisor and compliance details.
 * Every field records whether it is verified and where the value came from.
 * Unverified fields are never rendered when NEXT_PUBLIC_SITE_STAGE=launch.
 * Correcting a value here updates every locale.
 */

export type VerifiedField<T> = { verified: true; value: T; source: string };
export type PendingField<T> = { verified: false; value: T | null; note: string };
export type Field<T> = VerifiedField<T> | PendingField<T>;

const verified = <T>(value: T, source: string): VerifiedField<T> => ({ verified: true, value, source });
const pending = <T>(value: T | null, note: string): PendingField<T> => ({ verified: false, value, note });

const DET_LICENCE = "Dubai DET commercial licence 595102 (printed 24 Apr 2026)";
const BROKER_CARD = "DLD/RERA broker card 70350 (issued 30 May 2024)";

export const company = {
  legalNameEn: verified("Caspian Properties Brokers LLC", DET_LICENCE),
  legalNameAr: verified("كاسبين للوساطة العقارية ذ.م.م", DET_LICENCE),
  licenceNumber: verified("595102", DET_LICENCE),
  licenceExpiry: verified("2027-05-08", DET_LICENCE),
  /** Backs the evergreen "Since 2007" claim. */
  establishedOn: verified("2007-05-09", DET_LICENCE),
  orn: verified("557", "RERA office registration certificate; confirmed current by owner on 22 Sep 2026"),
  address: pending<string>(
    "Office 1107, Business Bay, Dubai, UAE",
    "Listed on the DET licence; building name and public display to be confirmed by owner",
  ),
  phone: pending<string>(null, "Owner will provide the public phone number"),
  whatsapp: pending<string>(null, "Owner will provide the public WhatsApp number (E.164, e.g. +9715XXXXXXXX)"),
  email: pending<string>(null, "Owner will provide the public enquiry email"),
  privacyEmail: pending<string>(null, "Owner to confirm the address for privacy requests"),
  instagram: verified(
    { handle: "@caspian_properties", url: "https://www.instagram.com/caspian_properties/" },
    "Brand guide v2",
  ),
  /** Shown as "Nadia or her team will reply within …". */
  responseTime: pending<"oneBusinessDay">("oneBusinessDay", "Brand guide example; owner to confirm the commitment"),
} as const;

export const advisor = {
  displayName: verified("Nadia Fallah", "Owner decision, 22 Sep 2026"),
  shortName: "Nadia",
  role: verified("Real Estate Advisor", "Brand guide v2 email signature"),
  brn: verified("70350", BROKER_CARD),
  brnExpiry: verified("2027-05-08", BROKER_CARD),
  portrait: pending<string>(null, "Approved professional portrait with usage rights"),
  biography: pending<string>(null, "Nadia’s biography (EN, reviewed FA/AR translations)"),
} as const;

/** Reads a field for display: verified values always, unverified values only in preview stage. */
export function displayValue<T>(field: Field<T>, launch: boolean): T | null {
  if (field.verified) return field.value;
  return launch ? null : field.value;
}

/** WhatsApp deep link from an E.164 number, or null. */
export function whatsappUrl(e164: string | null): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

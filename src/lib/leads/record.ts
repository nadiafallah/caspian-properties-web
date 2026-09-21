import { CONSENT_VERSION } from "@/config/site";
import type { ConsultationInput } from "./schema";

/** Column order of the Google Sheets lead register (row 1 must contain these headers). */
export const SHEET_COLUMNS = [
  "lead_id",
  "created_at_utc",
  "locale",
  "full_name",
  "email",
  "phone",
  "location",
  "preferred_language",
  "preferred_contact",
  "interest",
  "purpose",
  "budget_range",
  "timeline",
  "decision_makers",
  "meeting_format",
  "notes",
  "referral_source",
  "source_page",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "consent_version",
  "consent_at_utc",
  "booking_status",
  "cal_booking_uid",
  "booking_start_utc",
  "booking_end_utc",
  "updated_at_utc",
] as const;

export type SheetColumn = (typeof SHEET_COLUMNS)[number];
export type LeadRecord = Record<SheetColumn, string>;

export type BookingStatus = "submitted" | "booked" | "rescheduled" | "cancelled" | "unqualified_booking";

export type BookingUpdate = {
  status: BookingStatus;
  bookingUid: string;
  startUtc?: string;
  endUtc?: string;
  meetingFormat?: string;
  updatedAtUtc: string;
};

export function buildLeadRecord(input: ConsultationInput, nowIso: string): LeadRecord {
  return {
    lead_id: input.submissionId,
    created_at_utc: nowIso,
    locale: input.locale,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone ?? "",
    location: input.location ?? "",
    preferred_language: input.consultationLanguage,
    preferred_contact: input.contactChannel,
    interest: input.interest,
    purpose: input.purpose,
    budget_range: input.budget,
    timeline: input.timeline,
    decision_makers: input.decisionMakers ?? "",
    meeting_format: "",
    notes: input.notes ?? "",
    referral_source: input.referral ?? "",
    source_page: input.sourcePage ?? "",
    utm_source: input.utm_source ?? "",
    utm_medium: input.utm_medium ?? "",
    utm_campaign: input.utm_campaign ?? "",
    utm_content: input.utm_content ?? "",
    utm_term: input.utm_term ?? "",
    consent_version: CONSENT_VERSION,
    consent_at_utc: nowIso,
    booking_status: "submitted",
    cal_booking_uid: "",
    booking_start_utc: "",
    booking_end_utc: "",
    updated_at_utc: nowIso,
  };
}

/**
 * Spreadsheet apps treat cells starting with = + - @ as formulas when exported.
 * Prefix free-text values with an apostrophe so they always stay plain text.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

// Phone numbers are validated to "+digits" and are safe as-is.
const FREE_TEXT: SheetColumn[] = ["full_name", "location", "notes", "source_page", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

export function toSheetRow(record: LeadRecord): string[] {
  return SHEET_COLUMNS.map((column) =>
    FREE_TEXT.includes(column) ? neutralizeFormula(record[column]) : record[column],
  );
}

export function columnLetter(column: SheetColumn): string {
  let index = SHEET_COLUMNS.indexOf(column) + 1;
  let letters = "";
  while (index > 0) {
    const rem = (index - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    index = Math.floor((index - 1) / 26);
  }
  return letters;
}

/** A Cal.com booking that did not come through the qualification form. */
export function buildUnmatchedBookingRecord(
  event: { bookingUid: string; startUtc?: string; endUtc?: string; meetingFormat?: string; attendeeName?: string; attendeeEmail?: string },
  nowIso: string,
): LeadRecord {
  const empty = Object.fromEntries(SHEET_COLUMNS.map((c) => [c, ""])) as LeadRecord;
  return {
    ...empty,
    lead_id: `cal-${event.bookingUid}`,
    created_at_utc: nowIso,
    full_name: event.attendeeName ?? "",
    email: event.attendeeEmail ?? "",
    meeting_format: event.meetingFormat ?? "",
    source_page: "cal.com (direct booking)",
    booking_status: "unqualified_booking",
    cal_booking_uid: event.bookingUid,
    booking_start_utc: event.startUtc ?? "",
    booking_end_utc: event.endUtc ?? "",
    updated_at_utc: nowIso,
  };
}

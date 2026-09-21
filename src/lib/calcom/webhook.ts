import { createHmac, timingSafeEqual } from "node:crypto";
import type { BookingStatus } from "@/lib/leads/record";

/** Cal.com signs the raw body with HMAC-SHA256 (hex) in the `x-cal-signature-256` header. */
export function verifyCalSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type BookingEvent = {
  trigger: "BOOKING_CREATED" | "BOOKING_RESCHEDULED" | "BOOKING_CANCELLED";
  bookingUid: string;
  previousBookingUid?: string;
  leadId?: string;
  startUtc?: string;
  endUtc?: string;
  meetingFormat?: string;
  attendeeName?: string;
  attendeeEmail?: string;
};

const HANDLED = new Set(["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Extracts only what the lead register needs. Returns null for events we don't handle. */
export function parseCalWebhook(body: unknown): BookingEvent | null {
  if (!body || typeof body !== "object") return null;
  const { triggerEvent, payload } = body as { triggerEvent?: unknown; payload?: Record<string, unknown> };
  if (typeof triggerEvent !== "string" || !HANDLED.has(triggerEvent) || !payload) return null;

  const bookingUid = str(payload.uid);
  if (!bookingUid) return null;

  const metadata = (payload.metadata ?? {}) as Record<string, unknown>;
  const leadId = str(metadata.leadId);
  const attendees = Array.isArray(payload.attendees) ? (payload.attendees as Array<Record<string, unknown>>) : [];

  return {
    trigger: triggerEvent as BookingEvent["trigger"],
    bookingUid,
    previousBookingUid: str(payload.rescheduleUid),
    leadId: leadId && UUID.test(leadId) ? leadId : undefined,
    startUtc: str(payload.startTime),
    endUtc: str(payload.endTime),
    meetingFormat: str(payload.location)?.slice(0, 200),
    attendeeName: str(attendees[0]?.name)?.slice(0, 120),
    attendeeEmail: str(attendees[0]?.email)?.slice(0, 254),
  };
}

export function statusFor(trigger: BookingEvent["trigger"]): BookingStatus {
  if (trigger === "BOOKING_CANCELLED") return "cancelled";
  if (trigger === "BOOKING_RESCHEDULED") return "rescheduled";
  return "booked";
}

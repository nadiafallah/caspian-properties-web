import { NextResponse } from "next/server";
import { parseCalWebhook, statusFor, verifyCalSignature } from "@/lib/calcom/webhook";
import { buildUnmatchedBookingRecord } from "@/lib/leads/record";
import { getLeadStore } from "@/lib/leads/store";
import { getGuard } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;
const DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Cal.com → lead register sync. Verifies the signature, then records booking status,
 * time and uid against the matching lead. Bookings made without the form are recorded
 * as "unqualified_booking" so Nadia can see them. Processing is idempotent.
 */
export async function POST(request: Request) {
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (!verifyCalSignature(raw, request.headers.get("x-cal-signature-256"), secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = parseCalWebhook(body);
  if (!event) return NextResponse.json({ ok: true, ignored: true });

  const store = getLeadStore();
  if (!store) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const guard = getGuard();
  const dedupeKey = `cal:${event.trigger}:${event.bookingUid}`;
  const isNew = await guard.claim(dedupeKey, DEDUPE_TTL_SECONDS).catch(() => true);
  if (!isNew) return NextResponse.json({ ok: true, duplicate: true });

  const now = new Date().toISOString();
  try {
    const matched = await store.updateBooking(
      { leadId: event.leadId, previousBookingUid: event.previousBookingUid ?? (event.trigger === "BOOKING_CANCELLED" ? event.bookingUid : undefined) },
      {
        status: statusFor(event.trigger),
        bookingUid: event.bookingUid,
        startUtc: event.startUtc,
        endUtc: event.endUtc,
        meetingFormat: event.meetingFormat,
        updatedAtUtc: now,
      },
    );
    if (!matched && event.trigger === "BOOKING_CREATED") {
      await store.append(buildUnmatchedBookingRecord(event, now));
    }
    console.info(`[calcom] ${event.trigger} ${event.bookingUid} matched=${matched}`);
    return NextResponse.json({ ok: true, matched });
  } catch {
    // Allow Cal.com to retry this delivery.
    await guard.release(dedupeKey).catch(() => {});
    console.error(`[calcom] failed to record ${event.trigger} ${event.bookingUid}`);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}

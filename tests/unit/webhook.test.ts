import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseCalWebhook, statusFor, verifyCalSignature } from "@/lib/calcom/webhook";

const SECRET = "test-secret";
const LEAD_ID = "3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7b";
const sign = (body: string) => createHmac("sha256", SECRET).update(body).digest("hex");

const created = (overrides: Record<string, unknown> = {}) => ({
  triggerEvent: "BOOKING_CREATED",
  createdAt: "2026-09-22T10:00:00.000Z",
  payload: {
    uid: "booking-1",
    startTime: "2026-09-25T09:00:00.000Z",
    endTime: "2026-09-25T09:45:00.000Z",
    location: "integrations:google:meet",
    metadata: { leadId: LEAD_ID, videoCallUrl: "https://meet.example" },
    attendees: [{ name: "Sara Ahmadi", email: "sara@example.com" }],
    ...overrides,
  },
});

describe("Cal.com webhook signature", () => {
  it("accepts a valid HMAC-SHA256 hex signature", () => {
    const body = JSON.stringify(created());
    expect(verifyCalSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects missing, wrong or tampered signatures", () => {
    const body = JSON.stringify(created());
    expect(verifyCalSignature(body, null, SECRET)).toBe(false);
    expect(verifyCalSignature(body, "deadbeef", SECRET)).toBe(false);
    expect(verifyCalSignature(`${body} `, sign(body), SECRET)).toBe(false);
  });
});

describe("Cal.com webhook parsing", () => {
  it("extracts booking details and the lead id", () => {
    expect(parseCalWebhook(created())).toMatchObject({
      trigger: "BOOKING_CREATED",
      bookingUid: "booking-1",
      leadId: LEAD_ID,
      startUtc: "2026-09-25T09:00:00.000Z",
      meetingFormat: "integrations:google:meet",
    });
  });

  it("ignores unrelated events and malformed payloads", () => {
    expect(parseCalWebhook({ triggerEvent: "MEETING_ENDED", payload: { uid: "x" } })).toBeNull();
    expect(parseCalWebhook({ triggerEvent: "BOOKING_CREATED", payload: {} })).toBeNull();
    expect(parseCalWebhook("nope")).toBeNull();
  });

  it("drops lead ids that are not UUIDs", () => {
    expect(parseCalWebhook(created({ metadata: { leadId: "=cmd" } }))?.leadId).toBeUndefined();
  });

  it("maps triggers to booking statuses", () => {
    expect(statusFor("BOOKING_CREATED")).toBe("booked");
    expect(statusFor("BOOKING_RESCHEDULED")).toBe("rescheduled");
    expect(statusFor("BOOKING_CANCELLED")).toBe("cancelled");
  });
});

describe("POST /api/webhooks/calcom (memory store)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("CALCOM_WEBHOOK_SECRET", SECRET);
    vi.stubEnv("LEAD_STORE", "memory");
  });
  afterEach(() => vi.unstubAllEnvs());

  async function post(body: object, signature?: string) {
    const { POST } = await import("@/app/api/webhooks/calcom/route");
    const raw = JSON.stringify(body);
    return POST(
      new Request("http://localhost/api/webhooks/calcom", {
        method: "POST",
        body: raw,
        headers: { "x-cal-signature-256": signature ?? sign(raw) },
      }),
    );
  }

  it("rejects an invalid signature", async () => {
    const response = await post(created(), "bad");
    expect(response.status).toBe(401);
  });

  it("updates the matching lead once, even if Cal.com retries", async () => {
    const { getLeadStore } = await import("@/lib/leads/store");
    const store = getLeadStore() as import("@/lib/leads/memory-store").MemoryLeadStore;
    const { buildLeadRecord } = await import("@/lib/leads/record");
    const { consultationSchema } = await import("@/lib/leads/schema");
    const { validInput } = await import("./fixtures");
    await store.append(buildLeadRecord(consultationSchema.parse(validInput), "2026-09-22T09:00:00.000Z"));

    const first = await post(created());
    expect(await first.json()).toMatchObject({ ok: true, matched: true });
    const retry = await post(created());
    expect(await retry.json()).toMatchObject({ ok: true, duplicate: true });

    expect(store.records[0]).toMatchObject({ booking_status: "booked", cal_booking_uid: "booking-1" });
  });

  it("records bookings made without the form as unqualified", async () => {
    const { getLeadStore } = await import("@/lib/leads/store");
    const response = await post(created({ uid: "direct-1", metadata: {} }));
    expect(await response.json()).toMatchObject({ ok: true, matched: false });
    const store = getLeadStore() as unknown as { records: Array<Record<string, string>> };
    expect(store.records.at(-1)).toMatchObject({ booking_status: "unqualified_booking", cal_booking_uid: "direct-1" });
  });
});

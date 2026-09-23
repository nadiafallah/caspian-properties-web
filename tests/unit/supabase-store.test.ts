import { afterEach, describe, expect, it, vi } from "vitest";
import { SHEET_COLUMNS, type LeadRecord } from "@/lib/leads/record";
import { SupabaseLeadStore, toRow } from "@/lib/leads/supabase-store";

const record = {
  ...(Object.fromEntries(SHEET_COLUMNS.map((c) => [c, ""])) as LeadRecord),
  lead_id: "lead-1",
  created_at_utc: "2026-09-23T10:00:00.000Z",
  full_name: "=Sara",
  updated_at_utc: "2026-09-23T10:00:00.000Z",
};

const store = new SupabaseLeadStore({ url: "https://abc.supabase.co/", secretKey: "sb_secret_test" });

function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("SupabaseLeadStore", () => {
  it("sends empty timestamps as null and keeps text as-is", () => {
    const row = toRow(record);
    expect(row.booking_start_utc).toBeNull();
    expect(row.consent_at_utc).toBeNull();
    expect(row.phone).toBe("");
    expect(row.full_name).toBe("=Sara");
  });

  it("inserts idempotently with the secret key", async () => {
    const fetch = mockFetch(new Response(null, { status: 201 }));
    await store.append(record);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://abc.supabase.co/rest/v1/leads?on_conflict=lead_id");
    expect(init.method).toBe("POST");
    expect(init.headers.apikey).toBe("sb_secret_test");
    expect(init.headers.Prefer).toContain("resolution=ignore-duplicates");
  });

  it("throws without echoing row details", async () => {
    mockFetch(Response.json({ code: "23514", message: "check violation", details: "Failing row contains (sara@example.com)" }, { status: 400 }));
    await expect(store.append(record)).rejects.toThrow(/^(?!.*sara@example\.com).*23514/);
  });

  it("updates by lead id, then falls back to the previous booking uid", async () => {
    const fetch = mockFetch(Response.json([]), Response.json([{ lead_id: "lead-1" }]));
    const matched = await store.updateBooking(
      { leadId: "lead-x", previousBookingUid: "old uid" },
      { status: "rescheduled", bookingUid: "new", updatedAtUtc: "2026-09-23T11:00:00.000Z" },
    );
    expect(matched).toBe(true);
    expect(fetch.mock.calls[0]![0]).toContain("lead_id=eq.lead-x");
    expect(fetch.mock.calls[1]![0]).toContain("cal_booking_uid=eq.old%20uid");
    expect(JSON.parse(fetch.mock.calls[1]![1].body)).toMatchObject({ booking_status: "rescheduled", booking_start_utc: null });
  });

  it("reports no match", async () => {
    mockFetch(Response.json([]));
    expect(await store.updateBooking({ leadId: "none" }, { status: "cancelled", bookingUid: "b", updatedAtUtc: "2026-09-23T11:00:00.000Z" })).toBe(false);
  });
});

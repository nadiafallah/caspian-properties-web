import { describe, expect, it } from "vitest";
import { dubaiDayBounds, dubaiInputToIso, formatDubai, isoToDubaiInput } from "@/lib/crm/time";
import { followUpBucket } from "@/lib/crm/admin-data";

describe("Dubai time", () => {
  it("converts form input (Dubai) to UTC and back", () => {
    expect(dubaiInputToIso("2026-10-03T14:30")).toBe("2026-10-03T10:30:00.000Z");
    expect(isoToDubaiInput("2026-10-03T10:30:00.000Z")).toBe("2026-10-03T14:30");
    expect(dubaiInputToIso("2026-10-03T02:00")).toBe("2026-10-02T22:00:00.000Z");
  });

  it("rejects malformed or impossible dates", () => {
    expect(dubaiInputToIso("2026-02-30T10:00")).toBeNull();
    expect(dubaiInputToIso("tomorrow")).toBeNull();
    expect(dubaiInputToIso("2026-10-03T25:00")).toBeNull();
  });

  it("finds the Dubai calendar day and buckets follow-ups", () => {
    const now = new Date("2026-10-02T21:00:00Z"); // 01:00 on 3 Oct in Dubai
    expect(dubaiDayBounds(now).start.toISOString()).toBe("2026-10-02T20:00:00.000Z");
    expect(followUpBucket("2026-10-02T20:30:00Z", now)).toBe("overdue");
    expect(followUpBucket("2026-10-03T10:00:00Z", now)).toBe("today");
    expect(followUpBucket("2026-10-03T21:00:00Z", now)).toBe("upcoming");
  });

  it("formats in Dubai time", () => {
    expect(formatDubai("2026-10-03T10:30:00Z", "en")).toBe("3 Oct 2026, 14:30");
  });
});

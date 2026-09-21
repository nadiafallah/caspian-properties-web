import { describe, expect, it } from "vitest";
import { CONSENT_VERSION } from "@/config/site";
import { consultationSchema } from "@/lib/leads/schema";
import {
  SHEET_COLUMNS,
  buildLeadRecord,
  buildUnmatchedBookingRecord,
  columnLetter,
  neutralizeFormula,
  toSheetRow,
} from "@/lib/leads/record";
import { validInput } from "./fixtures";

describe("lead record mapping", () => {
  const input = consultationSchema.parse(validInput);
  const record = buildLeadRecord(input, "2026-09-22T10:00:00.000Z");

  it("maps every sheet column in order", () => {
    const row = toSheetRow(record);
    expect(row).toHaveLength(SHEET_COLUMNS.length);
    expect(row[0]).toBe(validInput.submissionId);
    expect(record.email).toBe("sara@example.com");
    expect(record.budget_range).toBe("2m-3500k");
    expect(record.consent_version).toBe(CONSENT_VERSION);
    expect(record.booking_status).toBe("submitted");
    expect(record.utm_source).toBe("instagram");
  });

  it("neutralises spreadsheet formulas in free text", () => {
    expect(neutralizeFormula("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(neutralizeFormula("@cmd")).toBe("'@cmd");
    expect(neutralizeFormula("Hello")).toBe("Hello");
    const row = toSheetRow({ ...record, notes: "=1+1", phone: "+971501234567" });
    expect(row[SHEET_COLUMNS.indexOf("notes")]).toBe("'=1+1");
    // Validated phone numbers keep their leading +.
    expect(row[SHEET_COLUMNS.indexOf("phone")]).toBe("+971501234567");
  });

  it("computes A1 column letters", () => {
    expect(columnLetter("lead_id")).toBe("A");
    expect(columnLetter("updated_at_utc")).toBe("AD");
    expect(columnLetter("booking_status")).toBe("Z");
  });

  it("builds a visible record for bookings made without the form", () => {
    const unmatched = buildUnmatchedBookingRecord({ bookingUid: "abc123", attendeeEmail: "x@y.com" }, "2026-09-22T10:00:00.000Z");
    expect(unmatched.booking_status).toBe("unqualified_booking");
    expect(unmatched.lead_id).toBe("cal-abc123");
    expect(unmatched.cal_booking_uid).toBe("abc123");
  });
});

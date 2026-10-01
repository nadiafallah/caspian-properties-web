import { describe, expect, it } from "vitest";
import { findPhoneInText, formatPhone, normalizePhone, redactPhones, toLatinDigits } from "@/lib/crm/phone";

describe("normalizePhone", () => {
  it("accepts international numbers in any common notation", () => {
    expect(normalizePhone("+971 52 887 7200")).toEqual({ status: "ok", e164: "+971528877200" });
    expect(normalizePhone("00971528877200")).toEqual({ status: "ok", e164: "+971528877200" });
    expect(normalizePhone("+1 (415) 555-2671")).toEqual({ status: "ok", e164: "+14155552671" });
    expect(normalizePhone("+44 7911 123456")).toEqual({ status: "ok", e164: "+447911123456" });
  });

  it("normalises Persian and Arabic-Indic digits", () => {
    expect(toLatinDigits("۰۹۱۲٣٤٥")).toBe("0912345");
    expect(normalizePhone("+۹۷۱ ۵۲ ۸۸۷ ۷۲۰۰")).toEqual({ status: "ok", e164: "+971528877200" });
    expect(normalizePhone("+٩٧١٥٢٨٨٧٧٢٠٠")).toEqual({ status: "ok", e164: "+971528877200" });
  });

  it("recognises unambiguous local UAE and Iranian mobiles", () => {
    expect(normalizePhone("052 887 7200")).toEqual({ status: "ok", e164: "+971528877200" });
    expect(normalizePhone("۰۹۱۲۳۴۵۶۷۸۹")).toEqual({ status: "ok", e164: "+989123456789" });
  });

  it("asks for the country only when a local number is ambiguous", () => {
    expect(normalizePhone("4155552671")).toEqual({ status: "needs_country" });
    expect(normalizePhone("4155552671", "1")).toEqual({ status: "ok", e164: "+14155552671" });
    expect(normalizePhone("0123456789")).toEqual({ status: "needs_country" });
  });

  it("rejects malformed input and never claims more than the format", () => {
    expect(normalizePhone("12")).toEqual({ status: "invalid" });
    expect(normalizePhone("+971 12")).toEqual({ status: "invalid" });
    expect(normalizePhone("call me")).toEqual({ status: "invalid" });
    expect(normalizePhone("+97152887+7200")).toEqual({ status: "invalid" });
  });
});

describe("phone helpers", () => {
  it("finds and redacts numbers inside text", () => {
    expect(findPhoneInText("my number is ۰۵۲ ۸۸۷ ۷۲۰۰ thanks")).toBe("052 887 7200");
    expect(redactPhones("call +971 52 887 7200 please")).toBe("call [phone] please");
    expect(findPhoneInText("I want 2 bedrooms")).toBeNull();
  });

  it("formats E.164 for display", () => {
    expect(formatPhone("+971528877200")).toBe("+971 52 887 7200");
  });
});

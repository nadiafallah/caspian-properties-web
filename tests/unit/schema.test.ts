import { describe, expect, it } from "vitest";
import { budgetOptionsFor, consultationSchema, fieldErrors, stepOneSchema, stepTwoSchema } from "@/lib/leads/schema";
import { validInput } from "./fixtures";

describe("consultation schema", () => {
  it("accepts a complete submission and normalises email", () => {
    const result = consultationSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("sara@example.com");
      expect(result.data.phone).toBeUndefined();
      expect(result.data.referral).toBeUndefined();
    }
  });

  it("requires a phone number when the contact channel is phone or WhatsApp", () => {
    const result = stepOneSchema.safeParse({ ...validInput, contactChannel: "whatsapp", phone: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)).toEqual({ phone: "phoneRequired" });
  });

  it("requires an international format with +country code", () => {
    const bad = stepOneSchema.safeParse({ ...validInput, contactChannel: "phone", phone: "0501234567" });
    expect(!bad.success && fieldErrors(bad.error).phone).toBe("phone");
    const good = stepOneSchema.safeParse({ ...validInput, contactChannel: "phone", phone: "+971 50 123 4567" });
    expect(good.success).toBe(true);
  });

  it("returns message keys for missing required answers", () => {
    const result = stepOneSchema.safeParse({ fullName: "", email: "x", consultationLanguage: "", contactChannel: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        fullName: "fullName",
        email: "email",
        consultationLanguage: "choose",
        contactChannel: "choose",
      });
    }
  });

  it("only offers consultation languages that are actually available", () => {
    const result = stepOneSchema.safeParse({ ...validInput, consultationLanguage: "ar" });
    expect(result.success).toBe(false);
  });

  it("uses rent bands for leasing and purchase bands otherwise", () => {
    expect(budgetOptionsFor("leasing")).toContain("rent-100k-200k");
    expect(budgetOptionsFor("resale")).not.toContain("rent-100k-200k");
    const mismatch = stepTwoSchema.safeParse({ ...validInput, interest: "leasing", budget: "2m-3500k" });
    expect(!mismatch.success && fieldErrors(mismatch.error).budget).toBe("choose");
  });

  it("requires explicit consent", () => {
    const result = stepTwoSchema.safeParse({ ...validInput, consent: "" });
    expect(!result.success && fieldErrors(result.error).consent).toBe("consent");
  });

  it("limits notes to 1,000 characters", () => {
    const result = stepTwoSchema.safeParse({ ...validInput, notes: "a".repeat(1001) });
    expect(!result.success && fieldErrors(result.error).notes).toBe("notes");
  });
});

describe("step validation reports every problem at once", () => {
  it("includes the phone requirement alongside other missing fields", async () => {
    const { validateStepOne } = await import("@/lib/leads/schema");
    expect(validateStepOne({ fullName: "", email: "", consultationLanguage: "", contactChannel: "whatsapp", phone: "" })).toEqual({
      fullName: "fullName",
      email: "email",
      consultationLanguage: "choose",
      phone: "phoneRequired",
    });
  });
});

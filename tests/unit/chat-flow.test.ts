import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, applyText, chooseIntent, editField, nextStep, whatsappLink } from "@/components/chat/flow";

describe("chat flow", () => {
  it("asks one missing item at a time and never repeats a known one", () => {
    let draft = EMPTY_DRAFT;
    expect(nextStep(draft)).toBe("intent");
    draft = chooseIntent(draft, "sell");
    expect(nextStep(draft)).toBe("name");
    draft = applyText(draft, "name", "Sara").draft;
    expect(nextStep(draft)).toBe("phone");
    draft = applyText(draft, "phone", "+971 50 123 4567").draft;
    expect(nextStep(draft)).toBe("confirm");
  });

  it("takes everything from one free-text message", () => {
    const out = applyText(EMPTY_DRAFT, "intent", "My name is Sara, I want to buy off-plan, call me on +971 50 123 4567");
    expect(out.draft).toMatchObject({ intent: "buy_off_plan", name: "Sara", phone: "+971501234567" });
    expect(out.draft.purposeText).not.toContain("123");
    expect(nextStep(out.draft)).toBe("confirm");
  });

  it("clarifies a general purchase once and accepts 'not sure'", () => {
    const first = applyText(EMPTY_DRAFT, "intent", "می‌خواهم آپارتمان بخرم");
    expect(first.draft.intent).toBe("buy");
    expect(nextStep(first.draft)).toBe("clarify_buy");
    const unsure = applyText(first.draft, "clarify_buy", "مطمئن نیستم");
    expect(unsure.draft.intent).toBe("buy");
    expect(nextStep(unsure.draft)).toBe("name");
  });

  it("clarifies rent vs let", () => {
    const first = applyText(EMPTY_DRAFT, "intent", "I have a question about rental");
    expect(nextStep(first.draft)).toBe("clarify_rental");
    const let_ = applyText(first.draft, "clarify_rental", "I want to rent out my flat");
    expect(let_.draft.intent).toBe("let");
  });

  it("sends questions to the assistant instead of treating them as answers", () => {
    const out = applyText(chooseIntent(EMPTY_DRAFT, "rent"), "name", "What are your fees?");
    expect(out.draft.name).toBe("");
    expect(out.ask).toBe(true);
  });

  it("asks for the country for an ambiguous local number, and flags invalid ones", () => {
    const base = { ...chooseIntent(EMPTY_DRAFT, "sell"), name: "Sara" };
    const ambiguous = applyText(base, "phone", "4155552671");
    expect(ambiguous.draft.pendingPhone).toBe("4155552671");
    expect(nextStep(ambiguous.draft)).toBe("country");
    const invalid = applyText(base, "phone", "12345");
    expect(invalid.notice).toBe("phoneInvalid");
    expect(invalid.draft.phone).toBe("");
  });

  it("lets the visitor correct a field from the summary", () => {
    const full = { ...chooseIntent(EMPTY_DRAFT, "rent"), name: "Sara", phone: "+971501234567" };
    expect(nextStep(editField(full, "phone"))).toBe("phone");
    expect(nextStep(editField(full, "intent"))).toBe("intent");
    expect(nextStep(editField(full, "name"))).toBe("name");
  });

  it("builds an encoded, editable WhatsApp link to the right number", () => {
    const link = whatsappLink("+971528877200", "سلام نادیا، من سارا هستم & about: buy?");
    expect(link.startsWith("https://wa.me/971528877200?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1]!)).toBe("سلام نادیا، من سارا هستم & about: buy?");
  });
});

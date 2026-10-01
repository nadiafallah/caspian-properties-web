import { describe, expect, it, vi } from "vitest";
import { formLeadToCrm, submitChatRequest, type ChatSubmitDeps, type CrmSubmitArgs } from "@/lib/crm/submit";
import { MemoryGuard } from "@/lib/security/guard";

const NOW = new Date("2026-10-02T10:00:00Z");
const valid = {
  idempotencyKey: "0b6f4a7e-3c2d-4e1f-9a8b-7c6d5e4f3a2b",
  name: "  Sara Ahmadi ",
  phone: "۰۵۰ ۱۲۳ ۴۵۶۷",
  intent: "buy_off_plan",
  purposeText: "Looking at off-plan in Dubai Hills",
  locale: "fa",
  startedAt: NOW.getTime() - 60_000,
  website: "",
};

function setup(overrides: Partial<ChatSubmitDeps> = {}) {
  const calls: CrmSubmitArgs[] = [];
  const seen = new Set<string>();
  const store = {
    submit: vi.fn(async (args: CrmSubmitArgs) => {
      calls.push(args);
      const created = !seen.has(args.p_idempotency_key);
      seen.add(args.p_idempotency_key);
      return { created };
    }),
  };
  const deps: ChatSubmitDeps = {
    store,
    guard: new MemoryGuard(5, 600_000, () => NOW.getTime()),
    now: () => NOW,
    clientKey: "hash-a",
    ...overrides,
  };
  return { deps, store, calls };
}

describe("submitChatRequest", () => {
  it("stores name, normalised phone and purpose only", async () => {
    const { deps, calls } = setup();
    expect(await submitChatRequest(valid, deps)).toEqual({ status: "success" });
    expect(calls[0]).toEqual({
      p_idempotency_key: valid.idempotencyKey,
      p_full_name: "Sara Ahmadi",
      p_phone_e164: "+971501234567",
      p_email: null,
      p_intent: "buy_off_plan",
      p_purpose_text: "Looking at off-plan in Dubai Hills",
      p_locale: "fa",
      p_source: "chatbot",
      p_client_hash: "hash-a",
    });
  });

  it("does not require any other field", async () => {
    const { deps } = setup();
    const minimal = { idempotencyKey: valid.idempotencyKey, name: valid.name, phone: valid.phone, intent: valid.intent, locale: valid.locale, startedAt: valid.startedAt };
    expect(await submitChatRequest(minimal, deps)).toEqual({ status: "success" });
  });

  it("reports success for a retried submission without creating anything new", async () => {
    const { deps, store } = setup();
    await submitChatRequest(valid, deps);
    expect(await submitChatRequest(valid, deps)).toEqual({ status: "success" });
    expect(store.submit).toHaveBeenCalledTimes(2); // the database decides; the second call creates nothing
  });

  it("never reports success when the database is down or missing", async () => {
    const failing = { submit: vi.fn().mockRejectedValue(new Error("crm crm_submit_request failed: 503")) };
    expect(await submitChatRequest(valid, setup({ store: failing }).deps)).toEqual({ status: "unavailable" });
    expect(await submitChatRequest(valid, setup({ store: null }).deps)).toEqual({ status: "unavailable" });
  });

  it("maps the database rate limit", async () => {
    const limited = { submit: vi.fn().mockRejectedValue(new Error("crm crm_submit_request failed: 400 P0001 rate_limited")) };
    expect(await submitChatRequest(valid, setup({ store: limited }).deps)).toEqual({ status: "rate_limited" });
  });

  it("validates name, phone and intent", async () => {
    const { deps } = setup();
    expect(await submitChatRequest({ ...valid, name: "S" }, deps)).toEqual({ status: "invalid", field: "name" });
    expect(await submitChatRequest({ ...valid, phone: "12" }, deps)).toEqual({ status: "invalid", field: "phone" });
    expect(await submitChatRequest({ ...valid, intent: "admin" }, deps)).toEqual({ status: "invalid", field: "intent" });
  });

  it("ignores admin fields a visitor might add", async () => {
    const { deps, calls } = setup();
    await submitChatRequest({ ...valid, status: "won", owner_id: "x", client_id: "y" }, deps);
    expect(Object.keys(calls[0]!)).not.toContain("status");
    expect(JSON.stringify(calls[0])).not.toContain("won");
  });

  it("rejects bots: honeypot and impossible speed", async () => {
    const { deps, store } = setup();
    expect(await submitChatRequest({ ...valid, website: "spam.example" }, deps)).toEqual({ status: "rejected" });
    expect(await submitChatRequest({ ...valid, startedAt: NOW.getTime() - 500 }, deps)).toEqual({ status: "rejected" });
    expect(store.submit).not.toHaveBeenCalled();
  });

  it("logs outcomes without personal data", async () => {
    const log = vi.fn();
    await submitChatRequest(valid, setup({ log }).deps);
    const text = log.mock.calls.flat().join(" ");
    expect(text).not.toMatch(/Sara|501234567|Dubai Hills/);
  });
});

describe("formLeadToCrm", () => {
  it("maps a consultation-form lead to a CRM request", () => {
    const args = formLeadToCrm({
      lead_id: "3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7b",
      full_name: "Sara Ahmadi",
      email: "sara@example.com",
      phone: "+971 50 123 4567",
      locale: "fa",
      interest: "resale",
      purpose: "end-use",
      budget_range: "1m-2m",
      timeline: "3-6m",
      notes: "",
    });
    expect(args).toMatchObject({
      p_idempotency_key: "3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7b",
      p_phone_e164: "+971501234567",
      p_email: "sara@example.com",
      p_intent: "buy_ready",
      p_source: "consultation_form",
      p_lead_id: "3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7b",
    });
    expect(args.p_purpose_text).toContain("Budget: 1m-2m");
  });
});

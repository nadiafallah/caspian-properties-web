import { describe, expect, it, vi } from "vitest";
import { submitLead, type SubmitDeps } from "@/lib/leads/submit";
import { MemoryLeadStore } from "@/lib/leads/memory-store";
import { MemoryGuard } from "@/lib/security/guard";
import { NOW, validInput } from "./fixtures";

function deps(overrides: Partial<SubmitDeps> = {}) {
  const store = new MemoryLeadStore();
  const guard = new MemoryGuard(5, 600_000, () => NOW.getTime());
  return { store, guard, deps: { store, guard, now: () => NOW, clientKey: "client-a", ...overrides } as SubmitDeps };
}

describe("submitLead", () => {
  it("stores a valid lead and returns the handoff details", async () => {
    const { store, deps: d } = deps();
    const result = await submitLead({ ...validInput }, d);
    expect(result).toEqual({ status: "success", leadId: validInput.submissionId, firstName: "Sara", email: "sara@example.com" });
    expect(store.records).toHaveLength(1);
    expect(store.records[0]?.locale).toBe("fa");
  });

  it("records a double submission only once (idempotent)", async () => {
    const { store, deps: d } = deps();
    await submitLead({ ...validInput }, d);
    const second = await submitLead({ ...validInput }, d);
    expect(second.status).toBe("success");
    expect(store.records).toHaveLength(1);
  });

  it("rejects the honeypot and suspiciously fast submissions without storing", async () => {
    const { store, deps: d } = deps();
    expect((await submitLead({ ...validInput, website: "http://spam" }, d)).status).toBe("rejected");
    expect((await submitLead({ ...validInput, startedAt: String(NOW.getTime() - 500) }, d)).status).toBe("rejected");
    expect(store.records).toHaveLength(0);
  });

  it("returns field errors for invalid answers", async () => {
    const { deps: d } = deps();
    const result = await submitLead({ ...validInput, email: "not-an-email", consent: "" }, d);
    expect(result).toEqual({ status: "invalid", errors: { email: "email", consent: "consent" } });
  });

  it("rejects tampered hidden fields", async () => {
    const { deps: d } = deps();
    expect((await submitLead({ ...validInput, submissionId: "nope" }, d)).status).toBe("rejected");
  });

  it("rate limits repeated requests from the same client", async () => {
    const { deps: d } = deps();
    for (let i = 0; i < 5; i++) {
      await submitLead({ ...validInput, submissionId: `3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7${i}` }, d);
    }
    const result = await submitLead({ ...validInput, submissionId: "3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a79" }, d);
    expect(result.status).toBe("rate_limited");
  });

  it("never reports success when storage is not configured", async () => {
    const { deps: d } = deps({ store: null });
    expect((await submitLead({ ...validInput }, d)).status).toBe("unavailable");
  });

  it("lets the visitor retry the same submission after a storage failure", async () => {
    const { guard, store } = deps();
    const failing = { append: vi.fn().mockRejectedValue(new Error("sheets down")) };
    const first = await submitLead({ ...validInput }, { store: failing, guard, now: () => NOW, clientKey: "c" });
    expect(first.status).toBe("unavailable");
    const retry = await submitLead({ ...validInput }, { store, guard, now: () => NOW, clientKey: "c" });
    expect(retry.status).toBe("success");
    expect(store.records).toHaveLength(1);
  });

  it("fails open if the rate limiter is unreachable", async () => {
    const { store } = deps();
    const brokenGuard = {
      limit: vi.fn().mockRejectedValue(new Error("redis down")),
      claim: vi.fn().mockRejectedValue(new Error("redis down")),
      release: vi.fn().mockResolvedValue(undefined),
    };
    const result = await submitLead({ ...validInput }, { store, guard: brokenGuard, now: () => NOW, clientKey: "c" });
    expect(result.status).toBe("success");
    expect(store.records).toHaveLength(1);
  });

  it("never logs personal data", async () => {
    const log = vi.fn();
    const { deps: d } = deps({ log });
    await submitLead({ ...validInput }, d);
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).not.toContain("Sara");
    expect(logged).not.toContain("example.com");
  });
});

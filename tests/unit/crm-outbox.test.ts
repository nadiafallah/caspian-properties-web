import { describe, expect, it, vi } from "vitest";
import { buildNotification, configuredSenders, escapeHtml, processOutbox, type OutboxItem, type SendResult } from "@/lib/crm/outbox";

const item = (over: Partial<OutboxItem> = {}): OutboxItem => ({
  id: 7,
  kind: "new_request",
  channel: "email",
  dedupe_key: "new_request:abc:email",
  client: { id: "11111111-2222-4333-8444-555555555555", full_name: "Sara <b>Ahmadi</b>", phone_e164: "+971501234567", email: null },
  request: { intent: "buy_off_plan", purpose_text: "Dubai Hills & <script>", created_at: "2026-10-02T10:00:00Z", source: "chatbot", locale: "fa" },
  follow_up: null,
  latest_note: null,
  ...over,
});

describe("buildNotification", () => {
  it("includes name, number, request, Dubai time and a private case link", () => {
    const n = buildNotification(item(), { siteUrl: "https://example.test", locale: "en" });
    expect(n.subject).toBe("New enquiry: Sara <b>Ahmadi</b>");
    expect(n.text).toContain("+971 50 123 4567");
    expect(n.text).toContain("Buy — off-plan");
    expect(n.text).toMatch(/2 Oct 2026, 14:00/); // 10:00 UTC = 14:00 Dubai
    expect(n.text).toContain("https://example.test/admin/clients/11111111-2222-4333-8444-555555555555");
  });

  it("escapes visitor text in the HTML email and keeps PII out of the link", () => {
    const n = buildNotification(item(), { siteUrl: "https://example.test", locale: "fa" });
    expect(n.html).not.toContain("<script>");
    expect(n.html).toContain("&lt;script&gt;");
    expect(n.html).toContain('dir="rtl"');
    const link = n.html.match(/href="([^"]+)"/)?.[1] ?? "";
    expect(link).toBe("https://example.test/fa/admin/clients/11111111-2222-4333-8444-555555555555");
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });

  it("describes a follow-up reminder with its time and notes", () => {
    const n = buildNotification(
      item({ kind: "follow_up_due", follow_up: { due_at: "2026-10-03T05:30:00Z", note: "Send brochure" }, latest_note: "Called, interested" }),
      { siteUrl: "https://example.test", locale: "en" },
    );
    expect(n.subject).toBe("Follow-up due: Sara <b>Ahmadi</b>");
    expect(n.text).toMatch(/3 Oct 2026, 09:30/);
    expect(n.text).toContain("Send brochure");
    expect(n.text).toContain("Called, interested");
  });
});

describe("processOutbox", () => {
  it("claims only configured channels and records each result", async () => {
    const claim = vi.fn(async () => [item(), item({ id: 8, dedupe_key: "new_request:def:email" })]);
    const complete = vi.fn<(id: number, r: SendResult) => Promise<void>>(async () => {});
    const email = vi.fn<(...a: unknown[]) => Promise<SendResult>>()
      .mockResolvedValueOnce({ ok: true, providerId: "re_1" })
      .mockResolvedValueOnce({ ok: false, error: "email http 500" });
    const log = vi.fn();

    const result = await processOutbox({ claim, complete, senders: { email }, siteUrl: "https://x.test", locale: "fa", log });

    expect(claim).toHaveBeenCalledWith(["email"], 10);
    expect(result).toEqual({ sent: 1, failed: 1 });
    expect(complete).toHaveBeenCalledWith(7, { ok: true, providerId: "re_1" });
    expect(complete).toHaveBeenCalledWith(8, { ok: false, error: "email http 500" });
    expect(log.mock.calls.flat().join(" ")).not.toMatch(/Sara|50123/);
  });

  it("treats a crashing sender as a failure (retried later), never as sent", async () => {
    const complete = vi.fn(async () => {});
    await processOutbox({
      claim: async () => [item()],
      complete,
      senders: { email: async () => { throw new Error("boom"); } },
      siteUrl: "https://x.test",
      locale: "en",
    });
    expect(complete).toHaveBeenCalledWith(7, { ok: false, error: "email error" });
  });
});

describe("configuredSenders", () => {
  it("enables a channel only when all its settings exist", () => {
    expect(Object.keys(configuredSenders({}))).toEqual([]);
    expect(Object.keys(configuredSenders({ RESEND_API_KEY: "k" }))).toEqual([]);
    expect(Object.keys(configuredSenders({ RESEND_API_KEY: "k", LEAD_NOTIFY_EMAIL_TO: "a@b.c", TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1" }))).toEqual(["email", "telegram"]);
  });

  it("sends the email with the outbox key as the provider idempotency key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re_9" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { email } = configuredSenders({ RESEND_API_KEY: "k", LEAD_NOTIFY_EMAIL_TO: "nadia@example.com" });
    const result = await email!(item(), { subject: "s", text: "t", html: "h" });
    expect(result).toEqual({ ok: true, providerId: "re_9" });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("new_request:abc:email");
    vi.unstubAllGlobals();
  });
});

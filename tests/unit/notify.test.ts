import { afterEach, describe, expect, it, vi } from "vitest";
import { SHEET_COLUMNS, type LeadRecord } from "@/lib/leads/record";
import { configuredChannels, formatLeadMessage, notifyNewLead } from "@/lib/leads/notify";

const record: LeadRecord = {
  ...(Object.fromEntries(SHEET_COLUMNS.map((c) => [c, ""])) as LeadRecord),
  lead_id: "lead-1",
  full_name: "Sara Ahmadi",
  email: "sara@example.com",
  phone: "+971500000000",
  preferred_contact: "whatsapp",
  preferred_language: "fa",
  interest: "off-plan",
  purpose: "investment",
  budget_range: "2m-3500k",
  timeline: "3-6m",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("lead notifications", () => {
  it("formats readable labels and skips empty fields", () => {
    const text = formatLeadMessage(record);
    expect(text).toContain("Phone: +971500000000");
    expect(text).toContain("Contact by: WhatsApp");
    expect(text).toContain("Budget: AED 2M – 3.5M");
    expect(text).toContain("Timeline: In 3–6 months");
    expect(text).not.toContain("Notes:");
  });

  it("enables only fully configured channels", () => {
    expect(configuredChannels({})).toHaveLength(0);
    expect(configuredChannels({ TELEGRAM_BOT_TOKEN: "t" })).toHaveLength(0);
    const names = configuredChannels({
      TELEGRAM_BOT_TOKEN: "t",
      TELEGRAM_CHAT_ID: "1",
      RESEND_API_KEY: "r",
      LEAD_NOTIFY_EMAIL_TO: "a@example.com",
      CALLMEBOT_PHONE: "+971500000000",
      CALLMEBOT_APIKEY: "k",
    }).map((c) => c.name);
    expect(names).toEqual(["telegram", "email", "whatsapp"]);
  });

  it("sends to every channel and never throws, logging no personal data", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("{}")).mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(new Response("", { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const channels = configuredChannels({
      TELEGRAM_BOT_TOKEN: "t",
      TELEGRAM_CHAT_ID: "1",
      RESEND_API_KEY: "r",
      LEAD_NOTIFY_EMAIL_TO: "a@example.com",
      CALLMEBOT_PHONE: "+971500000000",
      CALLMEBOT_APIKEY: "k",
    });
    await expect(notifyNewLead(record, channels)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(String(fetch.mock.calls[2]![0])).toMatch(/^https:\/\/api\.callmebot\.com\/whatsapp\.php\?phone=%2B971/);
    const logged = errors.mock.calls.flat().join(" ");
    expect(logged).toContain("lead-1");
    expect(logged).not.toMatch(/Sara|sara@|\+9715/);
  });
});

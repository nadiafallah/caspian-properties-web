import { afterEach, describe, expect, it, vi } from "vitest";
import { aiReply, assistantReply, ruleBasedReply, systemPrompt } from "@/lib/assistant/reply";

afterEach(() => vi.unstubAllGlobals());

function openAiResponse(payload: unknown) {
  return new Response(
    JSON.stringify({ output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: JSON.stringify(payload) }] }] }),
    { status: 200 },
  );
}

describe("rule-based replies", () => {
  it("refers price and project questions to Nadia, in the visitor's language", () => {
    expect(ruleBasedReply("How much is a 2-bed in Marina?", "en").reply).toMatch(/Nadia gives them personally/);
    expect(ruleBasedReply("قیمت این پروژه چقدر است؟", "fa").reply).toMatch(/نادیا/);
    expect(ruleBasedReply("كم سعر الشقة؟", "ar").reply).toMatch(/نادية/);
  });

  it("answers general topics from the site's own copy", () => {
    expect(ruleBasedReply("Which languages do you speak?", "en").reply).toMatch(/English and Persian/);
    expect(ruleBasedReply("hello", "en").reply).toMatch(/general questions/);
  });
});

describe("AI replies", () => {
  it("parses the structured answer and never sends phone numbers", async () => {
    const fetchMock = vi.fn(async () => openAiResponse({ reply: "Nadia advises on off-plan purchases.", intent: "buy_off_plan" }));
    const result = await aiReply([{ from: "user", text: "I want off-plan, my number is +971 50 123 4567" }], "en", {
      apiKey: "sk-test",
      model: "gpt-5-mini",
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(result).toEqual({ reply: "Nadia advises on off-plan purchases.", intent: "buy_off_plan", source: "ai" });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(JSON.stringify(body.input)).not.toContain("123 4567");
    expect(body.text.format.strict).toBe(true);
    expect(body.store).toBe(false);
    expect(body.tools).toBeUndefined();
  });

  it("keeps the rules in the system prompt", () => {
    const prompt = systemPrompt("fa");
    expect(prompt).toMatch(/Never claim to be Nadia/);
    expect(prompt).toMatch(/Never state or estimate prices/);
    expect(prompt).toMatch(/Persian/);
  });

  it("falls back to rules when the AI fails, and skips AI for price questions", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const env = { OPENAI_API_KEY: "sk-test" };
    const down = await assistantReply([{ from: "user", text: "What services do you offer?" }], "en", env);
    expect(down.source).toBe("rules");
    expect(down.reply).toMatch(/Nadia advises/);

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const price = await assistantReply([{ from: "user", text: "What's the payment plan?" }], "en", env);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(price.reply).toMatch(/Nadia gives them personally/);
  });
});

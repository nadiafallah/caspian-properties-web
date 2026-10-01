import { describe, expect, it } from "vitest";
import {
  cleanName,
  detectFaqTopic,
  detectIntent,
  detectLanguage,
  extractName,
  isAdvisorOnlyTopic,
  looksLikeQuestion,
  refineIntent,
} from "@/lib/assistant/understand";

describe("detectIntent", () => {
  it.each([
    ["I want to buy an apartment", "buy"],
    ["looking to buy a ready villa", "buy_ready"],
    ["interested in off-plan projects", "buy_off_plan"],
    ["I'd like to sell my apartment", "sell"],
    ["I want to rent a flat in Marina", "rent"],
    ["I want to rent out my apartment", "let"],
    ["something about rental", "rental"],
    ["می‌خواهم آپارتمان بخرم", "buy"],
    ["میخوام یه ملک آماده بخرم", "buy_ready"],
    ["دنبال پیش‌خرید هستم", "buy_off_plan"],
    ["پیش فروش پروژه‌های جدید", "buy_off_plan"],
    ["می‌خواهم خانه‌ام را بفروشم", "sell"],
    ["میخوام آپارتمان اجاره کنم", "rent"],
    ["می‌خواهم واحدم را اجاره بدهم", "let"],
    ["درباره اجاره سوال داشتم", "rental"],
    ["أريد شراء شقة", "buy"],
    ["أبحث عن شقة جاهزة للشراء", "buy_ready"],
    ["أريد الشراء على الخارطة", "buy_off_plan"],
    ["أريد بيع شقتي", "sell"],
    ["أريد استئجار شقة", "rent"],
    ["أريد تأجير شقتي", "let"],
  ])("%s → %s", (text, intent) => {
    expect(detectIntent(text)).toBe(intent);
  });

  it("returns null for unrelated or conflicting text", () => {
    expect(detectIntent("hello")).toBeNull();
    expect(detectIntent("سلام")).toBeNull();
    expect(detectIntent("buy or sell, not sure")).toBeNull();
  });
});

describe("refineIntent", () => {
  it("resolves the ready/off-plan and rent/let questions in three languages", () => {
    expect(refineIntent("buy", "Ready please")).toBe("buy_ready");
    expect(refineIntent("buy", "آف‌پلن")).toBe("buy_off_plan");
    expect(refineIntent("buy", "على الخارطة")).toBe("buy_off_plan");
    expect(refineIntent("buy", "نمی‌دانم")).toBe("unsure");
    expect(refineIntent("rental", "I want to rent out my flat")).toBe("let");
    expect(refineIntent("rental", "لا أعرف")).toBe("unsure");
    expect(refineIntent("buy", "blue")).toBeNull();
  });
});

describe("language, questions and topics", () => {
  it("detects the language from the script", () => {
    expect(detectLanguage("Hello there")).toBe("en");
    expect(detectLanguage("سلام، وقت بخیر")).toBe("fa");
    expect(detectLanguage("مرحبا، أريد شقة")).toBe("ar");
    expect(detectLanguage("+971 52")).toBeNull();
    expect(detectLanguage("+۹۷۱ ۵۲ ۸۸۷ ۷۲۰۰")).toBeNull();
    expect(detectLanguage("٠٥٠ ١٢٣ ٤٥٦٧")).toBeNull();
  });

  it("spots questions and topics that only Nadia answers", () => {
    expect(looksLikeQuestion("What services do you offer?")).toBe(true);
    expect(looksLikeQuestion("قیمت آپارتمان چقدر است")).toBe(true);
    expect(isAdvisorOnlyTopic("What is the price of a 2-bed in Marina?")).toBe(true);
    expect(isAdvisorOnlyTopic("پیمنت پلن این پروژه چطوره؟ قسط‌ها")).toBe(true);
    expect(isAdvisorOnlyTopic("كم سعر الشقة؟")).toBe(true);
    expect(isAdvisorOnlyTopic("Which languages do you speak?")).toBe(false);
    expect(detectFaqTopic("Which languages do you speak?")).toBe("languages");
    expect(detectFaqTopic("چه خدماتی دارید؟")).toBe("services");
  });

  it("extracts a volunteered name, and validates a typed one", () => {
    expect(extractName("Hi, my name is Sara Ahmadi")).toBe("Sara Ahmadi");
    expect(extractName("سلام اسمم سارا است")).toBe("سارا");
    expect(extractName("I want to buy")).toBeNull();
    expect(cleanName("  Sara  ")).toBe("Sara");
    expect(cleanName("0501234567")).toBeNull();
    expect(cleanName("a")).toBeNull();
  });
});

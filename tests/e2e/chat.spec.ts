import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { uniqueClient } from "./helpers";

// Runs against the in-memory store (see playwright.config.ts): no real data is written.

const NADIA = "971528877200";

const L = {
  en: {
    prefix: "",
    launcher: "Ask the assistant",
    dialog: "Caspian smart assistant",
    buttons: ["Buy a ready property", "Buy off-plan", "Sell my property", "Rent a property", "Let out my property"],
    askName: "What name should Nadia use",
    send: "Send",
    input: "Your message",
    submit: "Submit call request",
    success: "Your request has been recorded",
  },
  fa: {
    prefix: "/fa",
    launcher: "گفتگو با دستیار",
    dialog: "دستیار هوشمند کاسپین",
    buttons: ["خرید ملک آماده", "خرید آف‌پلن / پیش‌خرید", "فروش ملک من", "اجاره کردن ملک", "اجاره دادن ملک من"],
    askName: "نادیا هنگام تماس",
    send: "ارسال",
    input: "پیام شما",
    submit: "ثبت درخواست تماس",
    success: "درخواست شما ثبت شد",
  },
  ar: {
    prefix: "/ar",
    launcher: "تحدّث مع المساعد",
    dialog: "مساعد كاسبين الذكي",
    buttons: ["شراء عقار جاهز", "شراء على الخارطة", "بيع عقاري", "استئجار عقار", "تأجير عقاري"],
    askName: "ما الاسم الذي تستخدمه نادية",
    send: "إرسال",
    input: "رسالتك",
    submit: "إرسال طلب الاتصال",
    success: "تم تسجيل طلبك",
  },
} as const;

async function openChat(page: Page, lang: keyof typeof L) {
  await uniqueClient(page);
  await page.goto(L[lang].prefix || "/");
  await page.evaluate(() => sessionStorage.clear());
  await page.getByRole("button", { name: L[lang].launcher }).click();
  const dialog = page.getByRole("dialog", { name: L[lang].dialog });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function say(page: Page, lang: keyof typeof L, text: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: L[lang].input }).fill(text);
  await dialog.getByRole("button", { name: L[lang].send }).click();
}

for (const lang of ["en", "fa", "ar"] as const) {
  test(`chat (${lang}): every route button leads to the name question, in the right direction`, async ({ page }) => {
    const dialog = await openChat(page, lang);
    await expect(dialog).toHaveAttribute("dir", lang === "en" ? "ltr" : "rtl");
    await expect(dialog.locator(`a[href="tel:+${NADIA}"]`).first()).toBeVisible();
    for (const [i, label] of L[lang].buttons.entries()) {
      if (i > 0) {
        await page.evaluate(() => sessionStorage.clear());
        await page.reload();
        await page.getByRole("button", { name: L[lang].launcher }).click();
      }
      const d = page.getByRole("dialog");
      await d.getByRole("button", { name: label, exact: true }).click();
      await expect(d.getByText(L[lang].askName).last()).toBeVisible();
    }
  });
}

test("chat (en): full request with buttons, Persian digits and direct-contact actions", async ({ page }) => {
  const dialog = await openChat(page, "en");
  await expect(dialog.getByRole("link", { name: "Call Nadia" })).toHaveAttribute("href", `tel:+${NADIA}`);
  await expect(dialog.getByRole("link", { name: "WhatsApp Nadia" })).toHaveAttribute("href", `https://wa.me/${NADIA}`);

  await dialog.getByRole("button", { name: "Sell my property", exact: true }).click();
  await say(page, "en", "Test Visitor");
  await say(page, "en", "+۹۷۱ ۵۰ ۱۲۳ ۴۵۶۷");

  const summary = dialog.getByRole("region", { name: "Please check your details" });
  await expect(summary).toContainText("Test Visitor");
  await expect(summary).toContainText("+971 50 123 4567");
  await expect(summary).toContainText("Sell my property");
  await expect(summary).toContainText("This information is stored so Nadia can follow up your request.");

  // Correct the name before submitting.
  await summary.getByRole("button", { name: "Change: Name" }).click();
  await say(page, "en", "Test Visitor Two");
  await expect(summary).toContainText("Test Visitor Two");

  await page.waitForTimeout(3100);
  await summary.getByRole("button", { name: "Submit call request" }).dblclick();
  await expect(dialog.getByText("Thank you, Test Visitor Two. Your request has been recorded")).toBeVisible();

  const call = dialog.getByRole("link", { name: /Call Nadia \+971 52 887 7200/ });
  await expect(call).toHaveAttribute("href", `tel:+${NADIA}`);
  const wa = dialog.getByRole("link", { name: "Open WhatsApp" });
  const href = (await wa.getAttribute("href")) ?? "";
  expect(href.startsWith(`https://wa.me/${NADIA}?text=`)).toBe(true);
  expect(decodeURIComponent(href.split("text=")[1]!)).toContain("Test Visitor Two");

  const draft = dialog.getByRole("textbox", { name: "Your WhatsApp message (you can edit it)" });
  await draft.fill("Hello & welcome?");
  await expect(wa).toHaveAttribute("href", `https://wa.me/${NADIA}?text=${encodeURIComponent("Hello & welcome?")}`);
});

test("chat (fa): free text, clarifying question and Persian-digit number", async ({ page }) => {
  const dialog = await openChat(page, "fa");
  await say(page, "fa", "سلام، می‌خواهم آپارتمان بخرم");
  await expect(dialog.getByText("دنبال ملک آماده هستید یا آف‌پلن").last()).toBeVisible();
  await dialog.getByRole("button", { name: "آف‌پلن", exact: true }).click();
  // A Latin-script name is an answer, not a request to switch the chat to English.
  await say(page, "fa", "Test Guest");
  await expect(dialog).toHaveAttribute("dir", "rtl");
  await say(page, "fa", "۰۵۰ ۱۲۳ ۴۵۶۷");
  const summary = dialog.getByRole("region", { name: "لطفاً اطلاعات خود را بررسی کنید" });
  await expect(summary).toContainText("خرید آف‌پلن / پیش‌خرید");
  await expect(summary).toContainText("+971 50 123 4567");
  await page.waitForTimeout(3100);
  await summary.getByRole("button", { name: "ثبت درخواست تماس" }).click();
  await expect(dialog.getByText(L.fa.success)).toBeVisible();
});

test("chat (ar): free-text rental request and an ambiguous number needing a country", async ({ page }) => {
  const dialog = await openChat(page, "ar");
  await say(page, "ar", "أريد استئجار شقة");
  await expect(dialog.getByText(L.ar.askName).last()).toBeVisible();
  await say(page, "ar", "زائر تجريبي");
  await say(page, "ar", "4155552671");
  await expect(dialog.getByText("من أي دولة هذا الرقم؟").last()).toBeVisible();
  await dialog.getByRole("button", { name: "دولة أخرى" }).click();
  await say(page, "ar", "+1 415 555 2671");
  const summary = dialog.getByRole("region", { name: "يُرجى مراجعة بياناتك" });
  await expect(summary).toContainText("استئجار عقار");
  await expect(summary).toContainText("+1 415 555 2671");
});

test("chat: switches to the visitor's language, and price questions go to Nadia", async ({ page }) => {
  await openChat(page, "en");
  // The dialog's name follows the chat language, so find it by role only.
  const dialog = page.getByRole("dialog");
  await say(page, "en", "قیمت آپارتمان در مارینا چقدر است؟");
  await expect(dialog).toHaveAttribute("dir", "rtl");
  await expect(dialog.getByText(/نادیا این اطلاعات را دقیق و به‌روز، شخصاً به شما می‌دهد/)).toBeVisible();
  await expect(dialog.getByText(/AED|درهم|\d{3,}/)).toHaveCount(0);

  await dialog.getByRole("button", { name: "EN" }).click();
  await expect(dialog).toHaveAttribute("dir", "ltr");
});

test("chat: keyboard — Escape closes and returns focus to the launcher", async ({ page }) => {
  await openChat(page, "en");
  await page.keyboard.press("Escape");
  const launcher = page.getByRole("button", { name: "Ask the assistant" });
  await expect(launcher).toBeFocused();
});

test("chat: no serious accessibility violations with the chat open (RTL)", async ({ page }) => {
  await openChat(page, "fa");
  const results = await new AxeBuilder({ page }).include(".chat-panel").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});

test("private panel and worker are closed to the public", async ({ page, request }) => {
  await page.goto("/fa/admin/clients");
  await expect(page).toHaveURL(/\/fa\/admin\/login$/);
  await expect(page.getByRole("heading", { name: "ورود به پنل مشتریان" })).toBeVisible();
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots).toContain("noindex");

  const worker = await request.post("/api/crm/worker", { headers: { Authorization: `Bearer ${"a".repeat(64)}` } });
  expect([401, 503]).toContain(worker.status());
  const workerNoToken = await request.post("/api/crm/worker");
  expect([401, 503]).toContain(workerNoToken.status());
});

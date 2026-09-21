import { expect, test, type Page } from "@playwright/test";
import { breakCalEmbed, stubCalEmbed, uniqueClient } from "./helpers";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function completeStepOne(page: Page) {
  await page.getByRole("textbox", { name: "Full name" }).fill("Test Visitor");
  await page.getByRole("textbox", { name: "Email" }).fill("visitor@example.test");
  await page.getByRole("radio", { name: "Email", exact: true }).check();
  await page.getByRole("radio", { name: "English" }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Your property goals" })).toBeFocused();
}

async function completeStepTwo(page: Page) {
  await page.getByRole("radio", { name: "Off-plan property" }).check();
  await page.getByLabel("Main purpose").selectOption("investment");
  // Every option must show its translated label (guards against missing-message keys).
  await expect(page.getByLabel("Approximate budget").locator("option")).toHaveText([
    "Choose an option",
    "Under AED 1M",
    "AED 1M – 2M",
    "AED 2M – 3.5M",
    "AED 3.5M – 5M",
    "AED 5M – 10M",
    "Over AED 10M",
    "I’d rather discuss it in the consultation",
  ]);
  await page.getByLabel("Approximate budget").selectOption("2m-3500k");
  await page.getByLabel("When do you expect to decide?").selectOption("3-6m");
  await page.getByRole("checkbox").check();
  // The server rejects forms completed in under three seconds (bot protection).
  await page.waitForTimeout(3100);
  await page.getByRole("button", { name: "Continue to scheduling" }).click();
}

const consoleErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  await uniqueClient(page);
  const errors: string[] = [];
  consoleErrors.set(page, errors);
  page.on("console", (msg) => {
    // A failed embed load is expected in the fallback test.
    if (msg.type() === "error" && !msg.text().includes("net::ERR_FAILED")) errors.push(msg.text());
  });
});

test.afterEach(async ({ page }) => {
  expect(consoleErrors.get(page) ?? []).toEqual([]);
});

test("shows an error summary and inline errors for missing answers", async ({ page }) => {
  await page.goto("/consultation");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const summary = page.getByRole("alert").filter({ hasText: "Please check the following:" });
  await expect(summary).toBeFocused();
  await expect(summary.getByRole("link")).toHaveCount(4);
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveAttribute("aria-invalid", "true");

  // Choosing WhatsApp makes the phone number required.
  await page.getByRole("radio", { name: "WhatsApp" }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(summary).toContainText("Please add a phone number");
});

test("a completed form unlocks Cal.com scheduling and ends on the thank-you page", async ({ page }) => {
  await stubCalEmbed(page);
  await page.goto("/consultation");
  await completeStepOne(page);
  await completeStepTwo(page);

  await expect(page.getByRole("heading", { level: 2, name: "Choose a time" })).toBeVisible();
  await expect(page.getByText("Thank you, Test. Your details are saved.")).toBeVisible();
  const book = page.getByTestId("cal-stub-book");
  await expect(book).toBeVisible();

  // Only non-sensitive prefill and the lead id reach Cal.com.
  const config = await page.evaluate(() => (window as unknown as { __calStub: { config: Record<string, string> } }).__calStub.config);
  expect(config.email).toBe("visitor@example.test");
  expect(config.name).toBe("Test Visitor");
  expect(config["metadata[leadId]"]).toMatch(UUID);
  expect(Object.keys(config).sort()).toEqual(["email", "layout", "metadata[leadId]", "name", "theme"]);

  await book.click();
  await expect(page).toHaveURL(/\/consultation\/thank-you$/);
  await expect(page.locator("h1")).toContainText("your consultation is booked");
});

test("scheduling is not reachable before the form is submitted", async ({ page }) => {
  await stubCalEmbed(page);
  await page.goto("/consultation");
  await expect(page.getByTestId("cal-stub-book")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Choose a time" })).toHaveCount(0);
});

test("offers the booking link and direct contact when Cal.com fails to load", async ({ page }) => {
  test.setTimeout(90_000);
  await breakCalEmbed(page);
  await page.goto("/consultation");
  await completeStepOne(page);
  await completeStepTwo(page);

  const fallback = page.getByRole("alert").filter({ hasText: "Calendar not loading?" });
  await expect(fallback).toBeVisible({ timeout: 20_000 });
  const link = fallback.getByRole("link", { name: /Open the booking page/ });
  await expect(link).toHaveAttribute("href", /cal\.com\/e2e-test\/private-consultation\?metadata%5BleadId%5D=/);
  await expect(fallback.getByRole("link", { name: "@caspian_properties" })).toBeVisible();
});

test("answers survive switching language mid-form", async ({ page }) => {
  await page.goto("/consultation");
  await page.getByRole("textbox", { name: "Full name" }).fill("Draft Visitor");
  await page.getByRole("main").getByRole("link", { name: "فارسی" }).click();
  await expect(page).toHaveURL(/\/fa\/consultation$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("textbox", { name: "نام و نام خانوادگی" })).toHaveValue("Draft Visitor");
});

test("the whole funnel works with the keyboard alone", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow is a desktop check");
  await stubCalEmbed(page);
  await page.goto("/consultation");
  await page.locator("#cf-fullName").focus();
  await page.keyboard.type("Keyboard User");
  await page.keyboard.press("Tab");
  await page.keyboard.type("kb@example.test");
  await page.keyboard.press("Tab"); // contact channel group
  await page.keyboard.press("Space"); // Email
  await page.keyboard.press("Tab"); // phone
  await page.keyboard.press("Tab"); // location
  await page.keyboard.press("Tab"); // consultation language group
  await page.keyboard.press("Space"); // English
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "Your property goals" })).toBeFocused();

  await page.keyboard.press("Tab"); // interest group
  await page.keyboard.press("Space"); // Off-plan
  await page.keyboard.press("Tab");
  await page.keyboard.type("Inv"); // purpose → Investment
  await page.keyboard.press("Tab");
  await page.keyboard.type("Under"); // budget
  await page.keyboard.press("Tab");
  await page.keyboard.type("Within"); // timeline
  await page.keyboard.press("Tab"); // decision makers (optional)
  await page.keyboard.press("Tab"); // notes
  await page.keyboard.press("Tab"); // referral
  await page.keyboard.press("Tab"); // consent
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page.waitForTimeout(3100);
  await page.getByRole("button", { name: "Continue to scheduling" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { level: 2, name: "Choose a time" })).toBeFocused();
  await page.getByTestId("cal-stub-book").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/consultation\/thank-you$/);
});

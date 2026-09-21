import { expect, test } from "@playwright/test";
import { LOCALE_PREFIXES, PAGES, url } from "./helpers";

test.describe("language and direction", () => {
  test.use({ locale: "fa-IR" });

  test("visitors always enter in English, even with a Persian browser", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    expect(page.url()).not.toContain("/fa");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    const cookies = await page.context().cookies();
    expect(cookies.filter((c) => c.name.includes("LOCALE"))).toHaveLength(0);
  });
});

for (const [prefix, lang, dir] of [
  ["", "en", "ltr"],
  ["/fa", "fa", "rtl"],
  ["/ar", "ar", "rtl"],
] as const) {
  test(`every page renders with lang=${lang} dir=${dir}, one h1 and no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`${page.url()}: ${msg.text()}`);
    });
    for (const pagePath of PAGES) {
      const response = await page.goto(url(prefix, pagePath));
      expect(response?.status(), url(prefix, pagePath)).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("html")).toHaveAttribute("dir", dir);
      await expect(page.locator("h1")).toHaveCount(1);
    }
    expect(errors).toEqual([]);
  });
}

test("switching language keeps the current page", async ({ page, isMobile }) => {
  await page.goto("/about");
  if (isMobile) {
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("link", { name: "فارسی" }).first().click();
  } else {
    await page.getByRole("button", { name: /Choose language/ }).click();
    await page.getByRole("link", { name: "فارسی" }).first().click();
  }
  await expect(page).toHaveURL(/\/fa\/about$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  // Back to English from the footer switcher.
  await page.locator("footer").getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("hreflang alternates and canonical are present", async ({ page }) => {
  await page.goto("/fa/approach");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/fa\/approach$/);
  for (const lang of ["en", "fa", "ar", "x-default"]) {
    await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
  }
});

test("main navigation reaches each section", async ({ page, isMobile }) => {
  await page.goto("/");
  for (const name of ["About", "How I advise", "Client journey", "Contact"]) {
    if (isMobile) await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true }).click();
    await expect(page.locator("h1")).toBeVisible();
    // The mobile menu closes after navigating; reopen it to inspect the current-page marker.
    if (isMobile) await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    if (isMobile) await page.keyboard.press("Escape");
  }
});

test("unknown pages show a localised 404", async ({ page }) => {
  const response = await page.goto("/fa/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("صفحه پیدا نشد");
});

test("no broken internal links", async ({ page, request }) => {
  const seen = new Set<string>();
  for (const prefix of LOCALE_PREFIXES) {
    for (const pagePath of PAGES) {
      await page.goto(url(prefix, pagePath));
      const hrefs = await page.$$eval("a[href^='/']", (links) => links.map((a) => a.getAttribute("href") ?? ""));
      for (const href of hrefs) seen.add(href.split("#")[0] || "/");
    }
  }
  for (const href of seen) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
  }
});

test("licence details and DLD verification link are shown", async ({ page }) => {
  await page.goto("/about");
  const licence = page.locator("#licence");
  await expect(licence).toContainText("70350");
  await expect(licence).toContainText("557");
  await expect(licence.getByRole("link", { name: /Verify with the Dubai Land Department/ })).toHaveAttribute(
    "href",
    /dubailand\.gov\.ae/,
  );
  await expect(licence.getByRole("img", { name: /broker card/ })).toBeVisible();
});

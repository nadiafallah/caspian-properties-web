import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LOCALE_PREFIXES, PAGES, url } from "./helpers";

// Automated WCAG 2.2 AA checks (serious/critical). Manual checks are listed in docs/LAUNCH_CHECKLIST.md.
for (const prefix of LOCALE_PREFIXES) {
  for (const pagePath of PAGES) {
    const target = url(prefix, pagePath);
    test(`axe: ${target}`, async ({ page }) => {
      await page.goto(target);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        blocking.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
      ).toEqual([]);
    });
  }
}

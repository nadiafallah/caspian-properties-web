import path from "node:path";
import type { Page } from "@playwright/test";

const STUB = path.join(__dirname, "cal-embed-stub.js");

/** Serve the local Cal.com stub instead of the real embed script. */
export async function stubCalEmbed(page: Page) {
  await page.route("**/embed/embed.js", (route) =>
    route.fulfill({ path: STUB, contentType: "application/javascript" }),
  );
}

/** Make the Cal.com embed script fail to load. */
export async function breakCalEmbed(page: Page) {
  await page.route("**/embed/embed.js", (route) => route.abort("failed"));
}

/** Each test gets its own client IP so the rate limiter doesn't couple tests. */
export async function uniqueClient(page: Page) {
  const ip = `10.${rand()}.${rand()}.${rand()}`;
  await page.setExtraHTTPHeaders({ "x-real-ip": ip });
}

const rand = () => Math.floor(Math.random() * 250) + 1;

export const LOCALE_PREFIXES = ["", "/fa", "/ar"] as const;
export const PAGES = ["/", "/about", "/approach", "/client-journey", "/contact", "/consultation", "/privacy", "/terms"] as const;

export function url(prefix: string, pagePath: string) {
  if (!prefix) return pagePath;
  return pagePath === "/" ? prefix : `${prefix}${pagePath}`;
}

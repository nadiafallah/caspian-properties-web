import type { MetadataRoute } from "next";
import { locales } from "@/i18n/locales";
import { absoluteUrl } from "@/lib/seo";
import { publishedInsights, publishedOpportunities } from "@/content";

const paths = [
  "/",
  "/about",
  "/approach",
  "/client-journey",
  "/contact",
  "/consultation",
  "/privacy",
  "/terms",
  ...(publishedOpportunities.length ? ["/opportunities"] : []),
  ...(publishedInsights.length ? ["/insights"] : []),
];

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((path) => ({
    url: absoluteUrl("en", path),
    alternates: {
      languages: {
        ...Object.fromEntries(locales.map((locale) => [locale, absoluteUrl(locale, path)])),
        "x-default": absoluteUrl("en", path),
      },
    },
  }));
}

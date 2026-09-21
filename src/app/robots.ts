import type { MetadataRoute } from "next";
import { allowIndexing, siteUrl } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  // Preview deployments (and launch sites on a temporary address) are never crawled.
  if (!allowIndexing) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/credentials/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

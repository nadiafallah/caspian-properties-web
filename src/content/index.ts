import { z } from "zod";
import { insightSchema, opportunitySchema, type Insight, type Opportunity } from "./schema";

/**
 * Curated content. Intentionally empty: nothing is published until every fact is
 * verified, sourced and dated, and each opportunity has its own Trakheesi permit.
 * See docs/CONTENT_INVENTORY.md → "Adding a verified opportunity or insight".
 */
const opportunities: unknown[] = [];
const insights: unknown[] = [];

// Validation runs at build time; an invalid entry fails the build instead of reaching the site.
export const publishedOpportunities: Opportunity[] = z.array(opportunitySchema).parse(opportunities);
export const publishedInsights: Insight[] = z.array(insightSchema).parse(insights);

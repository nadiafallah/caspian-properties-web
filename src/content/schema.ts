import { z } from "zod";

/** Every number shown publicly must say what kind of number it is (brand guide §3.7). */
export const claimType = z.enum(["asking", "registered", "forecast", "illustrative", "developer-provided"]);

const localized = z.object({ en: z.string().min(1), fa: z.string().min(1), ar: z.string().min(1) });

const sourcedFact = z.object({
  label: localized,
  value: z.string().min(1),
  claimType,
  source: z.string().min(1),
  sourceDate: z.iso.date(),
});

/**
 * A curated opportunity. Publication requires the full compliance strip; items missing
 * any required field fail validation and are never rendered.
 */
export const opportunitySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: localized,
  community: z.string().min(1),
  developer: z.string().min(1),
  thesis: localized,
  facts: z.array(sourcedFact).min(1),
  imageIsRender: z.boolean(),
  lastUpdated: z.iso.date(),
  compliance: z.object({
    trakheesiPermit: z.string().min(1),
    madmounQr: z.string().min(1).optional(),
    orn: z.string().min(1),
    brn: z.string().min(1),
  }),
});

export const insightSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: localized,
  summary: localized,
  pillar: z.enum(["market-signal", "decision-lens", "dubai-explained", "project-in-context", "nadias-view", "legacy-access"]),
  sources: z.array(z.object({ name: z.string().min(1), url: z.url().optional(), date: z.iso.date() })).min(1),
  publishedOn: z.iso.date(),
  lastUpdated: z.iso.date(),
});

export type Opportunity = z.infer<typeof opportunitySchema>;
export type Insight = z.infer<typeof insightSchema>;

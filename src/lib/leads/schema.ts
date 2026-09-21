import { z } from "zod";
import { consultationLanguages } from "@/config/site";
import { locales } from "@/i18n/locales";

// Option values are stable storage codes; labels live in the message files.
export const channels = ["email", "phone", "whatsapp"] as const;
export const interests = ["off-plan", "resale", "leasing", "holiday-home", "not-sure"] as const;
export const purposes = ["investment", "end-use", "relocation", "family-planning", "diversification", "other"] as const;
export const saleBudgets = ["under-1m", "1m-2m", "2m-3500k", "3500k-5m", "5m-10m", "over-10m", "prefer-not"] as const;
export const rentBudgets = [
  "rent-under-100k",
  "rent-100k-200k",
  "rent-200k-350k",
  "rent-350k-500k",
  "rent-over-500k",
  "prefer-not",
] as const;
export const budgets = [...new Set([...saleBudgets, ...rentBudgets])] as [string, ...string[]];
export const timelines = ["within-3m", "3-6m", "6-12m", "over-12m", "exploring"] as const;
export const decisionMakers = ["just-me", "partner", "family", "advisors"] as const;
export const referrals = ["instagram", "referral", "search", "event", "other"] as const;

export const NAME_MAX = 120;
export const LOCATION_MAX = 120;
export const NOTES_MAX = 1000;

export type Interest = (typeof interests)[number];
export type Budget = (typeof saleBudgets)[number] | (typeof rentBudgets)[number];

/** Budget bands shown for an interest: annual rent for leasing, purchase price otherwise. */
export function budgetOptionsFor(interest: Interest | "" | undefined): readonly Budget[] {
  return interest === "leasing" ? rentBudgets : saleBudgets;
}

// Issue messages are keys under Consultation.errors.* and are translated in the UI.
const optionalText = (max: number, message: string) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max, message).optional());

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), z.enum(values).optional());

export const stepOneShape = {
  fullName: z.string({ error: "fullName" }).trim().min(2, "fullName").max(NAME_MAX, "fullName"),
  email: z
    .string({ error: "email" })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "email" }).max(254, "email")),
  phone: optionalText(24, "phone"),
  location: optionalText(LOCATION_MAX, "location"),
  consultationLanguage: z.enum(consultationLanguages, { error: "choose" }),
  contactChannel: z.enum(channels, { error: "choose" }),
};

export const stepTwoShape = {
  interest: z.enum(interests, { error: "choose" }),
  purpose: z.enum(purposes, { error: "choose" }),
  budget: z.enum(budgets, { error: "choose" }),
  timeline: z.enum(timelines, { error: "choose" }),
  decisionMakers: optionalEnum(decisionMakers),
  notes: optionalText(NOTES_MAX, "notes"),
  referral: optionalEnum(referrals),
  consent: z.literal("yes", { error: "consent" }),
};

const PHONE_PATTERN = /^\+[1-9][0-9 ()-]{6,22}$/;

type StepOne = z.infer<z.ZodObject<typeof stepOneShape>>;
type StepTwo = z.infer<z.ZodObject<typeof stepTwoShape>>;

function refineContact(value: Partial<StepOne>, ctx: z.RefinementCtx) {
  const needsPhone = value.contactChannel === "phone" || value.contactChannel === "whatsapp";
  if (value.phone && !PHONE_PATTERN.test(value.phone)) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "phone" });
  } else if (needsPhone && !value.phone) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "phoneRequired" });
  }
}

function refineBudget(value: Partial<StepTwo>, ctx: z.RefinementCtx) {
  if (value.budget && value.interest && !(budgetOptionsFor(value.interest) as readonly string[]).includes(value.budget)) {
    ctx.addIssue({ code: "custom", path: ["budget"], message: "choose" });
  }
}

export const stepOneSchema = z.object(stepOneShape).superRefine(refineContact);
export const stepTwoSchema = z.object(stepTwoShape).superRefine(refineBudget);

/** Hidden, non-user fields captured with every submission. */
export const metaShape = {
  submissionId: z.uuid(),
  startedAt: z.coerce.number().int().nonnegative(),
  website: z.string().max(200).optional(), // honeypot — must stay empty
  locale: z.enum(locales),
  sourcePage: optionalText(200, "invalid"),
  utm_source: optionalText(200, "invalid"),
  utm_medium: optionalText(200, "invalid"),
  utm_campaign: optionalText(200, "invalid"),
  utm_content: optionalText(200, "invalid"),
  utm_term: optionalText(200, "invalid"),
};

export const consultationSchema = z
  .object({ ...stepOneShape, ...stepTwoShape, ...metaShape })
  .superRefine((value, ctx) => {
    refineContact(value, ctx);
    refineBudget(value, ctx);
  });

export type ConsultationInput = z.infer<typeof consultationSchema>;
export type FieldName = keyof typeof stepOneShape | keyof typeof stepTwoShape;
export const stepOneFields = Object.keys(stepOneShape) as FieldName[];
export const stepTwoFields = Object.keys(stepTwoShape) as FieldName[];

export type FieldErrors = Partial<Record<FieldName, string>>;

// Cross-field checks, run even when other fields are invalid so every problem is reported at once.
function crossFieldErrors(values: Record<string, unknown>): FieldErrors {
  const out: FieldErrors = {};
  const phone = typeof values.phone === "string" ? values.phone.trim() : "";
  const needsPhone = values.contactChannel === "phone" || values.contactChannel === "whatsapp";
  if (phone && !PHONE_PATTERN.test(phone)) out.phone = "phone";
  else if (needsPhone && !phone) out.phone = "phoneRequired";

  const interest = values.interest as Interest | undefined;
  const budget = typeof values.budget === "string" ? values.budget : "";
  if (budget && interest && (interests as readonly string[]).includes(interest) && !(budgetOptionsFor(interest) as readonly string[]).includes(budget)) {
    out.budget = "choose";
  }
  return out;
}

function validateShape(shape: z.ZodRawShape, fields: FieldName[], values: Record<string, unknown>): FieldErrors {
  const result = z.object(shape).safeParse(values);
  const cross = Object.fromEntries(Object.entries(crossFieldErrors(values)).filter(([k]) => fields.includes(k as FieldName)));
  return { ...cross, ...(result.success ? {} : fieldErrors(result.error)) };
}

export const validateStepOne = (values: Record<string, unknown>) => validateShape(stepOneShape, stepOneFields, values);
export const validateStepTwo = (values: Record<string, unknown>) => validateShape(stepTwoShape, stepTwoFields, values);

/** Maps Zod issues to { field: messageKey }, keeping the first issue per field. */
export function fieldErrors(error: z.ZodError): Partial<Record<FieldName, string>> {
  const out: Partial<Record<FieldName, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as FieldName | undefined;
    if (field && !(field in out) && (stepOneFields.includes(field) || stepTwoFields.includes(field))) {
      out[field] = issue.message;
    }
  }
  return out;
}

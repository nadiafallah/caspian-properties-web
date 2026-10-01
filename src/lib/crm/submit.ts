import { z } from "zod";
import { locales, type AppLocale } from "@/i18n/locales";
import { intents, type Intent } from "@/lib/assistant/understand";
import { normalizePhone } from "./phone";

export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const PURPOSE_MAX = 500;
/** Humans cannot reach the confirmation step this fast; scripts can. */
export const MIN_CHAT_MS = 3000;

const clean = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

export const chatSubmissionSchema = z.object({
  idempotencyKey: z.uuid(),
  name: z.string().transform(clean).pipe(z.string().min(NAME_MIN).max(NAME_MAX)),
  phone: z.string().max(40),
  intent: z.enum(intents),
  purposeText: z.string().max(2000).optional().transform((v) => (v ? clean(v).slice(0, PURPOSE_MAX) : "")),
  locale: z.enum(locales),
  startedAt: z.number().int().nonnegative(),
  website: z.string().max(200).optional(), // honeypot — must stay empty
});

export type ChatSubmission = z.input<typeof chatSubmissionSchema>;

export type ChatSubmitResult =
  | { status: "success" }
  | { status: "invalid"; field: "name" | "phone" | "intent" }
  | { status: "rate_limited" }
  | { status: "rejected" }
  | { status: "unavailable" };

export type CrmSubmitArgs = {
  p_idempotency_key: string;
  p_full_name: string;
  p_phone_e164: string | null;
  p_email: string | null;
  p_intent: Intent | "other";
  p_purpose_text: string;
  p_locale: AppLocale;
  p_source: "chatbot" | "consultation_form";
  p_lead_id?: string | null;
  p_client_hash?: string | null;
};

export type ChatSubmitDeps = {
  /** null when the database is not configured. */
  store: { submit(args: CrmSubmitArgs): Promise<{ created: boolean }> } | null;
  guard: { limit(key: string): Promise<boolean> };
  now: () => Date;
  /** Hashed client identifier (never the raw IP). */
  clientKey: string;
  log?: (message: string) => void;
};

/**
 * Records an assistant enquiry. Pure apart from the injected deps. Success is only
 * reported after the database confirmed the write (or confirmed it already had it).
 * Logs contain only outcomes — never names or numbers.
 */
export async function submitChatRequest(raw: unknown, deps: ChatSubmitDeps): Promise<ChatSubmitResult> {
  const log = deps.log ?? (() => {});

  if (raw && typeof raw === "object" && typeof (raw as { website?: unknown }).website === "string" && (raw as { website: string }).website.trim()) {
    log("[crm] rejected: honeypot");
    return { status: "rejected" };
  }

  const parsed = chatSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "name" || field === "phone" || field === "intent") return { status: "invalid", field };
    return { status: "rejected" };
  }
  const input = parsed.data;

  const phone = normalizePhone(input.phone);
  if (phone.status !== "ok") return { status: "invalid", field: "phone" };

  if (deps.now().getTime() - input.startedAt < MIN_CHAT_MS) {
    log("[crm] rejected: too fast");
    return { status: "rejected" };
  }

  const allowed = await deps.guard.limit(deps.clientKey).catch(() => true);
  if (!allowed) {
    log("[crm] rate limited");
    return { status: "rate_limited" };
  }

  if (!deps.store) return { status: "unavailable" };

  try {
    const { created } = await deps.store.submit({
      p_idempotency_key: input.idempotencyKey,
      p_full_name: input.name,
      p_phone_e164: phone.e164,
      p_email: null,
      p_intent: input.intent,
      p_purpose_text: input.purposeText,
      p_locale: input.locale,
      p_source: "chatbot",
      p_client_hash: deps.clientKey,
    });
    log(`[crm] chat request ${created ? "stored" : "duplicate"} ${input.idempotencyKey}`);
    return { status: "success" };
  } catch (error) {
    if (error instanceof Error && /rate_limited/.test(error.message)) {
      log("[crm] rate limited by database");
      return { status: "rate_limited" };
    }
    log(`[crm] storage failed for ${input.idempotencyKey}`);
    return { status: "unavailable" };
  }
}

const FORM_INTENTS: Record<string, Intent | "other"> = {
  "off-plan": "buy_off_plan",
  resale: "buy_ready",
  leasing: "rental",
};

/** Maps a stored consultation-form lead to CRM submission arguments. */
export function formLeadToCrm(record: {
  lead_id: string;
  full_name: string;
  email: string;
  phone: string;
  locale: string;
  interest: string;
  purpose: string;
  budget_range: string;
  timeline: string;
  notes: string;
}): CrmSubmitArgs {
  const phone = record.phone ? normalizePhone(record.phone) : null;
  const details = [
    `Interest: ${record.interest}`,
    record.purpose && `Purpose: ${record.purpose}`,
    record.budget_range && `Budget: ${record.budget_range}`,
    record.timeline && `Timeline: ${record.timeline}`,
    record.notes,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    p_idempotency_key: record.lead_id,
    p_full_name: record.full_name.slice(0, 120),
    p_phone_e164: phone?.status === "ok" ? phone.e164 : null,
    p_email: record.email || null,
    p_intent: FORM_INTENTS[record.interest] ?? "other",
    p_purpose_text: details.slice(0, 1000),
    p_locale: (locales as readonly string[]).includes(record.locale) ? (record.locale as AppLocale) : "en",
    p_source: "consultation_form",
    p_lead_id: record.lead_id,
  };
}

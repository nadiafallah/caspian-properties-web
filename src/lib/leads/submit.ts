import { consultationSchema, validateStepOne, validateStepTwo, type FieldName } from "./schema";
import { buildLeadRecord, type LeadRecord } from "./record";

export type SubmitResult =
  | { status: "success"; leadId: string; firstName: string; email: string }
  | { status: "invalid"; errors: Partial<Record<FieldName, string>> }
  | { status: "rate_limited" }
  | { status: "rejected" }
  | { status: "unavailable" };

export type SubmitDeps = {
  store: { append(record: LeadRecord): Promise<void> } | null;
  guard: {
    limit(key: string): Promise<boolean>;
    claim(key: string, ttlSeconds: number): Promise<boolean>;
    release(key: string): Promise<void>;
  };
  now: () => Date;
  /** Hashed client identifier for rate limiting (never the raw IP). */
  clientKey: string;
  log?: (message: string) => void;
  /** Called once a new lead is stored (e.g. to notify Nadia). Must not throw. */
  onStored?: (record: LeadRecord) => void;
};

/** Humans can't complete both steps this fast; bots usually can. */
export const MIN_FILL_MS = 3000;
const DUPLICATE_TTL_SECONDS = 24 * 60 * 60;

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * Validates and records a consultation request. Pure apart from the injected deps,
 * so it is unit-testable. Logs contain only the lead id and outcome — never personal data.
 */
export async function submitLead(raw: Record<string, unknown>, deps: SubmitDeps): Promise<SubmitResult> {
  const log = deps.log ?? (() => {});

  // Honeypot: real visitors never see or fill this field.
  if (typeof raw.website === "string" && raw.website.trim() !== "") {
    log("[leads] rejected: honeypot");
    return { status: "rejected" };
  }

  const parsed = consultationSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = { ...validateStepOne(raw), ...validateStepTwo(raw) };
    // Only meta fields failed (tampered or missing hidden inputs).
    if (Object.keys(errors).length === 0) return { status: "rejected" };
    return { status: "invalid", errors };
  }
  const input = parsed.data;
  const now = deps.now();

  if (now.getTime() - input.startedAt < MIN_FILL_MS) {
    log("[leads] rejected: submitted too fast");
    return { status: "rejected" };
  }

  // If the limiter itself is unreachable, fail open: losing a real enquiry is worse than one extra request.
  const allowed = await deps.guard.limit(deps.clientKey).catch(() => {
    log("[leads] rate limiter unavailable — allowing request");
    return true;
  });
  if (!allowed) {
    log("[leads] rate limited");
    return { status: "rate_limited" };
  }

  if (!deps.store) return { status: "unavailable" };

  const success = {
    status: "success" as const,
    leadId: input.submissionId,
    firstName: firstName(input.fullName),
    email: input.email,
  };

  // Idempotency: a double click or retried request with the same id is recorded once.
  const claimKey = `lead:${input.submissionId}`;
  const isNew = await deps.guard.claim(claimKey, DUPLICATE_TTL_SECONDS).catch(() => true);
  if (!isNew) {
    log(`[leads] duplicate submission ${input.submissionId}`);
    return success;
  }

  const record = buildLeadRecord(input, now.toISOString());
  try {
    await deps.store.append(record);
  } catch {
    log(`[leads] storage failed for ${input.submissionId}`);
    // Let the visitor retry with the same id instead of it being treated as a duplicate.
    await deps.guard.release(claimKey).catch(() => {});
    return { status: "unavailable" };
  }

  log(`[leads] stored ${input.submissionId}`);
  deps.onStored?.(record);
  return success;
}

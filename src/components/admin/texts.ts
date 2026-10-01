import type { getTranslations } from "next-intl/server";

type AdminT = Awaited<ReturnType<typeof getTranslations<"Admin">>>;

export function outboxTexts(t: AdminT) {
  return {
    channels: { email: t("outbox.channels.email"), telegram: t("outbox.channels.telegram") },
    pending: t("outbox.pending"),
    pendingSetup: t("outbox.pendingSetup"),
    processing: t("outbox.processing"),
    sent: t.raw("outbox.sent") as string,
    retrying: t.raw("outbox.retrying") as string,
    failed: t("outbox.failed"),
    cancelled: t("outbox.cancelled"),
  };
}

/** Messages shown under admin forms, keyed like ActionState errors. */
export function formTexts(t: AdminT): Record<string, string> {
  return {
    saved: t("errors.saved"),
    generic: t("errors.generic"),
    forbidden: t("errors.forbidden"),
    date: t("errors.date"),
    phone: t("errors.phone"),
    phoneTaken: t("errors.phoneTaken"),
    name: t("errors.name"),
    required: t("errors.required"),
    email: t("errors.email"),
  };
}

type LabelGroup = "statuses" | "intents" | "sources" | "client.noteKinds" | "client.followUpStatus";

/** Translated label for a stored code, falling back to the code itself. */
export function labelOf(t: AdminT, group: LabelGroup, code: string): string {
  const key = `${group}.${code}` as Parameters<AdminT>[0];
  return t.has(key) ? t(key) : code;
}

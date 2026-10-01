import en from "@/messages/en.json";
import fa from "@/messages/fa.json";
import ar from "@/messages/ar.json";
import type { AppLocale } from "@/i18n/locales";
import { formatPhone } from "./phone";
import { formatDubai } from "./time";

export const outboxChannels = ["email", "telegram"] as const;
export type OutboxChannel = (typeof outboxChannels)[number];

/** One claimed notification, as returned by crm_claim_outbox(). */
export type OutboxItem = {
  id: number;
  kind: "new_request" | "follow_up_due";
  channel: OutboxChannel;
  dedupe_key: string;
  client: { id: string; full_name: string; phone_e164: string | null; email: string | null };
  request: { intent: string; purpose_text: string | null; created_at: string; source: string; locale: string } | null;
  follow_up: { due_at: string; note: string | null } | null;
  latest_note: string | null;
};

export type Notification = { subject: string; text: string; html: string };

const dictionaries = { en: en.Admin, fa: fa.Admin, ar: ar.Admin };

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Notification for Nadia. Contains only what she needs to act; the case link carries
 * no personal data and still requires her to sign in.
 */
export function buildNotification(item: OutboxItem, opts: { siteUrl: string; locale: AppLocale }): Notification {
  const t = dictionaries[opts.locale];
  const n = t.notify;
  const intents = t.intents as Record<string, string>;
  const name = item.client.full_name;
  const caseUrl = `${opts.siteUrl}/${opts.locale === "en" ? "" : `${opts.locale}/`}admin/clients/${item.client.id}`;

  const rows: [string, string][] = [
    [n.name, name],
    [n.phone, item.client.phone_e164 ? formatPhone(item.client.phone_e164) : item.client.email ?? ""],
    [n.intent, item.request ? intents[item.request.intent] ?? item.request.intent : ""],
    [n.details, item.request?.purpose_text ?? ""],
  ];
  if (item.kind === "new_request") {
    rows.push([n.received, item.request ? formatDubai(item.request.created_at, opts.locale) : ""]);
  } else {
    rows.push([n.due, item.follow_up ? formatDubai(item.follow_up.due_at, opts.locale) : ""]);
    rows.push([n.followUpNote, item.follow_up?.note ?? ""]);
    rows.push([n.latestNote, item.latest_note ?? ""]);
  }
  const visible = rows.filter(([, value]) => value);

  const subject = fill(item.kind === "new_request" ? n.newSubject : n.reminderSubject, { name });
  const heading = item.kind === "new_request" ? n.newHeading : n.reminderHeading;

  const text = [heading, "", ...visible.map(([label, value]) => `${label}: ${value}`), "", `${n.open}: ${caseUrl}`, n.signInNote].join("\n");

  const dir = opts.locale === "en" ? "ltr" : "rtl";
  const html = `<!doctype html><html lang="${opts.locale}" dir="${dir}"><body style="font-family:Arial,Tahoma,sans-serif;color:#1f1f1f;line-height:1.6">
<h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(heading)}</h1>
<table role="presentation" style="border-collapse:collapse">${visible
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#5c5652;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
    )
    .join("")}</table>
<p style="margin:20px 0 4px"><a href="${escapeHtml(caseUrl)}" style="color:#9d4f2b">${escapeHtml(n.open)}</a></p>
<p style="margin:0;color:#5c5652;font-size:13px">${escapeHtml(n.signInNote)}</p>
</body></html>`;

  return { subject, text, html };
}

export type SendResult = { ok: true; providerId: string | null } | { ok: false; error: string };
export type Sender = (item: OutboxItem, message: Notification) => Promise<SendResult>;

const TIMEOUT_MS = 10_000;

/** Channels switch on only when all of their environment variables are set. */
export function configuredSenders(env: Record<string, string | undefined> = process.env): Partial<Record<OutboxChannel, Sender>> {
  const senders: Partial<Record<OutboxChannel, Sender>> = {};

  if (env.RESEND_API_KEY && env.LEAD_NOTIFY_EMAIL_TO) {
    const { RESEND_API_KEY: key, LEAD_NOTIFY_EMAIL_TO: to } = env;
    const from = env.LEAD_NOTIFY_EMAIL_FROM || "Caspian website <onboarding@resend.dev>";
    senders.email = async (item, message) => {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            // Resend drops a repeated send with the same key (24 h), so a retry after a
            // lost response cannot produce a second email.
            "Idempotency-Key": item.dedupe_key,
          },
          body: JSON.stringify({
            from,
            to: to.split(",").map((s) => s.trim()),
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) return { ok: false, error: `email http ${response.status}` };
        const body = (await response.json().catch(() => ({}))) as { id?: string };
        return { ok: true, providerId: body.id ?? null };
      } catch {
        return { ok: false, error: "email unreachable" };
      }
    };
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId } = env;
    senders.telegram = async (_item, message) => {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Plain text (no parse_mode), so visitor input can never be interpreted as markup.
          body: JSON.stringify({ chat_id: chatId, text: message.text, disable_web_page_preview: true }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) return { ok: false, error: `telegram http ${response.status}` };
        const body = (await response.json().catch(() => ({}))) as { result?: { message_id?: number } };
        return { ok: true, providerId: body.result?.message_id != null ? String(body.result.message_id) : null };
      } catch {
        return { ok: false, error: "telegram unreachable" };
      }
    };
  }

  return senders;
}

export type OutboxDeps = {
  claim(channels: OutboxChannel[], limit: number): Promise<OutboxItem[]>;
  complete(id: number, result: SendResult): Promise<void>;
  senders: Partial<Record<OutboxChannel, Sender>>;
  siteUrl: string;
  locale: AppLocale;
  log?: (message: string) => void;
};

/**
 * Sends due notifications once. Only configured channels are claimed, so messages for
 * a channel that is not set up yet wait in the queue instead of failing.
 * Logs contain outbox ids and outcomes only — never names or numbers.
 */
export async function processOutbox(deps: OutboxDeps, limit = 10): Promise<{ sent: number; failed: number }> {
  const log = deps.log ?? (() => {});
  const channels = outboxChannels.filter((c) => deps.senders[c]);
  const items = await deps.claim(channels, limit);
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    const sender = deps.senders[item.channel];
    let result: SendResult;
    if (!sender) {
      result = { ok: false, error: "channel not configured" };
    } else {
      try {
        result = await sender(item, buildNotification(item, { siteUrl: deps.siteUrl, locale: deps.locale }));
      } catch {
        result = { ok: false, error: `${item.channel} error` };
      }
    }
    await deps.complete(item.id, result);
    if (result.ok) sent++;
    else failed++;
    log(`[crm-outbox] ${item.id} ${item.kind}/${item.channel} ${result.ok ? "sent" : `failed: ${result.error}`}`);
  }
  return { sent, failed };
}

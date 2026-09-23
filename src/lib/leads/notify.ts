import en from "@/messages/en.json";
import type { LeadRecord } from "./record";

const TIMEOUT_MS = 8000;

type Options = Record<string, Record<string, string> | string>;
const options = en.Consultation.options as Options;
const label = (group: string, value: string) => {
  const values = options[group];
  return (typeof values === "object" && values[value]) || value;
};

/** Plain-text summary of a new lead, for Nadia only. */
export function formatLeadMessage(record: LeadRecord): string {
  const lines: [string, string][] = [
    ["Name", record.full_name],
    ["Phone", record.phone],
    ["Email", record.email],
    ["Contact by", label("channel", record.preferred_contact)],
    ["Language", label("language", record.preferred_language)],
    ["Based in", record.location],
    ["Interest", label("interest", record.interest)],
    ["Purpose", label("purpose", record.purpose)],
    ["Budget", label("budget", record.budget_range)],
    ["Timeline", label("timeline", record.timeline)],
    ["Decision makers", record.decision_makers],
    ["Notes", record.notes],
    ["Heard via", record.referral_source],
  ];
  return [
    "New consultation request",
    "",
    ...lines.filter(([, value]) => value).map(([name, value]) => `${name}: ${value}`),
    "",
    `Lead id: ${record.lead_id}`,
  ].join("\n");
}

type Channel = { name: string; send(text: string, record: LeadRecord): Promise<Response> };

/** Channels switch on only when all of their environment variables are set. */
export function configuredChannels(env: Record<string, string | undefined> = process.env): Channel[] {
  const channels: Channel[] = [];
  const signal = () => AbortSignal.timeout(TIMEOUT_MS);

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId } = env;
    channels.push({
      name: "telegram",
      send: (text) =>
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
          signal: signal(),
        }),
    });
  }

  if (env.RESEND_API_KEY && env.LEAD_NOTIFY_EMAIL_TO) {
    const { RESEND_API_KEY: key, LEAD_NOTIFY_EMAIL_TO: to } = env;
    const from = env.LEAD_NOTIFY_EMAIL_FROM || "Caspian website <onboarding@resend.dev>";
    channels.push({
      name: "email",
      send: (text, record) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: to.split(",").map((s) => s.trim()),
            subject: `New consultation request: ${record.full_name}`,
            text,
            ...(record.email ? { reply_to: record.email } : {}),
          }),
          signal: signal(),
        }),
    });
  }

  if (env.CALLMEBOT_PHONE && env.CALLMEBOT_APIKEY) {
    const { CALLMEBOT_PHONE: phone, CALLMEBOT_APIKEY: apikey } = env;
    channels.push({
      name: "whatsapp",
      send: (text) =>
        fetch(
          `https://api.callmebot.com/whatsapp.php?${new URLSearchParams({ phone, text, apikey })}`,
          { signal: signal() },
        ),
    });
  }

  return channels;
}

/**
 * Sends the lead to every configured channel. Never throws: a failed notification
 * must not affect the saved lead. Logs contain only the channel and lead id.
 */
export async function notifyNewLead(record: LeadRecord, channels = configuredChannels()): Promise<void> {
  if (channels.length === 0) return;
  const text = formatLeadMessage(record);
  await Promise.all(
    channels.map(async (channel) => {
      try {
        const response = await channel.send(text, record);
        if (!response.ok) console.error(`[notify] ${channel.name} failed (${response.status}) for ${record.lead_id}`);
      } catch {
        console.error(`[notify] ${channel.name} unreachable for ${record.lead_id}`);
      }
    }),
  );
}

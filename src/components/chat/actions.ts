"use server";

import { headers } from "next/headers";
import { z } from "zod";
import en from "@/messages/en.json";
import fa from "@/messages/fa.json";
import ar from "@/messages/ar.json";
import { locales } from "@/i18n/locales";
import { assistantReply } from "@/lib/assistant/reply";
import type { Intent } from "@/lib/assistant/understand";
import { getCrmStore } from "@/lib/crm/store";
import { submitChatRequest, type ChatSubmitResult } from "@/lib/crm/submit";
import { MemoryGuard, getGuard, hashIdentifier } from "@/lib/security/guard";

// Questions are cheap but may reach the AI provider: allow a normal conversation, not a flood.
const questionGuard = new MemoryGuard(30, 10 * 60 * 1000);
const rateLimitedText = { en: en.Chat.rateLimited, fa: fa.Chat.rateLimited, ar: ar.Chat.rateLimited };

async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return hashIdentifier(ip);
}

const askSchema = z.object({
  locale: z.enum(locales),
  history: z
    .array(z.object({ from: z.enum(["user", "bot"]), text: z.string().max(1000) }))
    .min(1)
    .max(12),
});

/**
 * Answers a visitor's question. The assistant has no access to any records — it only
 * returns text and, when obvious, the visitor's goal.
 */
export async function askAssistant(input: z.input<typeof askSchema>): Promise<{ reply: string; intent: Intent | null }> {
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return { reply: "", intent: null };
  const { locale, history } = parsed.data;

  if (!(await questionGuard.limit(await clientKey()))) return { reply: rateLimitedText[locale], intent: null };

  const result = await assistantReply(history, locale, process.env, (message) => console.info(message));
  return { reply: result.reply, intent: result.intent };
}

/** Records the visitor's call request. Success only after the database confirmed it. */
export async function submitChatEnquiry(input: unknown): Promise<ChatSubmitResult> {
  return submitChatRequest(input, {
    store: getCrmStore(),
    guard: getGuard(),
    now: () => new Date(),
    clientKey: await clientKey(),
    log: (message) => console.info(message),
  });
}

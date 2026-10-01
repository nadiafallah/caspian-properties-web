import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/config/site";
import { configuredSenders, processOutbox, type OutboxChannel, type OutboxItem, type SendResult } from "@/lib/crm/outbox";
import { getCrmService } from "@/lib/crm/service";
import { isAppLocale } from "@/i18n/locales";

export const maxDuration = 30;

/**
 * Notification worker, called every minute by Supabase Cron (pg_net) when work is due.
 * The caller must present the single-use token that the scheduler just stored in the
 * database; anything else is rejected before any work is done.
 */
export async function POST(request: NextRequest) {
  const service = getCrmService();
  if (!service) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const token = request.headers.get("authorization")?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  const authorized = token ? await service.rpc<boolean>("crm_worker_auth", { p_token: token }).catch(() => false) : false;
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const adminLocale = process.env.ADMIN_LOCALE ?? "fa";
  const result = await processOutbox({
    claim: (channels: OutboxChannel[], limit: number) =>
      service.rpc<OutboxItem[]>("crm_claim_outbox", { p_channels: channels, p_limit: limit }),
    complete: (id: number, r: SendResult) =>
      service.rpc<void>("crm_complete_outbox", {
        p_id: id,
        p_ok: r.ok,
        p_provider_id: r.ok ? r.providerId : null,
        p_error: r.ok ? null : r.error,
      }),
    senders: configuredSenders(),
    siteUrl,
    locale: isAppLocale(adminLocale) ? adminLocale : "fa",
    log: (message) => console.info(message),
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

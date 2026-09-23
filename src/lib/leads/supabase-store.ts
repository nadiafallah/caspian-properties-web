import type { BookingUpdate, LeadRecord, SheetColumn } from "./record";
import type { LeadStore } from "./store";

const TIMEOUT_MS = 8000;

// Stored as timestamptz; an empty string must be sent as null.
const TIMESTAMP_COLUMNS: SheetColumn[] = ["created_at_utc", "consent_at_utc", "booking_start_utc", "booking_end_utc", "updated_at_utc"];

type Config = { url: string; secretKey: string };

/**
 * Supabase lead register via the PostgREST API and a server-only secret key.
 * The `leads` table has RLS enabled with no policies, so only this key can use it
 * (see supabase/migrations).
 */
export class SupabaseLeadStore implements LeadStore {
  readonly name = "supabase";
  private readonly endpoint: string;
  private readonly secretKey: string;

  constructor(config: Config) {
    this.endpoint = `${config.url.replace(/\/+$/, "")}/rest/v1/leads`;
    this.secretKey = config.secretKey;
  }

  async append(record: LeadRecord): Promise<void> {
    // A retried submission with the same lead id is ignored, not duplicated.
    await this.request("?on_conflict=lead_id", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: toRow(record),
    });
  }

  async updateBooking(match: { leadId?: string; previousBookingUid?: string }, update: BookingUpdate): Promise<boolean> {
    const body: Record<string, string | null> = {
      booking_status: update.status,
      cal_booking_uid: update.bookingUid,
      booking_start_utc: update.startUtc || null,
      booking_end_utc: update.endUtc || null,
      updated_at_utc: update.updatedAtUtc,
    };
    if (update.meetingFormat) body.meeting_format = update.meetingFormat;

    if (match.leadId && (await this.patch("lead_id", match.leadId, body))) return true;
    if (match.previousBookingUid && (await this.patch("cal_booking_uid", match.previousBookingUid, body))) return true;
    return false;
  }

  private async patch(column: SheetColumn, value: string, body: Record<string, string | null>): Promise<boolean> {
    const response = await this.request(`?${column}=eq.${encodeURIComponent(value)}&select=lead_id`, {
      method: "PATCH",
      prefer: "return=representation",
      body,
    });
    const rows = (await response.json()) as unknown[];
    return rows.length > 0;
  }

  private async request(query: string, init: { method: string; prefer: string; body: unknown }): Promise<Response> {
    const response = await fetch(`${this.endpoint}${query}`, {
      method: init.method,
      headers: {
        apikey: this.secretKey,
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        Prefer: init.prefer,
      },
      body: JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // Only code and message: Postgres "details" can echo the failing row (personal data).
      const error = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
      throw new Error(`Supabase ${init.method} failed: ${response.status} ${error.code ?? ""} ${error.message ?? ""}`.trim());
    }
    return response;
  }
}

export function toRow(record: LeadRecord): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(record).map(([column, value]) => [
      column,
      TIMESTAMP_COLUMNS.includes(column as SheetColumn) && value === "" ? null : value,
    ]),
  );
}

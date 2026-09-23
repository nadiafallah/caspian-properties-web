import "server-only";
import type { BookingUpdate, LeadRecord } from "./record";
import { MemoryLeadStore } from "./memory-store";
import { SheetsLeadStore } from "./sheets-store";
import { SupabaseLeadStore } from "./supabase-store";

/** Storage adapter. Replace the implementation without touching the form or webhook. */
export interface LeadStore {
  readonly name: string;
  append(record: LeadRecord): Promise<void>;
  /** Updates the lead's booking columns; matches by lead id, then by previous booking uid. Returns false if no row matched. */
  updateBooking(match: { leadId?: string; previousBookingUid?: string }, update: BookingUpdate): Promise<boolean>;
}

let memoryStore: MemoryLeadStore | undefined;

/**
 * Returns the configured store, or null when production has no working storage.
 * Callers must then report failure — never a silent success.
 */
export function getLeadStore(): LeadStore | null {
  const mode = process.env.LEAD_STORE ?? (process.env.NODE_ENV === "production" ? "supabase" : "memory");

  if (mode === "memory") {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_STORE !== "true") {
      console.error("[leads] LEAD_STORE=memory is not allowed in production");
      return null;
    }
    memoryStore ??= new MemoryLeadStore();
    return memoryStore;
  }

  if (mode === "supabase") {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secretKey) {
      console.error("[leads] Supabase is not configured (see docs/INTEGRATIONS.md)");
      return null;
    }
    return new SupabaseLeadStore({ url, secretKey });
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!spreadsheetId || !email || !privateKey) {
    console.error("[leads] Google Sheets is not configured (see docs/INTEGRATIONS.md)");
    return null;
  }
  return new SheetsLeadStore({
    spreadsheetId,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || "Leads",
    email,
    privateKey,
  });
}

import { JWT } from "google-auth-library";
import { SHEET_COLUMNS, columnLetter, toSheetRow, type BookingUpdate, type LeadRecord } from "./record";
import type { LeadStore } from "./store";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const TIMEOUT_MS = 8000;

type Config = { spreadsheetId: string; sheetName: string; email: string; privateKey: string };

/**
 * Google Sheets lead register via a server-only service account and the Sheets REST API v4.
 * Values are written with valueInputOption=RAW, so nothing is ever interpreted as a formula.
 */
export class SheetsLeadStore implements LeadStore {
  readonly name = "google-sheets";
  private readonly client: JWT;
  private readonly base: string;
  private readonly sheet: string;

  constructor(config: Config) {
    this.client = new JWT({
      email: config.email,
      key: config.privateKey.replace(/\\n/g, "\n"),
      scopes: SCOPES,
    });
    this.base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
    // Quote the sheet name for A1 notation (handles spaces and apostrophes).
    this.sheet = `'${config.sheetName.replace(/'/g, "''")}'`;
  }

  async append(record: LeadRecord): Promise<void> {
    const range = encodeURIComponent(`${this.sheet}!A1`);
    await this.client.request({
      url: `${this.base}/values/${range}:append`,
      method: "POST",
      params: { valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" },
      data: { values: [toSheetRow(record)] },
      timeout: TIMEOUT_MS,
    });
  }

  async updateBooking(match: { leadId?: string; previousBookingUid?: string }, update: BookingUpdate): Promise<boolean> {
    const row =
      (match.leadId ? await this.findRow("lead_id", match.leadId) : null) ??
      (match.previousBookingUid ? await this.findRow("cal_booking_uid", match.previousBookingUid) : null);
    if (!row) return false;

    const statusFrom = columnLetter("booking_status");
    const statusTo = columnLetter("updated_at_utc");
    const formatCol = columnLetter("meeting_format");
    const data = [
      {
        range: `${this.sheet}!${statusFrom}${row}:${statusTo}${row}`,
        values: [[update.status, update.bookingUid, update.startUtc ?? "", update.endUtc ?? "", update.updatedAtUtc]],
      },
    ];
    if (update.meetingFormat) {
      data.push({ range: `${this.sheet}!${formatCol}${row}`, values: [[update.meetingFormat]] });
    }

    await this.client.request({
      url: `${this.base}/values:batchUpdate`,
      method: "POST",
      data: { valueInputOption: "RAW", data },
      timeout: TIMEOUT_MS,
    });
    return true;
  }

  /** 1-based row number of the first row whose column equals value (header row excluded). */
  private async findRow(column: (typeof SHEET_COLUMNS)[number], value: string): Promise<number | null> {
    const letter = columnLetter(column);
    const range = encodeURIComponent(`${this.sheet}!${letter}:${letter}`);
    const response = await this.client.request<{ values?: string[][] }>({
      url: `${this.base}/values/${range}`,
      method: "GET",
      timeout: TIMEOUT_MS,
    });
    const rows = response.data.values ?? [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i]?.[0] === value) return i + 1;
    }
    return null;
  }
}

import type { BookingUpdate, LeadRecord } from "./record";
import type { LeadStore } from "./store";

/** Development/test store. Data lives only in this server process. */
export class MemoryLeadStore implements LeadStore {
  readonly name = "memory";
  readonly records: LeadRecord[] = [];

  async append(record: LeadRecord): Promise<void> {
    this.records.push({ ...record });
  }

  async updateBooking(match: { leadId?: string; previousBookingUid?: string }, update: BookingUpdate): Promise<boolean> {
    const record =
      (match.leadId && this.records.find((r) => r.lead_id === match.leadId)) ||
      (match.previousBookingUid && this.records.find((r) => r.cal_booking_uid === match.previousBookingUid)) ||
      undefined;
    if (!record) return false;
    record.booking_status = update.status;
    record.cal_booking_uid = update.bookingUid;
    record.booking_start_utc = update.startUtc ?? record.booking_start_utc;
    record.booking_end_utc = update.endUtc ?? record.booking_end_utc;
    record.meeting_format = update.meetingFormat ?? record.meeting_format;
    record.updated_at_utc = update.updatedAtUtc;
    return true;
  }
}

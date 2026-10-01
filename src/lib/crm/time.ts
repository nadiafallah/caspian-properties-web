import { localeMeta, type AppLocale } from "@/i18n/locales";

/** Nadia works in Dubai time. The UAE has no daylight saving, so the offset is fixed. */
export const CRM_TIME_ZONE = "Asia/Dubai";
const OFFSET_MS = 4 * 60 * 60 * 1000;
const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** "2026-10-03T14:30" typed in Dubai time → UTC ISO string, or null if malformed. */
export function dubaiInputToIso(value: string): string | null {
  const m = LOCAL_INPUT.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const utc = Date.UTC(y, mo - 1, d, h, mi) - OFFSET_MS;
  const check = new Date(utc + OFFSET_MS);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return new Date(utc).toISOString();
}

/** UTC ISO → value for an <input type="datetime-local"> showing Dubai time. */
export function isoToDubaiInput(iso: string): string {
  return new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

/** Start and end (exclusive) of the Dubai calendar day containing `now`, as UTC dates. */
export function dubaiDayBounds(now: Date): { start: Date; end: Date } {
  const local = new Date(now.getTime() + OFFSET_MS);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - OFFSET_MS;
  return { start: new Date(start), end: new Date(start + 24 * 60 * 60 * 1000) };
}

/** Date and time in Dubai, in the locale's script, e.g. "3 Oct 2026, 14:30". */
export function formatDubai(iso: string, locale: AppLocale | "en" = "en"): string {
  return new Intl.DateTimeFormat(localeMeta[locale].intl, {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
    timeZone: CRM_TIME_ZONE,
  }).format(new Date(iso));
}

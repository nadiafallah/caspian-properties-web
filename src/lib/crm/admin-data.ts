import "server-only";
import type { AdminContext } from "./admin";
import { dubaiDayBounds } from "./time";

export const clientStatuses = ["new", "in_progress", "awaiting_reply", "won", "closed"] as const;
export type ClientStatus = (typeof clientStatuses)[number];
export const requestIntents = ["buy_ready", "buy_off_plan", "buy", "sell", "rent", "let", "rental", "other"] as const;
export const noteKinds = ["note", "call", "message", "meeting"] as const;
export type NoteKind = (typeof noteKinds)[number];
export const followUpFilters = ["overdue", "today", "upcoming", "none"] as const;
export type FollowUpFilter = (typeof followUpFilters)[number];

export type FollowUpRow = { id: string; client_id: string; due_at: string; note: string | null; status: "open" | "done" | "cancelled"; version: number; completed_at: string | null; updated_at: string };
export type OutboxRow = { id: number; kind: string; channel: string; status: string; attempts: number; sent_at: string | null; last_error: string | null; next_attempt_at: string; follow_up_id: string | null };
export type RequestRow = { id: string; intent: string; purpose_text: string | null; submitted_name: string; locale: string; source: string; created_at: string; consent_at: string; crm_outbox: OutboxRow[] };
export type ActivityRow = { id: string; kind: string; body: string | null; outcome: string | null; next_action: string | null; occurred_at: string; meta: Record<string, unknown>; created_at: string; updated_at: string };
export type ClientRow = {
  id: string;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  status: ClientStatus;
  close_reason: string | null;
  created_at: string;
  last_activity_at: string;
};
export type ClientListRow = ClientRow & {
  crm_requests: { intent: string; created_at: string }[];
  crm_follow_ups: { id: string; due_at: string; status: string }[];
};

/** Keeps only characters that can be part of a name or phone number (PostgREST filter-safe). */
export function sanitizeSearch(q: string): string {
  return q.replace(/[^\p{L}\p{M}\d +]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export function nextOpenFollowUp(row: { crm_follow_ups: { due_at: string; status: string }[] }) {
  return row.crm_follow_ups.filter((f) => f.status === "open").sort((a, b) => a.due_at.localeCompare(b.due_at))[0] ?? null;
}

/** Overdue = time passed and not done; today = later today (Dubai); upcoming = after today. */
export function followUpBucket(dueAt: string, now: Date): Exclude<FollowUpFilter, "none"> {
  const due = new Date(dueAt);
  if (due < now) return "overdue";
  return due < dubaiDayBounds(now).end ? "today" : "upcoming";
}

export async function listClients(
  ctx: AdminContext,
  filters: { q?: string; status?: string; intent?: string; followUp?: string },
  now = new Date(),
): Promise<ClientListRow[]> {
  let query = ctx.supabase
    .from("crm_clients")
    .select("id, full_name, phone_e164, email, status, close_reason, created_at, last_activity_at, crm_requests(intent, created_at), crm_follow_ups(id, due_at, status)")
    .order("last_activity_at", { ascending: false })
    .limit(500);

  if (filters.status && (clientStatuses as readonly string[]).includes(filters.status)) query = query.eq("status", filters.status);
  const q = sanitizeSearch(filters.q ?? "");
  if (q) {
    const digits = q.replace(/[^\d]/g, "");
    query = digits.length >= 3 ? query.or(`full_name.ilike.%${q}%,phone_e164.ilike.%${digits}%`) : query.ilike("full_name", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`crm list failed: ${error.code}`);
  let rows = (data ?? []) as unknown as ClientListRow[];

  if (filters.intent && (requestIntents as readonly string[]).includes(filters.intent)) {
    rows = rows.filter((r) => r.crm_requests.some((req) => req.intent === filters.intent));
  }
  if (filters.followUp && (followUpFilters as readonly string[]).includes(filters.followUp)) {
    rows = rows.filter((r) => {
      const next = nextOpenFollowUp(r);
      if (filters.followUp === "none") return !next;
      return next ? followUpBucket(next.due_at, now) === filters.followUp : false;
    });
  }
  return rows;
}

export async function getClientCase(ctx: AdminContext, id: string) {
  const [client, requests, activities, followUps] = await Promise.all([
    ctx.supabase.from("crm_clients").select("*").eq("id", id).maybeSingle(),
    ctx.supabase
      .from("crm_requests")
      .select("id, intent, purpose_text, submitted_name, locale, source, created_at, consent_at, crm_outbox(id, kind, channel, status, attempts, sent_at, last_error, next_attempt_at, follow_up_id)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    ctx.supabase.from("crm_activities").select("id, kind, body, outcome, next_action, occurred_at, meta, created_at, updated_at").eq("client_id", id).order("occurred_at", { ascending: false }).limit(300),
    ctx.supabase.from("crm_follow_ups").select("id, client_id, due_at, note, status, version, completed_at, updated_at").eq("client_id", id).order("due_at", { ascending: true }),
  ]);
  const failed = [client, requests, activities, followUps].find((r) => r.error);
  if (failed?.error) throw new Error(`crm case failed: ${failed.error.code}`);
  if (!client.data) return null;

  const reminders = await ctx.supabase
    .from("crm_outbox")
    .select("id, kind, channel, status, attempts, sent_at, last_error, next_attempt_at, follow_up_id")
    .eq("client_id", id)
    .eq("kind", "follow_up_due")
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    client: client.data as ClientRow,
    requests: (requests.data ?? []) as RequestRow[],
    activities: (activities.data ?? []) as ActivityRow[],
    followUps: (followUps.data ?? []) as FollowUpRow[],
    reminders: (reminders.data ?? []) as OutboxRow[],
  };
}

export type FollowUpWithClient = FollowUpRow & { crm_clients: { id: string; full_name: string; phone_e164: string | null; status: string } | null };

export async function listOpenFollowUps(ctx: AdminContext): Promise<FollowUpWithClient[]> {
  const { data, error } = await ctx.supabase
    .from("crm_follow_ups")
    .select("id, client_id, due_at, note, status, version, completed_at, updated_at, crm_clients(id, full_name, phone_e164, status)")
    .eq("status", "open")
    .order("due_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(`crm follow-ups failed: ${error.code}`);
  return (data ?? []) as unknown as FollowUpWithClient[];
}

export type RecentRequest = RequestRow & { crm_clients: { id: string; full_name: string; status: string } | null };

export async function listRecentRequests(ctx: AdminContext, limit = 8): Promise<RecentRequest[]> {
  const { data, error } = await ctx.supabase
    .from("crm_requests")
    .select("id, intent, purpose_text, submitted_name, locale, source, created_at, consent_at, crm_outbox(id, kind, channel, status, attempts, sent_at, last_error, next_attempt_at, follow_up_id), crm_clients(id, full_name, status)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`crm requests failed: ${error.code}`);
  return (data ?? []) as unknown as RecentRequest[];
}

export async function countByStatus(ctx: AdminContext): Promise<Record<ClientStatus, number>> {
  const { data, error } = await ctx.supabase.from("crm_clients").select("status").limit(5000);
  if (error) throw new Error(`crm counts failed: ${error.code}`);
  const counts = Object.fromEntries(clientStatuses.map((s) => [s, 0])) as Record<ClientStatus, number>;
  for (const row of data ?? []) counts[row.status as ClientStatus]++;
  return counts;
}

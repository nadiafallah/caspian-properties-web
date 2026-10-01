"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { siteUrl } from "@/config/site";
import { getPathname } from "@/i18n/navigation";
import { locales } from "@/i18n/locales";
import { getAdminSession } from "@/lib/crm/admin";
import { clientStatuses, noteKinds } from "@/lib/crm/admin-data";
import { normalizePhone } from "@/lib/crm/phone";
import { dubaiInputToIso } from "@/lib/crm/time";
import { MemoryGuard, hashIdentifier } from "@/lib/security/guard";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";

export type ActionState = { ok: true; at: number } | { ok: false; error: ErrorKey; at: number } | null;
type ErrorKey = "generic" | "forbidden" | "date" | "phone" | "phoneTaken" | "name" | "required" | "email";

const ok = (): ActionState => ({ ok: true, at: Date.now() });
const fail = (error: ErrorKey): ActionState => ({ ok: false, error, at: Date.now() });

const uuid = z.uuid();
const text = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max)).transform((v) => v || null);

async function admin() {
  const { ctx } = await getAdminSession();
  return ctx;
}

function refresh() {
  revalidatePath("/[locale]/admin", "layout");
}

/** Logs only the operation and Postgres error code — never field values. */
function logFailure(op: string, code: string | undefined) {
  console.error(`[crm-admin] ${op} failed: ${code ?? "unknown"}`);
}

export async function updateClientDetails(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return fail("forbidden");
  const id = uuid.safeParse(form.get("clientId"));
  const name = z.string().trim().min(1).max(120).safeParse(form.get("fullName"));
  if (!id.success) return fail("generic");
  if (!name.success) return fail("name");

  const phoneRaw = String(form.get("phone") ?? "").trim();
  const emailRaw = String(form.get("email") ?? "").trim();
  let phone: string | null = null;
  if (phoneRaw) {
    const parsed = normalizePhone(phoneRaw);
    if (parsed.status !== "ok") return fail("phone");
    phone = parsed.e164;
  }
  if (emailRaw && !z.email().safeParse(emailRaw).success) return fail("email");
  if (!phone && !emailRaw) return fail("phone");

  const { error } = await ctx.supabase
    .from("crm_clients")
    .update({ full_name: name.data, phone_e164: phone, email: emailRaw || null })
    .eq("id", id.data);
  if (error) {
    logFailure("details", error.code);
    return fail(error.code === "23505" ? "phoneTaken" : "generic");
  }
  refresh();
  return ok();
}

export async function updateClientStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return fail("forbidden");
  const parsed = z
    .object({ clientId: uuid, status: z.enum(clientStatuses), closeReason: text(300) })
    .safeParse({ clientId: form.get("clientId"), status: form.get("status"), closeReason: form.get("closeReason") ?? "" });
  if (!parsed.success) return fail("generic");
  const { clientId, status, closeReason } = parsed.data;
  const closing = status === "won" || status === "closed";

  const { error } = await ctx.supabase
    .from("crm_clients")
    .update({ status, close_reason: closing ? closeReason : null })
    .eq("id", clientId);
  if (error) {
    logFailure("status", error.code);
    return fail("generic");
  }
  refresh();
  return ok();
}

const noteSchema = z.object({
  kind: z.enum(noteKinds),
  body: text(4000),
  outcome: text(1000),
  nextAction: text(1000),
  occurredAt: z.string().max(20).optional(),
});

function readNote(form: FormData) {
  return noteSchema.safeParse({
    kind: form.get("kind") ?? "note",
    body: form.get("body") ?? "",
    outcome: form.get("outcome") ?? "",
    nextAction: form.get("nextAction") ?? "",
    occurredAt: form.get("occurredAt") || undefined,
  });
}

export async function addNote(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return fail("forbidden");
  const clientId = uuid.safeParse(form.get("clientId"));
  const note = readNote(form);
  if (!clientId.success || !note.success) return fail("generic");
  const { kind, body, outcome, nextAction, occurredAt } = note.data;
  if (!body && !outcome && !nextAction) return fail("required");
  const occurred = occurredAt ? dubaiInputToIso(occurredAt) : new Date().toISOString();
  if (!occurred) return fail("date");

  const { error } = await ctx.supabase.from("crm_activities").insert({
    client_id: clientId.data,
    kind,
    body,
    outcome,
    next_action: nextAction,
    occurred_at: occurred,
  });
  if (error) {
    logFailure("note", error.code);
    return fail("generic");
  }
  refresh();
  return ok();
}

/** Edits one note in place; the rest of the history is untouched. */
export async function updateNote(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return fail("forbidden");
  const id = uuid.safeParse(form.get("activityId"));
  const note = readNote(form);
  if (!id.success || !note.success) return fail("generic");
  const { kind, body, outcome, nextAction, occurredAt } = note.data;
  if (!body && !outcome && !nextAction) return fail("required");
  const occurred = occurredAt ? dubaiInputToIso(occurredAt) : null;
  if (occurredAt && !occurred) return fail("date");

  const { error } = await ctx.supabase
    .from("crm_activities")
    .update({ kind, body, outcome, next_action: nextAction, ...(occurred ? { occurred_at: occurred } : {}) })
    .eq("id", id.data)
    .in("kind", noteKinds);
  if (error) {
    logFailure("note-edit", error.code);
    return fail("generic");
  }
  refresh();
  return ok();
}

export async function createFollowUp(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return fail("forbidden");
  const clientId = uuid.safeParse(form.get("clientId"));
  const note = text(1000).safeParse(form.get("note") ?? "");
  if (!clientId.success || !note.success) return fail("generic");
  const due = dubaiInputToIso(String(form.get("dueAt") ?? ""));
  if (!due) return fail("date");

  const { error } = await ctx.supabase.from("crm_follow_ups").insert({ client_id: clientId.data, due_at: due, note: note.data });
  if (error) {
    logFailure("follow-up", error.code);
    return fail("generic");
  }
  refresh();
  return ok();
}

/** Rescheduling bumps the follow-up's version, so a reminder for the old time is never sent. */
export async function updateFollowUp(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return fail("forbidden");
  const id = uuid.safeParse(form.get("followUpId"));
  const note = text(1000).safeParse(form.get("note") ?? "");
  if (!id.success || !note.success) return fail("generic");
  const due = dubaiInputToIso(String(form.get("dueAt") ?? ""));
  if (!due) return fail("date");

  const { error } = await ctx.supabase
    .from("crm_follow_ups")
    .update({ due_at: due, note: note.data })
    .eq("id", id.data)
    .eq("status", "open");
  if (error) {
    logFailure("follow-up-edit", error.code);
    return fail("generic");
  }
  refresh();
  return ok();
}

export async function setFollowUpStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await admin();
  if (!ctx) return fail("forbidden");
  const parsed = z
    .object({ followUpId: uuid, status: z.enum(["done", "cancelled"]) })
    .safeParse({ followUpId: form.get("followUpId"), status: form.get("status") });
  if (!parsed.success) return fail("generic");

  const { error } = await ctx.supabase
    .from("crm_follow_ups")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.followUpId)
    .eq("status", "open");
  if (error) {
    logFailure("follow-up-status", error.code);
    return fail("generic");
  }
  refresh();
  return ok();
}

// ── Sign-in ──────────────────────────────────────────────────────────────

const loginGuard = new MemoryGuard(5, 15 * 60 * 1000);

export type LoginState = { status: "sent" | "invalid" | "error" | "rate_limited"; at: number } | null;

/**
 * Emails a sign-in link. The answer is the same whether or not the address has an
 * account, and no account is ever created here; panel access additionally requires
 * the crm_admins allow-list.
 */
export async function sendLoginLink(_: LoginState, form: FormData): Promise<LoginState> {
  const at = Date.now();
  const locale = z.enum(locales).catch("en").parse(form.get("locale"));
  const email = z.email().max(254).safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { status: "invalid", at };
  if (!isAuthConfigured()) return { status: "error", at };

  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await loginGuard.limit(hashIdentifier(`login:${ip}`)))) return { status: "rate_limited", at };

  const supabase = await createSupabaseServerClient();
  const next = getPathname({ locale, href: "/admin" });
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl}/api/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    console.error(`[crm-admin] sign-in link not sent: ${error.code ?? error.status}`);
    if (error.status === 429) return { status: "rate_limited", at };
    // "Signups not allowed" for an unknown address is reported exactly like success.
    if (error.status !== 400 && error.status !== 422) return { status: "error", at };
  }
  return { status: "sent", at };
}

export async function signOut(form: FormData): Promise<void> {
  const locale = z.enum(locales).catch("en").parse(form.get("locale"));
  if (isAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect(getPathname({ locale, href: "/admin/login" }));
}

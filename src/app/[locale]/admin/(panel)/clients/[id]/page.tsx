import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { Link } from "@/i18n/navigation";
import { requireAdminPage } from "@/lib/crm/admin";
import { clientStatuses, getClientCase, noteKinds, type ActivityRow } from "@/lib/crm/admin-data";
import { configuredSenders } from "@/lib/crm/outbox";
import { formatPhone } from "@/lib/crm/phone";
import { formatDubai, isoToDubaiInput } from "@/lib/crm/time";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Card, ContactButtons, OutboxStatus, Phone, StatusBadge, When } from "@/components/admin/bits";
import { formTexts, labelOf, outboxTexts } from "@/components/admin/texts";
import {
  addNote,
  createFollowUp,
  setFollowUpStatus,
  updateClientDetails,
  updateClientStatus,
  updateFollowUp,
  updateNote,
} from "../../../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NOTE_KINDS = new Set<string>(noteKinds);
const input = "mt-1 min-h-11 w-full rounded-sm border border-stone-strong bg-white px-3 py-2";
const label = "type-small font-medium";

export default async function ClientCasePage({ params }: PageProps<"/[locale]/admin/clients/[id]">) {
  const locale = await resolveLocale(params);
  const { id } = await params;
  const ctx = await requireAdminPage(locale);
  if (ctx === "forbidden") return null;
  if (!UUID.test(id)) notFound();
  const data = await getClientCase(ctx, id);
  if (!data) notFound();

  const t = await getTranslations("Admin");
  const { client, requests, activities, followUps, reminders } = data;
  const messages = formTexts(t);
  const configured = Object.keys(configuredSenders());
  const openFollowUps = followUps.filter((f) => f.status === "open");
  const pastFollowUps = followUps.filter((f) => f.status !== "open").reverse();
  const notes = activities.filter((a) => NOTE_KINDS.has(a.kind));
  const closed = client.status === "won" || client.status === "closed";
  const statusLabel = (s: string) => labelOf(t, "statuses", s);

  function describe(a: ActivityRow): string {
    const meta = a.meta as { from?: string; to?: string; due_at?: string; intent?: string; source?: string; fields?: string[] };
    switch (a.kind) {
      case "status_change":
        return t("activity.status_change", { from: statusLabel(meta.from ?? ""), to: statusLabel(meta.to ?? "") });
      case "follow_up_set":
      case "follow_up_changed":
        return t(`activity.${a.kind}`, { date: meta.due_at ? formatDubai(meta.due_at, locale) : "" });
      case "request":
        return `${t("activity.request")}: ${meta.intent ? labelOf(t, "intents", meta.intent) : ""}${meta.source ? ` · ${labelOf(t, "sources", meta.source)}` : ""}`;
      default:
        {
        const key = `activity.${a.kind}` as Parameters<typeof t>[0];
        return t.has(key) ? t(key) : a.kind;
      }
    }
  }

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/clients" className="link text-sm">
          {t("client.back")}
        </Link>
      </p>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-h3">{client.full_name}</h1>
          <StatusBadge status={client.status} label={statusLabel(client.status)} />
        </div>
        <p className="text-muted">
          {client.phone_e164 ? <Phone e164={client.phone_e164} /> : null}
          {client.email ? (
            <>
              {client.phone_e164 ? " · " : null}
              <bdi dir="ltr">{client.email}</bdi>
            </>
          ) : null}
        </p>
        <ContactButtons e164={client.phone_e164} callLabel={t("client.call")} whatsappLabel={t("client.whatsapp")} />
        <p className="type-small text-muted">
          {t("client.created")} <When iso={client.created_at} locale={locale} /> · {t("client.timezoneNote")}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="status-title" title={t("client.status")}>
          <ActionForm action={updateClientStatus} messages={messages} className="space-y-3">
            <input type="hidden" name="clientId" value={client.id} />
            <div>
              <label htmlFor="status" className={label}>
                {t("client.status")}
              </label>
              <select id="status" name="status" defaultValue={client.status} className={input}>
                {clientStatuses.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="closeReason" className={label}>
                {t("client.closeReason")}
              </label>
              <input id="closeReason" name="closeReason" maxLength={300} defaultValue={client.close_reason ?? ""} className={input} />
            </div>
            <SubmitButton pendingText={t("client.saving")}>{t("client.updateStatus")}</SubmitButton>
          </ActionForm>
          {closed ? (
            <ActionForm action={updateClientStatus} messages={messages} className="mt-4 border-t border-stone pt-4">
              <input type="hidden" name="clientId" value={client.id} />
              <input type="hidden" name="status" value="in_progress" />
              <SubmitButton variant="secondary" pendingText={t("client.saving")}>
                {t("client.reopen")}
              </SubmitButton>
            </ActionForm>
          ) : null}
        </Card>

        <Card id="followups-title" title={t("client.followUps")}>
          {openFollowUps.length === 0 ? <p className="type-small text-muted">{t("client.noFollowUps")}</p> : null}
          <ul className="space-y-4">
            {openFollowUps.map((f) => {
              const fuReminders = reminders.filter((r) => r.follow_up_id === f.id);
              return (
                <li key={f.id} className="rounded-card border border-stone p-3">
                  <p className="font-medium">
                    <When iso={f.due_at} locale={locale} />
                  </p>
                  {f.note ? <p className="type-small whitespace-pre-wrap">{f.note}</p> : null}
                  <OutboxStatus rows={fuReminders} configured={configured} locale={locale} texts={outboxTexts(t)} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ActionForm action={setFollowUpStatus} messages={messages}>
                      <input type="hidden" name="followUpId" value={f.id} />
                      <input type="hidden" name="status" value="done" />
                      <SubmitButton pendingText={t("client.saving")}>{t("client.markDone")}</SubmitButton>
                    </ActionForm>
                    <ActionForm action={setFollowUpStatus} messages={messages}>
                      <input type="hidden" name="followUpId" value={f.id} />
                      <input type="hidden" name="status" value="cancelled" />
                      <SubmitButton variant="secondary" pendingText={t("client.saving")}>
                        {t("client.cancelFollowUp")}
                      </SubmitButton>
                    </ActionForm>
                  </div>
                  <details className="mt-2">
                    <summary className="link min-h-11 inline-flex cursor-pointer items-center text-sm">{t("client.reschedule")}</summary>
                    <ActionForm action={updateFollowUp} messages={messages} className="mt-2 space-y-3">
                      <input type="hidden" name="followUpId" value={f.id} />
                      <div>
                        <label htmlFor={`due-${f.id}`} className={label}>
                          {t("client.dueAt")}
                        </label>
                        <input id={`due-${f.id}`} name="dueAt" type="datetime-local" required defaultValue={isoToDubaiInput(f.due_at)} className={input} />
                      </div>
                      <div>
                        <label htmlFor={`fnote-${f.id}`} className={label}>
                          {t("client.followUpNote")}
                        </label>
                        <textarea id={`fnote-${f.id}`} name="note" rows={2} maxLength={1000} defaultValue={f.note ?? ""} className={input} />
                      </div>
                      <SubmitButton pendingText={t("client.saving")}>{t("client.saveChanges")}</SubmitButton>
                    </ActionForm>
                  </details>
                </li>
              );
            })}
          </ul>

          <ActionForm action={createFollowUp} messages={messages} className="mt-4 space-y-3 border-t border-stone pt-4">
            <h3 className="font-medium">{t("client.setFollowUp")}</h3>
            <input type="hidden" name="clientId" value={client.id} />
            <div>
              <label htmlFor="new-due" className={label}>
                {t("client.dueAt")}
              </label>
              <input id="new-due" name="dueAt" type="datetime-local" required className={input} />
            </div>
            <div>
              <label htmlFor="new-fnote" className={label}>
                {t("client.followUpNote")}
              </label>
              <textarea id="new-fnote" name="note" rows={2} maxLength={1000} className={input} />
            </div>
            <SubmitButton pendingText={t("client.saving")}>{t("client.saveFollowUp")}</SubmitButton>
          </ActionForm>

          {pastFollowUps.length ? (
            <details className="mt-4">
              <summary className="link min-h-11 inline-flex cursor-pointer items-center text-sm">{t("client.pastFollowUps")}</summary>
              <ul className="type-small mt-2 space-y-1 text-muted">
                {pastFollowUps.map((f) => (
                  <li key={f.id}>
                    {formatDubai(f.due_at, locale)} — {labelOf(t, "client.followUpStatus", f.status)}
                    {f.note ? ` — ${f.note}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>
      </div>

      <Card id="requests-title" title={t("client.requests")}>
        <ul className="divide-y divide-stone">
          {requests.map((r) => (
            <li key={r.id} className="py-3">
              <p className="font-medium">{labelOf(t, "intents", r.intent)}</p>
              <p className="type-small text-muted">
                <When iso={r.created_at} locale={locale} /> · {labelOf(t, "sources", r.source)} · {r.locale.toUpperCase()}
                {r.submitted_name !== client.full_name ? ` · ${t("client.submittedAs", { name: r.submitted_name })}` : ""}
              </p>
              {r.purpose_text ? <p className="mt-1 whitespace-pre-wrap">{r.purpose_text}</p> : null}
              <OutboxStatus rows={r.crm_outbox} configured={configured} locale={locale} texts={outboxTexts(t)} />
            </li>
          ))}
        </ul>
        <p className="type-caption mt-2 text-muted">{t("outbox.note")}</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="notes-title" title={t("client.notes")}>
          <ActionForm action={addNote} messages={messages} className="space-y-3">
            <input type="hidden" name="clientId" value={client.id} />
            <NoteFields t={t} idPrefix="new" />
            <SubmitButton pendingText={t("client.saving")}>{t("client.saveNote")}</SubmitButton>
          </ActionForm>

          {notes.length === 0 ? <p className="type-small mt-4 text-muted">{t("client.noNotes")}</p> : null}
          <ul className="mt-4 space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-card border border-stone p-3">
                <p className="type-small text-muted">
                  {labelOf(t, "client.noteKinds", n.kind)} · <When iso={n.occurred_at} locale={locale} />
                </p>
                {n.body ? <p className="whitespace-pre-wrap">{n.body}</p> : null}
                {n.outcome ? (
                  <p className="type-small whitespace-pre-wrap">
                    <span className="font-medium">{t("client.outcome")}:</span> {n.outcome}
                  </p>
                ) : null}
                {n.next_action ? (
                  <p className="type-small whitespace-pre-wrap">
                    <span className="font-medium">{t("client.nextAction")}:</span> {n.next_action}
                  </p>
                ) : null}
                <details className="mt-1">
                  <summary className="link min-h-11 inline-flex cursor-pointer items-center text-sm">{t("client.editNote")}</summary>
                  <ActionForm action={updateNote} messages={messages} className="mt-2 space-y-3">
                    <input type="hidden" name="activityId" value={n.id} />
                    <NoteFields t={t} idPrefix={n.id} values={n} />
                    <SubmitButton pendingText={t("client.saving")}>{t("client.saveChanges")}</SubmitButton>
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card id="details-title" title={t("client.details")}>
            <ActionForm action={updateClientDetails} messages={messages} className="space-y-3">
              <input type="hidden" name="clientId" value={client.id} />
              <div>
                <label htmlFor="fullName" className={label}>
                  {t("client.name")}
                </label>
                <input id="fullName" name="fullName" required maxLength={120} defaultValue={client.full_name} className={input} />
              </div>
              <div>
                <label htmlFor="phone" className={label}>
                  {t("client.phone")}
                </label>
                <input id="phone" name="phone" type="tel" dir="ltr" defaultValue={client.phone_e164 ? formatPhone(client.phone_e164) : ""} className={input} />
              </div>
              <div>
                <label htmlFor="email" className={label}>
                  {t("client.email")}
                </label>
                <input id="email" name="email" type="email" dir="ltr" defaultValue={client.email ?? ""} className={input} />
              </div>
              <SubmitButton pendingText={t("client.saving")}>{t("client.save")}</SubmitButton>
            </ActionForm>
          </Card>

          <Card id="history-title" title={t("client.history")}>
            <ol className="space-y-2">
              {activities.map((a) => (
                <li key={a.id} className="type-small border-s-2 border-stone ps-3">
                  <p className="text-muted">
                    <When iso={a.occurred_at} locale={locale} />
                  </p>
                  <p>{NOTE_KINDS.has(a.kind) ? `${labelOf(t, "client.noteKinds", a.kind)}${a.body ? `: ${a.body}` : ""}` : describe(a)}</p>
                  {!NOTE_KINDS.has(a.kind) && a.body && a.kind !== "request" ? <p className="text-muted whitespace-pre-wrap">{a.body}</p> : null}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function NoteFields({
  t,
  idPrefix,
  values,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"Admin">>>;
  idPrefix: string;
  values?: ActivityRow;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-kind`} className={label}>
            {t("client.noteKind")}
          </label>
          <select id={`${idPrefix}-kind`} name="kind" defaultValue={values?.kind ?? "call"} className={input}>
            {noteKinds.map((k) => (
              <option key={k} value={k}>
                {t(`client.noteKinds.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-at`} className={label}>
            {t("client.occurredAt")}
          </label>
          <input
            id={`${idPrefix}-at`}
            name="occurredAt"
            type="datetime-local"
            defaultValue={values ? isoToDubaiInput(values.occurred_at) : undefined}
            className={input}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-body`} className={label}>
          {t("client.noteBody")}
        </label>
        <textarea id={`${idPrefix}-body`} name="body" rows={3} maxLength={4000} defaultValue={values?.body ?? ""} className={input} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-outcome`} className={label}>
          {t("client.outcome")}
        </label>
        <input id={`${idPrefix}-outcome`} name="outcome" maxLength={1000} defaultValue={values?.outcome ?? ""} className={input} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-next`} className={label}>
          {t("client.nextAction")}
        </label>
        <input id={`${idPrefix}-next`} name="nextAction" maxLength={1000} defaultValue={values?.next_action ?? ""} className={input} />
      </div>
    </>
  );
}

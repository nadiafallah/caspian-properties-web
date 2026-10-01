import type { AppLocale } from "@/i18n/locales";
import { followUpBucket, type FollowUpWithClient } from "@/lib/crm/admin-data";
import { Card, ClientLink, Phone, When } from "./bits";

type Texts = { overdue: string; today: string; upcoming: string; none: string };

/** Open follow-ups split into overdue / later today / upcoming (Dubai time). */
export function FollowUpGroups({
  rows,
  texts,
  locale,
  now,
  upcomingLimit,
}: {
  rows: FollowUpWithClient[];
  texts: Texts;
  locale: AppLocale;
  now: Date;
  upcomingLimit?: number;
}) {
  const groups = { overdue: [] as FollowUpWithClient[], today: [] as FollowUpWithClient[], upcoming: [] as FollowUpWithClient[] };
  for (const row of rows) groups[followUpBucket(row.due_at, now)].push(row);
  if (upcomingLimit) groups.upcoming = groups.upcoming.slice(0, upcomingLimit);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {(["overdue", "today", "upcoming"] as const).map((key) => (
        <Card key={key} id={`fu-${key}`} title={`${texts[key]} (${groups[key].length})`} className={key === "overdue" && groups[key].length ? "border-error/40" : undefined}>
          {groups[key].length === 0 ? (
            <p className="type-small text-muted">{texts.none}</p>
          ) : (
            <ul className="space-y-3">
              {groups[key].map((f) => (
                <li key={f.id} className="type-small">
                  <p>
                    {f.crm_clients ? <ClientLink id={f.crm_clients.id}>{f.crm_clients.full_name}</ClientLink> : null}
                  </p>
                  <p className={key === "overdue" ? "text-error" : "text-muted"}>
                    <When iso={f.due_at} locale={locale} />
                  </p>
                  {f.crm_clients?.phone_e164 ? (
                    <p className="text-muted">
                      <Phone e164={f.crm_clients.phone_e164} />
                    </p>
                  ) : null}
                  {f.note ? <p className="whitespace-pre-wrap">{f.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}

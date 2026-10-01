import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { Link } from "@/i18n/navigation";
import { requireAdminPage } from "@/lib/crm/admin";
import { clientStatuses, countByStatus, listOpenFollowUps, listRecentRequests } from "@/lib/crm/admin-data";
import { configuredSenders } from "@/lib/crm/outbox";
import { Card, ClientLink, OutboxStatus, StatusBadge, When } from "@/components/admin/bits";
import { FollowUpGroups } from "@/components/admin/FollowUpGroups";
import { labelOf, outboxTexts } from "@/components/admin/texts";

export default async function AdminOverviewPage({ params }: PageProps<"/[locale]/admin">) {
  const locale = await resolveLocale(params);
  const ctx = await requireAdminPage(locale);
  if (ctx === "forbidden") return null;
  const t = await getTranslations("Admin");
  const now = new Date();
  const [counts, followUps, recent] = await Promise.all([countByStatus(ctx), listOpenFollowUps(ctx), listRecentRequests(ctx)]);
  const configured = Object.keys(configuredSenders());

  return (
    <div className="space-y-8">
      <h1 className="type-h3">{t("overview.title")}</h1>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {clientStatuses.map((status) => (
          <li key={status}>
            <Link href={`/admin/clients?status=${status}`} className="block rounded-card border border-stone bg-white p-3 hover:border-bronze">
              <span className="block text-2xl font-semibold">{counts[status]}</span>
              <span className="type-small text-muted">{t(`statuses.${status}`)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <FollowUpGroups
        rows={followUps}
        locale={locale}
        now={now}
        upcomingLimit={8}
        texts={{ overdue: t("overview.overdue"), today: t("overview.today"), upcoming: t("overview.upcoming"), none: t("overview.none") }}
      />

      <Card id="recent" title={t("overview.recent")}>
        {recent.length === 0 ? (
          <p className="type-small text-muted">{t("overview.none")}</p>
        ) : (
          <ul className="divide-y divide-stone">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  {r.crm_clients ? <ClientLink id={r.crm_clients.id}>{r.crm_clients.full_name}</ClientLink> : null}
                  <p className="type-small">
                    {labelOf(t, "intents", r.intent)} · {labelOf(t, "sources", r.source)}
                  </p>
                  {r.purpose_text ? <p className="type-small text-muted line-clamp-2">{r.purpose_text}</p> : null}
                </div>
                <div className="type-small text-muted">
                  <When iso={r.created_at} locale={locale} />
                  {r.crm_clients ? (
                    <div className="mt-1">
                      <StatusBadge status={r.crm_clients.status} label={labelOf(t, "statuses", r.crm_clients.status)} />
                    </div>
                  ) : null}
                  <OutboxStatus rows={r.crm_outbox} configured={configured} locale={locale} texts={outboxTexts(t)} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3">
          <Link href="/admin/clients" className="link text-sm">
            {t("overview.viewAll")}
          </Link>
        </p>
      </Card>
    </div>
  );
}

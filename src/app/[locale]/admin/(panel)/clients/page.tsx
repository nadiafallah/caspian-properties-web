import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { Link } from "@/i18n/navigation";
import { requireAdminPage } from "@/lib/crm/admin";
import { clientStatuses, followUpBucket, followUpFilters, listClients, nextOpenFollowUp, requestIntents } from "@/lib/crm/admin-data";
import { ClientLink, Phone, StatusBadge, When } from "@/components/admin/bits";
import { labelOf } from "@/components/admin/texts";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ClientsPage({ params, searchParams }: PageProps<"/[locale]/admin/clients">) {
  const locale = await resolveLocale(params);
  const ctx = await requireAdminPage(locale);
  if (ctx === "forbidden") return null;
  const t = await getTranslations("Admin");
  const sp = await searchParams;
  const filters = { q: one(sp.q), status: one(sp.status), intent: one(sp.intent), followUp: one(sp.followUp) };
  const now = new Date();
  const rows = await listClients(ctx, filters, now);

  const select = "mt-1 min-h-11 w-full rounded-sm border border-stone-strong bg-white px-2 py-2";

  return (
    <div className="space-y-6">
      <h1 className="type-h3">{t("clients.title")}</h1>

      <form method="get" role="search" className="grid gap-3 rounded-card border border-stone bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-2">
          <label htmlFor="q" className="type-small font-medium">
            {t("clients.search")}
          </label>
          <input id="q" name="q" type="search" defaultValue={filters.q} className={select} />
        </div>
        <div>
          <label htmlFor="status" className="type-small font-medium">
            {t("clients.filterStatus")}
          </label>
          <select id="status" name="status" defaultValue={filters.status} className={select}>
            <option value="">{t("clients.any")}</option>
            {clientStatuses.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="intent" className="type-small font-medium">
            {t("clients.filterIntent")}
          </label>
          <select id="intent" name="intent" defaultValue={filters.intent} className={select}>
            <option value="">{t("clients.any")}</option>
            {requestIntents.map((i) => (
              <option key={i} value={i}>
                {t(`intents.${i}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="followUp" className="type-small font-medium">
            {t("clients.filterFollowUp")}
          </label>
          <select id="followUp" name="followUp" defaultValue={filters.followUp} className={select}>
            <option value="">{t("clients.any")}</option>
            {followUpFilters.map((f) => (
              <option key={f} value={f}>
                {t(`clients.followUpFilters.${f}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="btn btn-primary min-h-11 px-5 py-2 text-sm">
            {t("clients.apply")}
          </button>
          <Link href="/admin/clients" className="link min-h-11 inline-flex items-center text-sm">
            {t("clients.reset")}
          </Link>
        </div>
      </form>

      <p className="type-small text-muted" role="status">
        {t("clients.count", { count: rows.length })}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted">{t("clients.empty")}</p>
      ) : (
        <ul className="divide-y divide-stone rounded-card border border-stone bg-white">
          {rows.map((row) => {
            const next = nextOpenFollowUp(row);
            const bucket = next ? followUpBucket(next.due_at, now) : null;
            const intentsSeen = [...new Set(row.crm_requests.map((r) => r.intent))];
            return (
              <li key={row.id} className="grid gap-1 p-4 sm:grid-cols-[1fr_auto] sm:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClientLink id={row.id}>{row.full_name}</ClientLink>
                    <StatusBadge status={row.status} label={t(`statuses.${row.status}`)} />
                  </div>
                  <p className="type-small text-muted">
                    {row.phone_e164 ? <Phone e164={row.phone_e164} /> : row.email}
                  </p>
                  <p className="type-small">{intentsSeen.map((i) => labelOf(t, "intents", i)).join(" · ")}</p>
                </div>
                <div className="type-small text-muted sm:text-end">
                  <p>
                    {t("clients.lastActivity")} <When iso={row.last_activity_at} locale={locale} />
                  </p>
                  {next ? (
                    <p className={bucket === "overdue" ? "text-error" : undefined}>
                      {t(`clients.followUpFilters.${bucket!}`)}: <When iso={next.due_at} locale={locale} />
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

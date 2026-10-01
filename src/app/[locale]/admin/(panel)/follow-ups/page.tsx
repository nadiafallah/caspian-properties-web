import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { requireAdminPage } from "@/lib/crm/admin";
import { listOpenFollowUps } from "@/lib/crm/admin-data";
import { FollowUpGroups } from "@/components/admin/FollowUpGroups";

export default async function FollowUpsPage({ params }: PageProps<"/[locale]/admin/follow-ups">) {
  const locale = await resolveLocale(params);
  const ctx = await requireAdminPage(locale);
  if (ctx === "forbidden") return null;
  const t = await getTranslations("Admin");
  const rows = await listOpenFollowUps(ctx);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-h3">{t("followUps.title")}</h1>
        <p className="type-small mt-1 text-muted">{t("client.timezoneNote")}</p>
      </div>
      <FollowUpGroups
        rows={rows}
        locale={locale}
        now={new Date()}
        texts={{ overdue: t("overview.overdue"), today: t("overview.today"), upcoming: t("overview.upcoming"), none: t("overview.none") }}
      />
    </div>
  );
}

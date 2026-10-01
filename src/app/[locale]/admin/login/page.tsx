import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { resolveLocale } from "@/i18n/server";
import { adminPath, getAdminSession } from "@/lib/crm/admin";
import { isAuthConfigured } from "@/lib/supabase/server";
import { LoginForm } from "@/components/admin/LoginForm";

export default async function AdminLoginPage({ params, searchParams }: PageProps<"/[locale]/admin/login">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Admin.login");
  const { ctx } = await getAdminSession();
  if (ctx) redirect(adminPath(locale, "/admin"));
  const linkError = (await searchParams).error === "link";

  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-5 py-16">
      <p className="proof-label text-bronze-deep">Caspian Properties</p>
      <h1 className="type-h3 mt-3">{t("title")}</h1>
      <p className="mt-3 text-muted">{t("lead")}</p>
      {linkError ? (
        <p role="alert" className="mt-4 text-error">
          {t("linkError")}
        </p>
      ) : null}
      {isAuthConfigured() ? (
        <LoginForm
          locale={locale}
          texts={{
            email: t("email"),
            submit: t("submit"),
            sending: t("sending"),
            sent: t("sent"),
            invalid: t("invalidEmail"),
            error: t("error"),
            rateLimited: t("rateLimited"),
          }}
        />
      ) : (
        <p className="mt-6 text-error">{t("notConfigured")}</p>
      )}
    </main>
  );
}

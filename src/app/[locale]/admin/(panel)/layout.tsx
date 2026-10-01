import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { Link } from "@/i18n/navigation";
import { requireAdminPage } from "@/lib/crm/admin";
import { signOut } from "../actions";

export default async function PanelLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Admin");
  const ctx = await requireAdminPage(locale);

  const signOutForm = (
    <form action={signOut}>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className="link min-h-11 text-sm">
        {t("nav.signOut")}
      </button>
    </form>
  );

  if (ctx === "forbidden") {
    return (
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-5 py-16">
        <h1 className="type-h3">{t("forbidden.title")}</h1>
        <p className="mt-3 text-muted">{t("forbidden.body")}</p>
        <div className="mt-6">{signOutForm}</div>
      </main>
    );
  }

  return (
    <>
      <header className="border-b border-stone bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 md:px-6">
          <Link href="/admin" className="me-auto py-2 font-semibold">
            {t("brand")}
          </Link>
          <nav aria-label={t("nav.label")} className="flex flex-wrap items-center gap-x-4">
            <Link href="/admin" className="link min-h-11 inline-flex items-center text-sm">
              {t("nav.overview")}
            </Link>
            <Link href="/admin/clients" className="link min-h-11 inline-flex items-center text-sm">
              {t("nav.clients")}
            </Link>
            <Link href="/admin/follow-ups" className="link min-h-11 inline-flex items-center text-sm">
              {t("nav.followUps")}
            </Link>
          </nav>
          {signOutForm}
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-6 md:py-10">
        {children}
      </main>
    </>
  );
}

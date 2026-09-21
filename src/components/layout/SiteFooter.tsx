import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { advisor, company } from "@/config/company";
import { dldVerificationUrl } from "@/config/site";
import type { AppLocale } from "@/i18n/locales";
import { formatNumber } from "@/lib/format";
import { Container, ExternalIcon } from "@/components/ui";
import { BrandMark } from "./BrandMark";
import { LocaleList } from "./LocaleSwitcher";
import { navItems } from "./nav-items";

export async function SiteFooter() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("Footer");
  const tCommon = await getTranslations("Common");
  const tNav = await getTranslations("Nav");
  const year = formatNumber(locale, new Date().getFullYear());

  return (
    <footer className="surface-dark bg-charcoal text-white">
      <Container className="py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <BrandMark label={tCommon("brandHome")} tone="dark" />
            <p className="type-display mt-6 !text-[1.75rem] !leading-snug text-white">{tCommon("tagline")}</p>
          </div>

          <nav aria-label={tNav("footerLabel")} className="md:col-span-3">
            <ul className="flex flex-col">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex min-h-11 items-center text-stone no-underline hover:text-white">
                    {tNav(item.key)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/consultation" className="link flex min-h-11 items-center">
                  {tCommon("bookConsultation")}
                </Link>
              </li>
            </ul>
          </nav>

          <div className="md:col-span-4">
            <p className="proof-label mb-2 text-bronze-light">{tCommon("language")}</p>
            <LocaleList label={tCommon("languageSwitcher")} tone="dark" className="-ms-3" />
            <p className="mt-6">
              <a
                href={company.instagram.value.url}
                target="_blank"
                rel="noopener noreferrer"
                className="link inline-flex min-h-11 items-center gap-2"
                dir="ltr"
              >
                {company.instagram.value.handle}
                <ExternalIcon />
                <span className="sr-only">{tCommon("opensInNewTab")}</span>
              </a>
            </p>
          </div>
        </div>

        <hr className="horizon my-10 opacity-60" />

        <div className="type-small space-y-3 text-stone">
          <p>
            {t("company", {
              licence: company.licenceNumber.value,
              orn: company.orn.value,
            })}
          </p>
          <p>{t("advisor", { brn: advisor.brn.value })}</p>
          <p>
            <a href={dldVerificationUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex min-h-11 items-center gap-2">
              {t("verify")}
              <ExternalIcon />
              <span className="sr-only">{tCommon("opensInNewTab")}</span>
            </a>
          </p>
          <p className="max-w-measure">{t("disclaimer")}</p>
        </div>

        <div className="type-small mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 text-stone md:flex-row md:items-center md:justify-between">
          <p>{t("copyright", { year })}</p>
          <nav aria-label={tNav("legalLabel")}>
            <ul className="flex gap-6">
              <li>
                <Link href="/privacy" className="flex min-h-11 items-center text-stone underline-offset-4 hover:text-white hover:underline">
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="flex min-h-11 items-center text-stone underline-offset-4 hover:text-white hover:underline">
                  {t("terms")}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </Container>
    </footer>
  );
}

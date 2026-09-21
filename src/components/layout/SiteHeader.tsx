import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui";
import { BrandMark } from "./BrandMark";
import { NavLinks } from "./NavLinks";
import { LocaleMenu } from "./LocaleSwitcher";
import { MobileNav } from "./MobileNav";
import { navItems } from "./nav-items";

export async function SiteHeader() {
  const t = await getTranslations("Common");
  const tNav = await getTranslations("Nav");
  const items = navItems.map((item) => ({ href: item.href, label: tNav(item.key) }));

  return (
    <header className="sticky top-0 z-30 border-b border-stone/70 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <Container className="relative flex h-[4.5rem] items-center justify-between gap-4">
        <BrandMark label={t("brandHome")} />

        <div className="hidden items-center gap-2 lg:flex">
          <nav aria-label={tNav("mainLabel")}>
            <NavLinks items={items} />
          </nav>
          <LocaleMenu label={t("languageSwitcher")} />
          <Link href="/consultation" className="btn btn-primary ms-2">
            {t("bookConsultation")}
          </Link>
        </div>

        <MobileNav
          items={items}
          labels={{
            menu: t("menu"),
            closeMenu: t("closeMenu"),
            language: t("language"),
            languageSwitcher: t("languageSwitcher"),
            mainNav: tNav("mainLabel"),
            bookConsultation: t("bookConsultation"),
          }}
        />
      </Container>
    </header>
  );
}

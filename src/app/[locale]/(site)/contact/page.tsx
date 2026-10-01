import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { company, displayValue, whatsappUrl } from "@/config/company";
import { isLaunch } from "@/config/site";
import { pageMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbGraph } from "@/lib/structured-data";
import { ButtonLink, ExternalIcon, PageIntro, Section } from "@/components/ui";
import { ContentNeeded } from "@/components/placeholders";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">) {
  const locale = await resolveLocale(params);
  return pageMetadata({ locale, page: "contact", path: "/contact" });
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Contact");
  const tCommon = await getTranslations("Common");
  const tMeta = await getTranslations("Metadata");

  const phone = displayValue(company.phone, isLaunch);
  const whatsapp = displayValue(company.whatsapp, isLaunch);
  const email = displayValue(company.email, isLaunch);
  const address = displayValue(company.address, isLaunch);
  const missingDirect = !company.phone.verified || !company.whatsapp.verified || !company.email.verified;

  const rows: Array<{ label: string; value: string; href?: string; external?: boolean }> = [];
  if (phone) rows.push({ label: t("phone"), value: phone, href: `tel:${phone.replace(/\s/g, "")}` });
  if (whatsapp) rows.push({ label: t("whatsapp"), value: whatsapp, href: whatsappUrl(whatsapp) ?? undefined, external: true });
  if (email) rows.push({ label: t("email"), value: email, href: `mailto:${email}` });
  rows.push({
    label: t("instagram"),
    value: company.instagram.value.handle,
    href: company.instagram.value.url,
    external: true,
  });
  if (address) rows.push({ label: t("office"), value: address });

  return (
    <>
      <JsonLd data={breadcrumbGraph(locale, tMeta("siteName"), tMeta("contact.title"), "/contact")} />
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

      <Section labelledBy="contact-options">
        <h2 id="contact-options" className="sr-only">
          {t("directTitle")}
        </h2>
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="surface-dark rounded-card bg-charcoal p-8 text-white md:p-10 lg:col-span-6">
            <h3 className="type-h2 text-white">{t("cardTitle")}</h3>
            <p className="mt-4 max-w-measure text-stone">{t("cardBody")}</p>
            <p className="type-small mt-3 text-stone">{t("languages")}</p>
            <ButtonLink href="/consultation" className="mt-8">
              {tCommon("bookConsultation")}
            </ButtonLink>
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <h3 className="type-h3">{t("directTitle")}</h3>
            <dl className="mt-6 divide-y divide-stone border-y border-stone">
              {rows.map((row) => (
                <div key={row.label} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4">
                  <dt className="type-small text-muted">{row.label}</dt>
                  <dd dir="ltr" className="font-medium text-ink">
                    {row.href ? (
                      <a
                        href={row.href}
                        className="link inline-flex min-h-11 items-center gap-2"
                        {...(row.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      >
                        {row.value}
                        {row.external ? (
                          <>
                            <ExternalIcon />
                            <span className="sr-only">{tCommon("opensInNewTab")}</span>
                          </>
                        ) : null}
                      </a>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {missingDirect ? (
              <div className="mt-6">
                <ContentNeeded label={tCommon("contentNeeded")} what={t("detailsNeeded")} />
              </div>
            ) : null}
          </div>
        </div>
      </Section>
    </>
  );
}

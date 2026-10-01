import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/server";
import { company, displayValue, whatsappUrl } from "@/config/company";
import { calcom, calcomBookingUrl, consultationLanguages, isCalcomConfigured, isLaunch } from "@/config/site";
import { pickMessages } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { Container, Eyebrow } from "@/components/ui";
import { LocaleList } from "@/components/layout/LocaleSwitcher";
import { ConsultationFlow } from "@/components/consultation/ConsultationFlow";

export async function generateMetadata({ params }: PageProps<"/[locale]/consultation">) {
  const locale = await resolveLocale(params);
  return pageMetadata({ locale, page: "consultation", path: "/consultation" });
}

export default async function ConsultationPage({ params }: PageProps<"/[locale]/consultation">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Consultation");
  const messages = await getMessages();

  const whatsapp = displayValue(company.whatsapp, isLaunch);

  return (
    <section aria-labelledby="page-title" className="bg-ivory py-12 md:py-20">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12">
          <aside className="lg:col-span-4">
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h1 id="page-title" className="type-h1 mt-4">
              {t("title")}
            </h1>
            <p className="type-lead mt-5 text-muted">{t("lead")}</p>
            <div className="mt-8 rounded-card border border-stone bg-white p-5">
              <p className="type-small font-semibold text-ink">{t("languageHint")}</p>
              <LocaleList label={t("languageHint")} className="-ms-3 mt-2" />
            </div>
          </aside>

          <div className="rounded-card bg-white p-6 shadow-card sm:p-8 md:p-10 lg:col-span-8">
            <NextIntlClientProvider messages={pickMessages(messages, ["Common", "Consultation", "Contact"])}>
              <ConsultationFlow
                locale={locale}
                consultationLanguages={consultationLanguages}
                calcom={{
                  configured: isCalcomConfigured,
                  link: calcom.link,
                  namespace: calcom.namespace,
                  origin: calcom.origin,
                  bookingUrlBase: calcomBookingUrl(),
                }}
                contact={{
                  phone: displayValue(company.phone, isLaunch),
                  whatsappUrl: whatsappUrl(whatsapp),
                  email: displayValue(company.email, isLaunch),
                  instagramUrl: company.instagram.value.url,
                  instagramHandle: company.instagram.value.handle,
                }}
              />
            </NextIntlClientProvider>
          </div>
        </div>
      </Container>
    </section>
  );
}

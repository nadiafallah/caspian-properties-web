import en from "@/messages/en.json";
import fa from "@/messages/fa.json";
import ar from "@/messages/ar.json";
import { company } from "@/config/company";
import { getPathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/locales";
import { ChatLauncher } from "./ChatLauncher";

const dictionaries = { en: en.Chat, fa: fa.Chat, ar: ar.Chat };
const phoneE164 = company.phone.value.replace(/[^\d+]/g, "");
const privacyPaths = {
  en: getPathname({ locale: "en", href: "/privacy" }),
  fa: getPathname({ locale: "fa", href: "/privacy" }),
  ar: getPathname({ locale: "ar", href: "/privacy" }),
};

/** The floating Caspian assistant. Chat text for all three languages is sent, so the visitor can switch. */
export function ChatAssistant({ locale }: { locale: AppLocale }) {
  return <ChatLauncher locale={locale} dictionaries={dictionaries} phoneE164={phoneE164} privacyPaths={privacyPaths} />;
}

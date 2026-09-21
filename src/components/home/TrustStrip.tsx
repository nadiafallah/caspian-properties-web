import { getTranslations } from "next-intl/server";
import { advisor, company } from "@/config/company";
import { Container } from "@/components/ui";

/** Verified facts only (sources in src/config/company.ts). */
export async function TrustStrip() {
  const t = await getTranslations("Home.trust");
  const items = [
    t("since"),
    t("company"),
    t("orn", { orn: company.orn.value }),
    t("brn", { brn: advisor.brn.value }),
    t("languages"),
  ];

  return (
    <section aria-label={t("label")} className="border-y border-stone bg-white">
      <Container>
        <ul className="flex flex-col divide-y divide-stone/70 py-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:divide-y-0 md:py-5">
          {items.map((item) => (
            <li key={item} className="proof-label py-3 text-charcoal md:py-1">
              {item}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

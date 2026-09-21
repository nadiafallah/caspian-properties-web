import { advisor, company } from "@/config/company";
import { brandName, consultationLanguages, siteUrl } from "@/config/site";
import { locales, type AppLocale } from "@/i18n/locales";
import { absoluteUrl } from "@/lib/seo";

/** Only facts recorded as verified in src/config/company.ts. No ratings or reviews. */
export function organizationGraph() {
  const orgId = `${siteUrl}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "RealEstateAgent",
        "@id": orgId,
        name: company.legalNameEn.value,
        alternateName: [brandName, company.legalNameAr.value],
        url: siteUrl,
        logo: `${siteUrl}/brand/monogram-plate.png`,
        foundingDate: company.establishedOn.value,
        areaServed: { "@type": "City", name: "Dubai" },
        sameAs: [company.instagram.value.url],
      },
      {
        "@type": "Person",
        "@id": `${siteUrl}/#nadia`,
        name: advisor.displayName.value,
        jobTitle: advisor.role.value,
        worksFor: { "@id": orgId },
        knowsLanguage: [...consultationLanguages],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: brandName,
        inLanguage: [...locales],
        publisher: { "@id": orgId },
      },
    ],
  };
}

export function breadcrumbGraph(locale: AppLocale, homeName: string, pageName: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: homeName, item: absoluteUrl(locale, "/") },
      { "@type": "ListItem", position: 2, name: pageName, item: absoluteUrl(locale, path) },
    ],
  };
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" so content can never close the script element.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

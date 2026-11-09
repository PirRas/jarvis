import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { FEATURES, OPERATOR, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, UPDATED } from "@/lib/site";
import Today from "./Today";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  alternates: { canonical: "/", languages: { "de-CH": "/" }, types: { "text/plain": "/llms.txt" } },
};

const structured = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "de-CH",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon-512.png`,
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: `${SITE_URL}/`,
      name: SITE_TITLE,
      description: SITE_DESCRIPTION,
      inLanguage: "de-CH",
      dateModified: UPDATED,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      primaryImageOfPage: `${SITE_URL}/opengraph-image`,
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web, Android",
      inLanguage: "de-CH",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "CHF" },
      audience: { "@type": "EducationalAudience", educationalRole: "student" },
      featureList: FEATURES.map(([title]) => title),
      publisher: { "@id": `${SITE_URL}/#organization` },
      ...(OPERATOR.name ? { author: { "@type": "Person", name: OPERATOR.name } } : {}),
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={structured} />
      <Today />
    </>
  );
}

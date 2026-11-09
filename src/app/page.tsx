import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { OPERATOR, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import Today from "./Today";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  alternates: { canonical: "/", languages: { "de-CH": "/" } },
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
    },
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web, Android",
      inLanguage: "de-CH",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "CHF" },
      audience: { "@type": "EducationalAudience", educationalRole: "student" },
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

import { COMPANY, PRIMARY_PHONE, PUBLIC_SOCIAL_LINKS } from "./companyContact";

/**
 * The one schema.org entity for Digerati Experts.
 *
 * index.html used to carry a hand-written ProfessionalService block (its own phone,
 * email and social links) while the homepage added a second ITService entity, so
 * crawlers saw two businesses. Both now come from this builder: the server writes it
 * into every HTML response (server/routeMeta.ts) and the client JsonLd component
 * reuses the same object, under the same `data-jsonld="organization"` key, so there is
 * never more than one. Every value comes from shared/companyContact.ts.
 */
export const ORGANIZATION_ID = `${COMPANY.website}/#organization`;

export const ORGANIZATION_REF = { "@id": ORGANIZATION_ID } as const;

const CITIES = ["Phoenix", "Scottsdale", "Chandler", "Mesa", "Tempe", "Gilbert"] as const;

export function buildOrganizationSchema(): Record<string, unknown> {
  const telephone = PRIMARY_PHONE.schemaTelephone || PRIMARY_PHONE.e164;
  return {
    "@context": "https://schema.org",
    "@type": ["ITService", "ProfessionalService"],
    "@id": ORGANIZATION_ID,
    name: COMPANY.legalName,
    alternateName: "Digerati Experts MSP",
    description:
      "Cybersecurity-first managed IT for Arizona businesses. Partner-backed monitoring, identity/endpoint protection, and accountable day-to-day IT in one operating model.",
    url: COMPANY.website,
    telephone,
    email: COMPANY.email,
    logo: `${COMPANY.website}/favicon-512x512.png`,
    image: `${COMPANY.website}/og-image.png`,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      addressLocality: COMPANY.addressLocality,
      addressRegion: COMPANY.addressRegion,
      addressCountry: COMPANY.addressCountry,
    },
    geo: { "@type": "GeoCoordinates", latitude: COMPANY.geo.latitude, longitude: COMPANY.geo.longitude },
    hasMap: COMPANY.mapsUrl,
    areaServed: [{ "@type": "State", name: "Arizona" }, ...CITIES.map((name) => ({ "@type": "City", name }))],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "07:00",
        closes: "18:00",
      },
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "IT & Cybersecurity Services",
      itemListElement: [
        "Managed IT Services",
        "Managed Cybersecurity (SOC/MDR)",
        "Business Continuity & Disaster Recovery",
        "Co-Managed IT",
        "HIPAA & PCI compliance support",
        "Unified Communications (UCaaS)",
      ].map((name) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name } })),
    },
    founder: { "@type": "Person", name: "Joseph R. Petro" },
    sameAs: PUBLIC_SOCIAL_LINKS.map((s) => s.href),
    contactPoint: {
      "@type": "ContactPoint",
      telephone,
      contactType: "sales",
      email: COMPANY.email,
      areaServed: "US",
      availableLanguage: "English",
    },
  };
}

/** `<script>` tag for server-rendered HTML. `<` is escaped so no value can close the tag. */
export function organizationSchemaScriptTag(): string {
  const json = JSON.stringify(buildOrganizationSchema()).replace(/</g, "\\u003c");
  return `<script type="application/ld+json" data-jsonld="organization">${json}</script>`;
}

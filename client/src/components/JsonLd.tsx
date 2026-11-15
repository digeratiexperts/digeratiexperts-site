import { useEffect } from "react";
import { COMPANY, PRIMARY_PHONE, PUBLIC_SOCIAL_LINKS } from "@/data/companyContact";
import { ORGANIZATION_ID, ORGANIZATION_REF, buildOrganizationSchema } from "@shared/organizationSchema";

const SITE_URL = COMPANY.website;

interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
  id?: string;
}

export function JsonLd({ data, id = "jsonld" }: JsonLdProps) {
  useEffect(() => {
    const existing = document.querySelector(`script[data-jsonld="${id}"]`);
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-jsonld", id);
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);

    return () => {
      const el = document.querySelector(`script[data-jsonld="${id}"]`);
      if (el) el.remove();
    };
  }, [data, id]);

  return null;
}

const ORGANIZATION = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  "name": COMPANY.legalName,
  "url": SITE_URL,
  "logo": `${SITE_URL}/favicon-512x512.png`,
  "sameAs": PUBLIC_SOCIAL_LINKS.map((s) => s.href),
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": PRIMARY_PHONE.schemaTelephone || PRIMARY_PHONE.e164,
    "contactType": "sales",
    "email": COMPANY.email,
    "areaServed": "US",
    "availableLanguage": "English"
  }
};

/** The single business entity, shared with the server-rendered HTML (shared/organizationSchema.ts). */
const LOCAL_BUSINESS = buildOrganizationSchema();

export function OrganizationJsonLd() {
  return <JsonLd data={LOCAL_BUSINESS} id="organization" />;
}

export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Digerati Experts",
    "url": SITE_URL,
    "description": "Enterprise-grade managed IT and cybersecurity for Arizona businesses.",
    "publisher": ORGANIZATION_REF,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${SITE_URL}/resources/blog?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
  return <JsonLd data={data} id="website" />;
}

interface FAQJsonLdProps {
  faqs: Array<{ question: string; answer: string }>;
}

export function FAQJsonLd({ faqs }: FAQJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
  return <JsonLd data={data} id="faq" />;
}

interface ArticleJsonLdProps {
  title: string;
  description: string;
  author: string;
  datePublished: string;
  image?: string;
  url: string;
}

export function ArticleJsonLd({ title, description, author, datePublished, image, url }: ArticleJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "author": {
      "@type": "Person",
      "name": author
    },
    "publisher": ORGANIZATION,
    "datePublished": datePublished,
    "dateModified": datePublished,
    "image": image || `${SITE_URL}/og-image.png`,
    "url": `${SITE_URL}${url}`,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${SITE_URL}${url}`
    }
  };
  return <JsonLd data={data} id="article" />;
}

interface ProductJsonLdProps {
  name: string;
  description: string;
  price: string;
  priceCurrency?: string;
  image?: string;
  url: string;
  sku?: string;
  category?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
}

export function ProductJsonLd({ name, description, price, priceCurrency = "USD", image, url, sku, category, availability = "InStock" }: ProductJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": name,
    "description": description,
    "image": image || `${SITE_URL}/og-image.png`,
    "url": `${SITE_URL}${url}`,
    "sku": sku || name.replace(/\s+/g, "-").toLowerCase(),
    "category": category,
    "brand": {
      "@type": "Brand",
      "name": "Digerati Experts"
    },
    "offers": {
      "@type": "Offer",
      "price": price,
      "priceCurrency": priceCurrency,
      "availability": `https://schema.org/${availability}`,
      "seller": ORGANIZATION
    }
  };
  return <JsonLd data={data} id={`product-${sku || name}`} />;
}

interface ServiceJsonLdProps {
  name: string;
  description: string;
  url: string;
  price?: string;
  areaServed?: string;
}

export function ServiceJsonLd({ name, description, url, price, areaServed = "Arizona" }: ServiceJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": name,
    "description": description,
    "url": `${SITE_URL}${url}`,
    "provider": ORGANIZATION,
    "areaServed": {
      "@type": "State",
      "name": areaServed
    },
    "serviceType": "Managed IT Services",
    ...(price ? {
      "offers": {
        "@type": "Offer",
        "price": price,
        "priceCurrency": "USD"
      }
    } : {})
  };
  return <JsonLd data={data} id={`service-${name.replace(/\s+/g, "-").toLowerCase()}`} />;
}

interface BreadcrumbJsonLdProps {
  items: Array<{ name: string; url: string }>;
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `${SITE_URL}${item.url}`
    }))
  };
  return <JsonLd data={data} id="breadcrumb" />;
}

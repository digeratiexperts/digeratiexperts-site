import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
}

const BASE_TITLE = 'Digerati Experts';
const DEFAULT_DESCRIPTION = "Cybersecurity-first managed IT for Arizona businesses. Assessment-led recommendations, partner-backed monitoring, and accountable day-to-day IT.";
const SITE_URL = 'https://digeratiexperts.com';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

function buildFullTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return BASE_TITLE;
  // Avoid "Page | Digerati Experts | Digerati Experts" when callers already include the brand.
  if (trimmed === BASE_TITLE || trimmed.endsWith(`| ${BASE_TITLE}`)) return trimmed;
  return `${trimmed} | ${BASE_TITLE}`;
}

export function useSEO({ title, description, canonical, ogImage, noIndex }: SEOProps) {
  useEffect(() => {
    const fullTitle = buildFullTitle(title);
    const metaDescription = description || DEFAULT_DESCRIPTION;
    const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : undefined;
    const image = ogImage || DEFAULT_IMAGE;

    document.title = fullTitle;

    const updateMetaTag = (selector: string, content: string, attribute = 'content') => {
      let tag = document.querySelector(selector);
      if (tag) {
        tag.setAttribute(attribute, content);
      }
    };

    const updateOrCreateMetaTag = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let tag = document.querySelector(`meta[${attr}="${name}"]`);
      if (tag) {
        tag.setAttribute('content', content);
      } else {
        tag = document.createElement('meta');
        tag.setAttribute(attr, name);
        tag.setAttribute('content', content);
        document.head.appendChild(tag);
      }
    };

    updateOrCreateMetaTag('description', metaDescription);
    updateOrCreateMetaTag('og:title', fullTitle, true);
    updateOrCreateMetaTag('og:description', metaDescription, true);
    updateOrCreateMetaTag('og:image', image, true);
    updateOrCreateMetaTag('twitter:title', fullTitle);
    updateOrCreateMetaTag('twitter:description', metaDescription);
    updateOrCreateMetaTag('twitter:image', image);

    if (canonicalUrl) {
      updateOrCreateMetaTag('og:url', canonicalUrl, true);
      updateOrCreateMetaTag('twitter:url', canonicalUrl);
      let link = document.querySelector('link[rel="canonical"]');
      if (link) {
        link.setAttribute('href', canonicalUrl);
      }
    }

    if (noIndex) {
      updateOrCreateMetaTag('robots', 'noindex, nofollow');
    } else {
      updateOrCreateMetaTag('robots', 'index, follow');
    }

    return () => {
      document.title = BASE_TITLE;
    };
  }, [title, description, canonical, ogImage, noIndex]);
}

export default useSEO;

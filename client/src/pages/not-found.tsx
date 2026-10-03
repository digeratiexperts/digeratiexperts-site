import { useLocation } from "wouter";
import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  FeatureGrid,
  HeroActions,
} from "@/components/site/chapters";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import {
  isMarketingFallbackPath,
  MarketingRouteFallback,
} from "@/pages/MarketingRouteFallback";

export function NotFoundPage() {
  useSEO({
    title: "404 - Page Not Found",
    description:
      "The page you are looking for could not be found. Return to the Digerati Experts homepage for managed IT and cybersecurity services.",
    noIndex: true,
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Error 404"
      title="Page not found"
      subtitle="That URL isn’t on digeratiexperts.com. Head home, or book a Cyber Risk Assessment if you were looking for help."
      showBackButton={false}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: "Back to Home", href: "/" }}
            secondary={{ label: "Contact us", href: "/contact" }}
          />
        </div>
      }
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <ChapterHeader tone="paper" eyebrow="Try these" title="Where people usually mean to go" />
          <FeatureGrid
            tone="paper"
            columns={4}
            items={[
              { title: "Solutions", text: "Managed IT, security and compliance.", href: "/solutions", linkLabel: "Browse solutions" },
              { title: "Plans & pricing", text: "How engagements are scoped.", href: CTA.secondaryHref, linkLabel: "See pricing" },
              { title: "Support", text: "Self-service topics for clients.", href: "/support/knowledge-base", linkLabel: "Knowledge base" },
              { title: "Contact", text: "Call or send a message.", href: "/contact", linkLabel: "Contact us" },
            ]}
          />
        </Container>
      </Chapter>

      <ClosingCta
        tone="well"
        title="Need a Cyber Risk Assessment instead?"
        lede="If you landed here looking for help, book a time. We’ll review the environment and recommend a fit."
        primary={{ label: CTA.primary, href: "/book" }}
      />
    </PageTemplate>
  );
}

/**
 * App.tsx intentionally keeps its current routing unchanged while stale PR #59
 * is ported. Recognized campaign/resource URLs are dispatched here with a real
 * Wouter route context; every other unmatched URL remains the actual 404 page.
 */
export default function NotFound() {
  const [location] = useLocation();

  if (isMarketingFallbackPath(location)) {
    return <MarketingRouteFallback />;
  }

  return <NotFoundPage />;
}

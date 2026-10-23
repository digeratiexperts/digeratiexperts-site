import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { CAMPAIGNS } from "@/data/campaigns";
import { Chapter, ClosingCta, Container, HeroActions } from "@/components/site/chapters";

export default function CampaignIndex() {
  useSEO({
    title: "Offers for Arizona businesses",
    description:
      "Explore Digerati Experts services for Arizona businesses — Cyber Risk Assessment, ProActive managed IT, ransomware readiness, co-managed IT, and industry paths.",
    canonical: "/go",
  });

  return (
    <PageTemplate
      title="Find the right next step for your business"
      eyebrow="Business priorities"
      subtitle="Explore support for cyber risk, managed IT, recovery, and compliance. Choose the priority that fits your business to see how DE can help."
      breadcrumbs={[{ label: "Offers" }]}
      layout="chapters"
      actions={<HeroActions primary={{ label: CTA.primary, href: "/book" }} />}
    >
      {/* Light field: the hero and the closing band are dark, so the list reads as paper (Homepage v2 rhythm). */}
      <Chapter tone="paper" seam={false}>
        <Container>
          <ol className="border-t border-[var(--de-paper-hairline)]">
            {CAMPAIGNS.map((campaign, index) => (
              <li key={campaign.slug} className="border-b border-[var(--de-paper-hairline)]">
                <Link
                  href={`/go/${campaign.slug}`}
                  className="de-interactive-card group grid gap-3 py-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ec4899] md:grid-cols-[4rem_1fr_auto] md:items-center md:gap-8"
                  data-testid={`campaign-index-${campaign.slug}`}
                >
                  <span className="font-mono text-sm font-semibold text-de-magenta-paper-ink">0{index + 1}</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/60">{campaign.eyebrow}</p>
                    <h2 className="mt-2 font-heading text-2xl font-semibold text-[#1A1228] group-hover:text-de-magenta-paper-ink">
                      {campaign.offerName}
                    </h2>
                    <p className="mt-2 max-w-2xl text-base leading-relaxed text-[#3A3448]">{campaign.lede}</p>
                  </div>
                  <span className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-de-magenta-paper-ink">
                    Explore this service
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        title="Not sure where to start?"
        lede="Tell us what is changing in your business. We can help you choose a practical next step."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
      />
    </PageTemplate>
  );
}

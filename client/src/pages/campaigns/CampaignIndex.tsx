import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { CAMPAIGNS } from "@/data/campaigns";
import { Chapter, ClosingCta, Container, HeroActions, Eyebrow } from "@/components/site/chapters";

export default function CampaignIndex() {
  useSEO({
    title: "Offers for Arizona businesses",
    description:
      "Campaign pages for Digerati Experts services — Cyber Risk Assessment, ProActive managed IT, ransomware readiness, co-managed IT, and industry paths.",
    canonical: "/go",
  });

  return (
    <PageTemplate
      title="Offers built to advertise"
      eyebrow="Campaign pages"
      subtitle="Each page is one offer, one primary action, and copy taken from the real ProActive, assessment, standalone, and co-managed architecture — not a second website."
      breadcrumbs={[{ label: "Offers" }]}
      layout="chapters"
      actions={<HeroActions primary={{ label: CTA.primary, href: "/book" }} />}
    >
      <Chapter tone="well" seam={false}>
        <Container>
          <ol className="border-t border-[var(--de-hairline)]">
            {CAMPAIGNS.map((campaign, index) => (
              <li key={campaign.slug} className="border-b border-[var(--de-hairline)]">
                <Link
                  href={`/go/${campaign.slug}`}
                  className="de-interactive-card group grid gap-3 py-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ec4899] md:grid-cols-[4rem_1fr_auto] md:items-center md:gap-8"
                  data-testid={`campaign-index-${campaign.slug}`}
                >
                  <span className="font-mono text-sm font-semibold text-de-magenta-ink">0{index + 1}</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{campaign.eyebrow}</p>
                    <h2 className="mt-2 font-heading text-2xl font-semibold text-white group-hover:text-de-magenta-ink">
                      {campaign.offerName}
                    </h2>
                    <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/70">{campaign.lede}</p>
                  </div>
                  <span className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-de-magenta-ink">
                    Open page
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <Eyebrow tone="paper" className="mb-4">
            For media buyers
          </Eyebrow>
          <h2 className="font-heading text-3xl font-semibold tracking-[-0.02em] text-[#1A1228] md:text-4xl">
            How to advertise these
            <span className="text-[#D3126A]" aria-hidden="true">
              :
            </span>
          </h2>
          <p className="mt-4 max-w-[68ch] text-base leading-relaxed text-[#3A3448]">
            One offer per ad group. Send paid traffic to the matching /go URL — not the homepage. The primary
            button on every page is Get My Cyber Risk Assessment. Do not add review counts, certifications,
            response times, or invented case results to the creative.
          </p>
          <div className="mt-8 overflow-x-auto" tabIndex={0} role="region" aria-label="Recommended search titles and landing URLs">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Recommended search titles and landing URLs</caption>
              <thead>
                <tr className="border-b border-black/15 text-xs font-semibold uppercase tracking-[0.12em] text-black/65">
                  <th scope="col" className="py-3 pr-4 font-semibold">Offer</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Landing URL</th>
                  <th scope="col" className="py-3 font-semibold">Recommended search title</th>
                </tr>
              </thead>
              <tbody>
                {CAMPAIGNS.map((campaign) => (
                  <tr key={campaign.slug} className="border-b border-black/10 align-top">
                    <td className="py-3 pr-4 font-medium text-[#1A1228]">{campaign.offerName}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-black/75">/go/{campaign.slug}</td>
                    <td className="py-3 text-black/75">{campaign.seoTitle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        title="Not sure which offer is honest?"
        lede="Start with the Cyber Risk Assessment conversation. The page you advertise should match the path we would actually recommend."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
      />
    </PageTemplate>
  );
}

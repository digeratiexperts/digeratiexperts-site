import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { CAMPAIGNS } from "@/data/campaigns";

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
      subtitle="Each page is one offer, one primary action, and copy taken from the real ProActive, assessment, standalone, and co-managed architecture — not a second website."
      breadcrumbs={[{ label: "Offers" }]}
      actions={
        <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold">
          <a href="/book">{CTA.primary}</a>
        </Button>
      }
    >
      <div className="space-y-16">
        <ol className="divide-y divide-de-hairline border-y border-de-hairline">
          {CAMPAIGNS.map((campaign, index) => (
            <li key={campaign.slug}>
              <Link
                href={`/go/${campaign.slug}`}
                className="group grid gap-4 py-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-accent md:grid-cols-[4rem_1fr_auto] md:items-start"
                data-testid={`campaign-index-${campaign.slug}`}
              >
                <span className="font-mono text-sm text-de-accent-ink">0{index + 1}</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                    {campaign.eyebrow}
                  </p>
                  <h2 className="mt-2 font-heading text-2xl font-semibold text-white group-hover:text-de-accent-ink">
                    {campaign.offerName}
                  </h2>
                  <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/60">{campaign.lede}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-de-accent-ink">
                  Open page
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <section className="de-paper-chapter de-field-grain-paper rounded-2xl px-6 py-10 sm:px-10">
          <h2 className="font-heading text-2xl font-semibold tracking-[-0.02em] text-[#1A1228] md:text-3xl">
            How to advertise these
            <span className="text-[#D3126A]" aria-hidden="true">
              :
            </span>
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-black/65">
            One offer per ad group. Send paid traffic to the matching /go URL — not the homepage. The primary
            button on every page is Get My Cyber Risk Assessment. Do not add review counts, certifications,
            response times, or invented case results to the creative.
          </p>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Recommended search titles and landing URLs</caption>
              <thead>
                <tr className="border-b border-black/15 text-xs font-semibold uppercase tracking-[0.12em] text-black/45">
                  <th className="py-3 pr-4 font-semibold">Offer</th>
                  <th className="py-3 pr-4 font-semibold">Landing URL</th>
                  <th className="py-3 font-semibold">Recommended search title</th>
                </tr>
              </thead>
              <tbody>
                {CAMPAIGNS.map((campaign) => (
                  <tr key={campaign.slug} className="border-b border-black/10 align-top">
                    <td className="py-3 pr-4 font-medium text-[#1A1228]">{campaign.offerName}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-black/70">/go/{campaign.slug}</td>
                    <td className="py-3 text-black/70">{campaign.seoTitle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <ConversionPathBar
          headline="Not sure which offer is honest?"
          body="Start with the Cyber Risk Assessment conversation. The page you advertise should match the path we would actually recommend."
        />
      </div>
    </PageTemplate>
  );
}

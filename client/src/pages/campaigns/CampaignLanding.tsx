import { Link, useParams } from "wouter";
import { ArrowRight, Download, Phone } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { StatementHeading } from "@/components/visual/StatementHeading";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { campaignBySlug } from "@/data/campaigns";
import { RESOURCE_TYPE_LABEL, resourceBySlug, resourceLandingMeta } from "@/data/resourceRegistry";
import { briefBySlug } from "@/data/executiveBriefs";
import NotFound from "@/pages/not-found";

export default function CampaignLanding() {
  const params = useParams<{ slug?: string }>();
  const campaign = campaignBySlug(params.slug ?? "");

  if (!campaign) {
    return <NotFound />;
  }

  const asset = campaign.relatedAssetSlug ? resourceBySlug(campaign.relatedAssetSlug) : undefined;
  const assetMeta = asset ? resourceLandingMeta[asset.slug] : undefined;
  const brief = campaign.relatedBriefSlug ? briefBySlug(campaign.relatedBriefSlug) : undefined;

  useSEO({
    title: campaign.seoTitle,
    description: campaign.seoDescription,
    canonical: `/go/${campaign.slug}`,
  });

  return (
    <div className="min-h-screen bg-de-bg">
      <MegaMenu />
      <main id="main-content">
        <section className="de-dark-well de-field-grain de-field-lit de-nav-clear border-b border-de-hairline">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-12 md:px-8 md:py-20">
            <div className="md:col-span-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-de-accent-ink">
                {campaign.eyebrow}
              </p>
              <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl lg:text-[3.25rem] lg:leading-[1.05]">
                {campaign.headline}
                <span className="text-de-accent-ink" aria-hidden="true">
                  :
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/72 md:text-xl">
                {campaign.lede}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold">
                  <a href="/book" data-testid="campaign-primary-cta">
                    {CTA.primary}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 border-white/20 px-6 font-semibold text-white hover:bg-white/10"
                >
                  <Link href={campaign.deeperHref} data-testid="campaign-secondary-cta">
                    {campaign.deeperLabel}
                  </Link>
                </Button>
              </div>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/50">{campaign.pricingNote}</p>
            </div>
            <aside className="md:col-span-5">
              <div className="rounded-2xl border border-de-hairline bg-de-raised p-6 md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Who this is for</p>
                <p className="mt-3 text-base leading-relaxed text-white/80">{campaign.audience}</p>
                <a
                  href={PRIMARY_PHONE.telHref}
                  className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white hover:text-de-accent-ink"
                >
                  <Phone className="h-4 w-4 text-de-accent-ink" />
                  {PRIMARY_PHONE.display}
                </a>
              </div>
            </aside>
          </div>
        </section>

        <section className="bg-de-surface">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:grid md:grid-cols-12 md:gap-16 md:px-8 md:py-20">
            <div className="md:col-span-5">
              <StatementHeading as="h2" className="text-3xl md:text-4xl">
                What is actually at stake
              </StatementHeading>
              <p className="mt-4 text-base leading-relaxed text-white/60">
                These are the operating failures the conversation is built to surface — not scare statistics.
              </p>
            </div>
            <ol className="mt-10 space-y-8 md:col-span-7 md:mt-0">
              {campaign.stakes.map((stake, index) => (
                <li key={stake.title} className="grid gap-3 sm:grid-cols-[3rem_1fr]">
                  <span className="font-mono text-sm text-de-accent-ink">0{index + 1}</span>
                  <div>
                    <h3 className="font-heading text-xl font-semibold text-white">{stake.title}</h3>
                    <p className="mt-2 text-base leading-relaxed text-white/65">{stake.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-de-bg">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-16 lg:px-8 lg:py-20">
            <div className="lg:col-span-5">
              <StatementHeading as="h2" className="text-3xl md:text-4xl">
                What you leave with
              </StatementHeading>
              <p className="mt-4 text-base leading-relaxed text-white/60">
                Specific enough to act on. Honest about what is not included until it is scoped.
              </p>
            </div>
            <ul className="mt-10 space-y-4 lg:col-span-7 lg:mt-0">
              {campaign.includes.map((item) => (
                <li
                  key={item}
                  className="border-l border-[#D3126A] pl-5 text-base leading-relaxed text-white/80"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="de-paper-chapter de-field-grain-paper">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <h2 className="font-heading text-3xl font-semibold tracking-[-0.02em] text-[#1A1228] md:text-4xl">
              How the engagement runs
              <span className="text-[#D3126A]" aria-hidden="true">
                :
              </span>
            </h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {campaign.process.map((step, index) => (
                <li key={step.title}>
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#D3126A]">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-3 font-heading text-xl font-semibold text-[#1A1228]">{step.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-black/65">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-de-surface">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-8 lg:py-20">
            <div>
              <h2 className="font-heading text-2xl font-semibold text-white">
                A fit
                <span className="text-de-accent-ink" aria-hidden="true">
                  :
                </span>
              </h2>
              <ul className="mt-6 space-y-3 text-base leading-relaxed text-white/70">
                {campaign.fitFor.map((item) => (
                  <li key={item} className="border-l border-[#D3126A] pl-4">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-heading text-2xl font-semibold text-white">
                Not a fit
                <span className="text-de-accent-ink" aria-hidden="true">
                  :
                </span>
              </h2>
              <ul className="mt-6 space-y-3 text-base leading-relaxed text-white/70">
                {campaign.fitNot.map((item) => (
                  <li key={item} className="border-l border-white/20 pl-4">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {(asset || brief) && (
          <section className="bg-de-bg">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <StatementHeading as="h2" className="text-3xl">
                Take the briefing with you
              </StatementHeading>
              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                {asset && (
                  <article className="rounded-2xl border border-de-hairline bg-de-raised p-6 md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                      {RESOURCE_TYPE_LABEL[asset.type]}
                    </p>
                    <h3 className="mt-2 font-heading text-xl font-semibold text-white">{asset.title}</h3>
                    {assetMeta && (
                      <p className="mt-3 text-sm leading-relaxed text-white/60">{assetMeta.tagline}</p>
                    )}
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <Button asChild variant="brand">
                        <a href={asset.file} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          {asset.cta}
                        </a>
                      </Button>
                      <Button asChild variant="outline" className="border-de-hairline text-white hover:bg-de-bg">
                        <Link href={asset.route}>Open {RESOURCE_TYPE_LABEL[asset.type].toLowerCase()} page</Link>
                      </Button>
                    </div>
                  </article>
                )}
                {brief && (
                  <article className="rounded-2xl border border-de-hairline bg-de-raised p-6 md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                      Executive brief
                    </p>
                    <h3 className="mt-2 font-heading text-xl font-semibold text-white">{brief.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-white/60">{brief.dek}</p>
                    <Button asChild variant="outline" className="mt-6 border-de-hairline text-white hover:bg-de-bg">
                      <Link href={`/resources/briefs/${brief.slug}`}>Read the brief</Link>
                    </Button>
                  </article>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="bg-de-surface">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <StatementHeading as="h2" className="text-3xl">
              Questions buyers actually ask
            </StatementHeading>
            <dl className="mt-10 space-y-8">
              {campaign.faqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="font-heading text-lg font-semibold text-white">{faq.question}</dt>
                  <dd className="mt-2 text-base leading-relaxed text-white/65">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="bg-de-bg px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <ConversionPathBar
              headline="Get My Cyber Risk Assessment"
              body="A working session on your Arizona environment — then a recommended path with ownership named."
            />
          </div>
        </section>
      </main>
      <DigeratiEnhancedFooterSection />
    </div>
  );
}

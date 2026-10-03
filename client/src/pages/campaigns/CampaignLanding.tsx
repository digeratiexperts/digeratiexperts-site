import { Link, useParams } from "wouter";
import { Download } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { campaignBySlug } from "@/data/campaigns";
import { RESOURCE_TYPE_LABEL, resourceBySlug, resourceLandingMeta } from "@/data/resourceRegistry";
import { briefBySlug } from "@/data/executiveBriefs";
// The plain 404: the default export re-dispatches marketing paths back here (infinite loop on an unknown slug).
import { NotFoundPage as NotFound } from "@/pages/not-found";
import {
  Chapter,
  ChapterHeader,
  CheckList,
  ClosingCta,
  Container,
  FaqChapter,
  HeroActions,
  HeroFacts,
  IndexedList,
  StepRail,
  cardDark,
} from "@/components/site/chapters";

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
    <PageTemplate
      title={campaign.headline}
      eyebrow={campaign.eyebrow}
      subtitle={campaign.lede}
      layout="chapters"
      showBackButton={false}
      actions={
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <HeroActions
              primary={{ label: CTA.primary, href: "/book", testId: "campaign-primary-cta" }}
              secondary={{ label: campaign.deeperLabel, href: campaign.deeperHref, testId: "campaign-secondary-cta" }}
            />
          </div>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/60">{campaign.pricingNote}</p>
        </>
      }
      heroAside={
        <HeroFacts
          title="Who this is for"
          rows={[
            { label: "Audience", value: campaign.audience },
            {
              label: "Call",
              value: (
                <a
                  href={PRIMARY_PHONE.telHref}
                  className="inline-flex min-h-11 items-center hover:text-de-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                >
                  {PRIMARY_PHONE.display}
                </a>
              ),
            },
          ]}
        />
      }
    >
      <Chapter tone="surface" seam={false}>
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="The stakes"
            title="What is actually at stake"
            lede="These are the operating failures the conversation is built to surface — not scare statistics."
          />
          <IndexedList tone="surface" columns={campaign.stakes.length === 2 ? 2 : 3} items={campaign.stakes.map((s) => ({ title: s.title, text: s.body }))} />
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <ChapterHeader
                tone="paper"
                eyebrow="The deliverable"
                title="What you leave with"
                lede="Specific enough to act on. Honest about what is not included until it is scoped."
                layout="stack"
                className="mb-0 md:mb-0"
              />
            </div>
            <div className="lg:col-span-7">
              <CheckList tone="paper" columns={1} items={campaign.includes} />
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="well">
        <Container>
          <ChapterHeader tone="well" eyebrow="The process" title="How the engagement runs" layout="stack" />
          <StepRail tone="well" steps={campaign.process.map((p) => ({ title: p.title, text: p.body }))} />
        </Container>
      </Chapter>

      <Chapter tone="surface">
        <Container>
          <div className="grid gap-12 md:grid-cols-2 md:gap-14">
            <div>
              <h2 className="font-heading text-2xl font-semibold text-white">
                A fit
                <span className="text-de-accent-ink" aria-hidden="true">
                  :
                </span>
              </h2>
              <div className="mt-6">
                <CheckList tone="surface" columns={1} items={campaign.fitFor} />
              </div>
            </div>
            <div>
              <h2 className="font-heading text-2xl font-semibold text-white">
                Not a fit
                <span className="text-de-accent-ink" aria-hidden="true">
                  :
                </span>
              </h2>
              <ul className="mt-6 space-y-4">
                {campaign.fitNot.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-base leading-relaxed text-white/70">
                    <span aria-hidden="true" className="mt-[0.7rem] h-px w-3 shrink-0 bg-white/50" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </Chapter>

      {(asset || brief) && (
        <Chapter tone="well">
          <Container>
            <ChapterHeader tone="well" eyebrow="Documents" title="Take the briefing with you" layout="stack" />
            <div className="grid gap-5 lg:grid-cols-2">
              {asset && (
                <article className={`${cardDark} p-6 md:p-8`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                    {RESOURCE_TYPE_LABEL[asset.type]}
                  </p>
                  <h3 className="mt-2 font-heading text-xl font-semibold text-white">{asset.title}</h3>
                  {assetMeta && <p className="mt-3 text-base leading-relaxed text-white/70">{assetMeta.tagline}</p>}
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Button asChild variant="brand" className="min-h-11">
                      <a href={asset.file} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                        {asset.cta}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </Button>
                    <Button asChild variant="outline" className="min-h-11 border-white/25 text-white hover:bg-white/10 hover:text-white">
                      <Link href={asset.route}>Open {RESOURCE_TYPE_LABEL[asset.type].toLowerCase()} page</Link>
                    </Button>
                  </div>
                </article>
              )}
              {brief && (
                <article className={`${cardDark} p-6 md:p-8`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Executive brief</p>
                  <h3 className="mt-2 font-heading text-xl font-semibold text-white">{brief.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-white/70">{brief.dek}</p>
                  <Button asChild variant="outline" className="mt-6 min-h-11 border-white/25 text-white hover:bg-white/10 hover:text-white">
                    <Link href={`/resources/briefs/${brief.slug}`}>Read the brief</Link>
                  </Button>
                </article>
              )}
            </div>
          </Container>
        </Chapter>
      )}

      <FaqChapter faqs={campaign.faqs} title="Questions buyers actually ask" eyebrow="Before you book" />

      <ClosingCta
        tone="surface"
        title="Get My Cyber Risk Assessment"
        lede="A working session on your Arizona environment — then a recommended path with ownership named."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
      />
    </PageTemplate>
  );
}

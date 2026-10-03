import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { XCircle } from "lucide-react";
import {
  Chapter,
  Container,
  ChapterHeader,
  CheckList,
  ClosingCta,
  FeatureGrid,
  HeroActions,
  HeroFacts,
  IndexedList,
  bodyClass,
} from "@/components/site/chapters";
import { CTA } from "@/lib/ctaCopy";
import { pricing, formatPrice, formatUserPrice, type ProActiveTierKey } from "@/data/pricing";

export interface TierPageConfig {
  id: string;
  shortName: string;
  fullName: string;
  canonicalPath: string;
  seoTitle: string;
  seoDescription: string;
  heroBadge: string;
  tagline: string;
  positioning: string;
  whoFor: string[];
  outcomes: string[];
  included: string[];
  notIncluded?: string[];
  addOnsOrUpgrades: { label: string; desc: string }[];
  reviewCadence: string;
  pricingNote: string;
  ctaPrimary: { label: string; href: string };
}

/** Two-column chapter lead: heading left, body right. */
const SplitRow = ({ lead, children }: { lead: React.ReactNode; children: React.ReactNode }) => (
  <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
    <div className="lg:col-span-4">{lead}</div>
    <div className="lg:col-span-8">{children}</div>
  </div>
);

export function TierDetailTemplate({ config }: { config: TierPageConfig }) {
  useSEO({
    title: config.seoTitle,
    description: config.seoDescription,
    canonical: config.canonicalPath,
  });

  const tier = (config.id in pricing ? pricing[config.id as ProActiveTierKey] : undefined) ?? undefined;

  return (
    <PageTemplate
      layout="chapters"
      eyebrow={config.heroBadge}
      title={config.fullName}
      subtitle={config.tagline}
      breadcrumbs={[
        { label: "Solutions", href: "/solutions" },
        { label: config.fullName },
      ]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book" }}
            secondary={{ label: CTA.secondary, href: "/proactive-ecosystem-pricing" }}
          />
        </div>
      }
      heroAside={
        tier ? (
          <HeroFacts
            title="At a glance"
            rows={[
              { label: "Starts at", value: formatUserPrice(tier.id) },
              { label: "Monthly minimum", value: `${formatPrice(tier.monthlyMinimum)}/mo` },
              { label: "Best fit", value: tier.idealBuyer },
            ]}
            footnote="A fit-based operating model, not a ranking. Final pricing is confirmed after an assessment."
          />
        ) : undefined
      }
    >
      <Chapter tone="well" seam={false}>
        <Container>
          <SplitRow
            lead={
              <ChapterHeader
                tone="well"
                layout="stack"
                eyebrow="Overview"
                title={`Where ${config.shortName} fits`}
                className="mb-0"
              />
            }
          >
            <p className="max-w-[62ch] text-lg leading-relaxed text-white/85">{config.positioning}</p>
          </SplitRow>

          <div className="mt-14 border-t border-[var(--de-hairline)] pt-14">
            <SplitRow
              lead={
                <ChapterHeader tone="well" layout="stack" eyebrow="Fit" title="Who It's For" className="mb-0" />
              }
            >
              <CheckList tone="well" columns={1} items={config.whoFor} />
            </SplitRow>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <ChapterHeader tone="paper" eyebrow="Outcomes" title="What You Get" layout="stack" />
          <IndexedList tone="paper" columns={2} items={config.outcomes.map((t) => ({ title: t }))} />
        </Container>
      </Chapter>

      <Chapter tone="surface">
        <Container>
          <ChapterHeader tone="surface" eyebrow="Scope" title="What's Included" layout="stack" />
          <CheckList tone="surface" items={config.included} />

          {config.notIncluded && config.notIncluded.length > 0 && (
            <div className="mt-14 border-t border-[var(--de-hairline)] pt-14">
              <SplitRow
                lead={
                  <ChapterHeader
                    tone="surface"
                    layout="stack"
                    eyebrow="Boundaries"
                    title="Not Included at This Level"
                    className="mb-0"
                  />
                }
              >
                <ul className="space-y-4">
                  {config.notIncluded.map((item) => (
                    <li key={item} className={`flex items-start gap-3 text-base leading-relaxed ${bodyClass("surface")}`}>
                      <XCircle className="mt-1 h-4 w-4 shrink-0 text-white/55" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </SplitRow>
            </div>
          )}
        </Container>
      </Chapter>

      <Chapter tone="well">
        <Container>
          <ChapterHeader tone="well" eyebrow="Options" title="Add-Ons & Upgrades" layout="stack" />
          <FeatureGrid
            tone="well"
            items={config.addOnsOrUpgrades.map((a) => ({ title: a.label, text: a.desc }))}
          />
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <SplitRow
            lead={
              <ChapterHeader
                tone="paper"
                layout="stack"
                eyebrow="Cadence"
                title="Reporting & Review Cadence"
                className="mb-0"
              />
            }
          >
            <p className="max-w-[62ch] text-lg leading-relaxed text-[#3A3448]">{config.reviewCadence}</p>
          </SplitRow>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        eyebrow="Pricing"
        title="Pricing"
        lede={config.pricingNote}
        primary={{ label: CTA.primary, href: "/book" }}
        secondary={{ label: CTA.secondary, href: "/proactive-ecosystem-pricing" }}
      />
    </PageTemplate>
  );
}

export default TierDetailTemplate;

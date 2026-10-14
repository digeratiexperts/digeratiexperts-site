import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { ServiceMatrix } from "@/components/ServiceMatrix";
import { ServiceCapabilityMatrix } from "@/components/ServiceCapabilityMatrix";
import { pageNarratives, type PageNarrative } from "@/pages/routes/pageNarratives";
import { CTA } from "@/lib/ctaCopy";
import {
  Chapter,
  Container,
  ChapterHeader,
  CheckList,
  ClosingCta,
  FactStrip,
  FaqChapter,
  FeatureGrid,
  HeroActions,
  IndexedList,
  StepRail,
  cardDark,
  inkClass,
} from "@/components/site/chapters";
import { Shield, Clock, Award, Users } from "lucide-react";
import { plateForServiceKey } from "@/components/site/PlateBand";

interface ServiceFeature {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface ServiceStat {
  value: string;
  label: string;
  source: string;
}

interface GenericServicePageProps {
  title: string;
  subtitle: string;
  description: string;
  features: ServiceFeature[];
  benefits: string[];
  gradientColors?: string;
  stat?: ServiceStat;
  canonical?: string;
  recommendedTier?: "it" | "office" | "business" | "enterprise";
  serviceKey?: string;
  narrative?: PageNarrative;
}

function breadcrumbsFromCanonical(
  canonical: string | undefined,
  title: string,
): { label: string; href?: string }[] | undefined {
  if (!canonical) return undefined;
  const family = canonical.startsWith("/solutions/")
    ? { label: "Solutions", href: "/solutions" }
    : canonical.startsWith("/industries/")
      ? { label: "Industries", href: "/industries" }
      : canonical.startsWith("/resources/")
        ? { label: "Resources", href: "/resources" }
        : canonical.startsWith("/support/")
          ? { label: "Support", href: "/about/support" }
          : canonical.startsWith("/about/")
            ? { label: "About" }
            : canonical.startsWith("/trust/")
              ? { label: "Trust", href: "/trust/trust-center" }
              : canonical.startsWith("/legal/")
                ? { label: "Legal" }
                : null;
  if (!family) return undefined;
  return [family, { label: title }];
}

const eyebrowFromCanonical = (canonical?: string) =>
  !canonical
    ? undefined
    : canonical.startsWith("/solutions/")
      ? "Solutions"
      : canonical.startsWith("/industries/")
        ? "Industries"
        : canonical.startsWith("/about/")
          ? "About Digerati Experts"
          : canonical.startsWith("/support/")
            ? "Support"
            : canonical.startsWith("/trust/")
              ? "Trust"
              : undefined;

/** Facts the site already states elsewhere (SOC, local team, managed protection, SLA). */
const serviceFacts = [
  { icon: Shield, title: "24/7 human-led SOC", text: "Monitoring behind the managed stack" },
  { icon: Users, title: "Arizona engineering team", text: "Chandler / East Valley operator" },
  { icon: Award, title: "8 blocks of managed protection", text: "One program, not point tools" },
  { icon: Clock, title: "Defined response times", text: "SLA-backed support" },
];

export default function GenericServicePage({
  title,
  subtitle,
  description,
  features,
  benefits,
  stat,
  canonical,
  recommendedTier,
  serviceKey,
  narrative: narrativeProp,
}: GenericServicePageProps) {
  const narrative = narrativeProp ?? (serviceKey ? pageNarratives[serviceKey] : undefined);
  const breadcrumbs = breadcrumbsFromCanonical(canonical, title);

  useSEO({
    title,
    description,
    canonical,
  });

  const painPoints = narrative?.painPoints ?? [];
  const process = (narrative?.process ?? []).map((s) => ({ title: s.title, text: s.description }));
  const faqs = (narrative?.faqs ?? []).map((f) => ({ question: f.q, answer: f.a }));
  const proof = narrative?.proof;
  // Sourced statistics are labelled as industry context; anything else is an illustration, never a named client.
  const proofIsSourced = !!proof && /context|dbir|sophos|ibm|verizon/i.test(proof.attribution);

  return (
    <PageTemplate
      layout="chapters"
      title={title}
      subtitle={subtitle}
      variant="dark"
      eyebrow={eyebrowFromCanonical(canonical)}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book", testId: "button-hero-assessment" }}
            secondary={features.length > 0 ? { label: "See what's included", href: "#included" } : undefined}
          />
        </div>
      }
    >
      <FactStrip facts={serviceFacts} label="Why Arizona businesses choose Digerati Experts" />

      <Chapter tone="well" seam={false}>
        <Container>
          <div className={stat ? "grid items-start gap-10 lg:grid-cols-12 lg:gap-14" : undefined}>
            <div className={stat ? "lg:col-span-7" : "max-w-3xl"}>
              <p className="text-xl leading-relaxed text-white/80 md:text-2xl md:leading-relaxed">{description}</p>
              {narrative?.whoFor && (
                <p className="mt-6 text-base leading-relaxed text-white/70 md:text-lg">
                  <span className="font-semibold text-white">Who this is for: </span>
                  {narrative.whoFor}
                </p>
              )}
            </div>
            {stat && (
              <div className="lg:col-span-5" data-testid="service-stat-callout">
                <div className={`${cardDark} p-6 md:p-8`}>
                  <p className="font-heading text-4xl font-semibold tracking-[-0.02em] text-de-accent-ink md:text-5xl">
                    {stat.value}
                  </p>
                  <p className="mt-3 text-base leading-relaxed text-white/80">{stat.label}</p>
                  <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-white/55">{stat.source}</p>
                </div>
              </div>
            )}
          </div>
        </Container>
      </Chapter>

      {painPoints.length > 0 && (
        <Chapter tone="surface" data-testid="section-pain-points">
          <Container>
            <ChapterHeader
              tone="surface"
              eyebrow="Is this you"
              title="Does any of this sound familiar?"
              lede="If two or more feel familiar, this page is for your office."
            />
            <IndexedList tone="surface" columns={2} items={painPoints.map((p) => ({ title: p }))} />
          </Container>
        </Chapter>
      )}

      {(features.length > 0 || benefits.length > 0) && (
        <Chapter tone="paper" id="included" className="scroll-mt-28">
          <Container>
            {features.length > 0 && (
              <>
                <ChapterHeader
                  tone="paper"
                  eyebrow="What you get"
                  title="What you get"
                  lede="The working parts of the service, run by our team on the DE stack."
                />
                <FeatureGrid tone="paper" items={features.map((f) => ({ title: f.title, text: f.description }))} />
              </>
            )}
            {benefits.length > 0 && (
              <div
                className={`grid gap-8 lg:grid-cols-12 lg:gap-14 ${features.length > 0 ? "mt-14 border-t border-[var(--de-paper-hairline)] pt-10" : ""}`}
              >
                <h2 className={`font-heading text-2xl font-semibold leading-tight md:text-3xl lg:col-span-4 ${inkClass("paper")}`}>
                  Outcomes that matter
                </h2>
                <div className="lg:col-span-8">
                  <CheckList tone="paper" items={benefits} />
                </div>
              </div>
            )}
          </Container>
        </Chapter>
      )}

      {process.length > 0 && (
        <Chapter plate={plateForServiceKey(serviceKey)} tone="well" data-testid="section-process">
          <Container>
            <ChapterHeader
              tone="well"
              eyebrow="Engagement"
              title="How engagement works"
              lede="A clear path, not a black box of tickets."
            />
            <StepRail tone="well" steps={process} />
          </Container>
        </Chapter>
      )}

      {(narrative?.arizonaNote || proof) && (
        <Chapter tone="surface" data-testid="section-local-proof">
          <Container>
            <div className="grid gap-5 md:grid-cols-2">
              {narrative?.arizonaNote && (
                <div className={`${cardDark} p-7 md:p-8`}>
                  <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-de-magenta-ink">
                    Arizona operator
                  </p>
                  <p className="text-lg leading-relaxed text-white/85">{narrative.arizonaNote}</p>
                </div>
              )}
              {proof && (
                <div className={`${cardDark} border-[#D3126A]/35 p-7 md:p-8`}>
                  <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-de-magenta-ink">
                    {proofIsSourced ? "Industry context" : "Typical outcome (illustrative, not a named client)"}
                  </p>
                  <p className="text-lg leading-relaxed text-white">“{proof.quote}”</p>
                  <p className="mt-3 text-sm text-white/60">{proof.attribution}</p>
                </div>
              )}
            </div>
          </Container>
        </Chapter>
      )}

      {serviceKey && (
        <Chapter tone="well">
          <Container>
            <ChapterHeader
              tone="well"
              eyebrow="Tiers"
              title="Service tiers"
              lede="Compare what’s included at each tier."
            />
            <ServiceCapabilityMatrix
              serviceKey={serviceKey}
              highlightTier={recommendedTier === "it" ? "essentials" : recommendedTier}
            />
          </Container>
        </Chapter>
      )}

      {recommendedTier && (
        <Chapter tone="surface">
          <Container>
            <ChapterHeader
              tone="surface"
              eyebrow="Fit"
              title="Where this capability typically lives"
              lede="Fit language, not a ranking. Confirm the operating model in your Cyber Risk Assessment."
            />
            <ServiceMatrix variant="full" highlightTier={recommendedTier} showOnlyHighlighted={!!recommendedTier} />
          </Container>
        </Chapter>
      )}

      {faqs.length > 0 && (
        <div data-testid="section-faqs">
          <FaqChapter faqs={faqs} title="Questions owners actually ask" />
        </div>
      )}

      <ClosingCta
        title={narrative?.ctaHeadline || "Schedule your cyber risk assessment"}
        lede={
          narrative?.ctaBody ||
          "We’ll map risk, stack gaps, and the right next step for your Arizona business, without a hard sell."
        }
        primary={{ label: CTA.primary, href: "/book", testId: "button-contact" }}
        phoneTestId="button-call"
      />
    </PageTemplate>
  );
}

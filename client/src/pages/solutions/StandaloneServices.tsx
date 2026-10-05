import { CheckCircle2, PackageCheck, ShieldCheck, SlidersHorizontal, Wrench } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  FeatureGrid,
  HeroActions,
  HeroFacts,
} from "@/components/site/chapters";
import { SolutionsRelationshipTable } from "@/components/site/SolutionsRelationshipTable";
import { useSEO } from "@/hooks/useSEO";

const standalonePrinciples = [
  {
    icon: PackageCheck,
    title: "A preconfigured DE solution",
    body: "Start from an approved business need and receive a customer-readable package with included line items and sizing based on your business profile.",
  },
  {
    icon: SlidersHorizontal,
    title: "Standard standalone pricing",
    body: "Standalone is the normal transactional price position. It does not assume an ongoing shared operating relationship with DE.",
  },
  {
    icon: Wrench,
    title: "Choose how it gets implemented",
    body: "Self-install where supported, add remote DE implementation help, or schedule hands-on technical work when the package requires it.",
  },
  {
    icon: ShieldCheck,
    title: "No managed-IT enrollment",
    body: "Your business or existing IT provider owns ongoing operation unless you separately select DE support or move into a Co-Managed or ProActive relationship.",
  },
];

const flow = [
  ["0", "Profile", "Users, computers, mobile devices, sites, ownership model, and internal IT."],
  ["1", "Pain / Need", "Start with the business problem instead of choosing technology manufacturers."],
  ["2", "Solution", "Select the Standalone offer and review the package built for that need."],
  ["3", "Package & Delivery", "See included line items, sizing, shipping/provisioning, installation, and support options."],
  ["4", "Contact", "Company, name, email, and phone only when you are ready to continue."],
];

const comparisons = [
  ["Operating model", "You / your current IT operate it", "Shared with DE", "DE owns the broader IT operating model"],
  ["Pricing position", "Standard", "Preferred where commercially justified", "ProActive plan pricing"],
  ["Implementation", "Self / existing IT / optional DE help", "Joint plan", "DE-led within plan scope"],
  ["Ongoing support", "Optional", "Shared / defined", "Included by service agreement"],
  ["Best fit", "You want the solution without changing IT providers", "You have IT capability and want DE involved", "You want DE to act as the IT department"],
];

export default function StandaloneServices() {
  useSEO({
    title: "Standalone IT & Cybersecurity Solutions | Digerati Experts",
    description:
      "Buy a preconfigured Digerati Experts technology or cybersecurity solution without enrolling in a traditional managed IT program. Choose self-install, remote implementation help, or on-site support where available.",
    canonical: "/solutions/standalone-services",
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Standalone Solutions"
      title="Buy the solution. Keep control of your IT."
      subtitle="Standalone means you can buy a DE-designed package for a specific business need without turning your whole environment over to a new managed-services provider."
      breadcrumbs={[{ label: "Solutions", href: "/solutions" }, { label: "Standalone Services" }]}
      actions={
        <div data-testid="heading-standalone-hero">
          <div className="flex flex-col gap-3 sm:flex-row">
            <HeroActions
              primary={{ label: "Build a standalone solution", href: "/store" }}
              secondary={{ label: "Compare Co-Managed", href: "/solutions/co-managed-it" }}
            />
          </div>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/60">
            No payment is taken in the public builder. DE confirms package fit, scope, fulfillment, and pricing before commitment.
          </p>
        </div>
      }
      heroAside={
        <HeroFacts
          title="Standalone at a glance"
          rows={comparisons.map(([dimension, standalone]) => ({ label: dimension, value: standalone }))}
          footnote="One definition everywhere: the same Business Solution Builder as the rest of Door 2."
        />
      }
    >
      <Chapter tone="well" seam={false} aria-labelledby="standalone-means">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="One definition everywhere"
            title="What Standalone means at DE"
            titleId="standalone-means"
          />
          <FeatureGrid
            tone="well"
            columns={4}
            items={standalonePrinciples.map((p) => ({ icon: p.icon, title: p.title, text: p.body }))}
          />
        </Container>
      </Chapter>

      <Chapter plate="white" tone="paper" aria-labelledby="standalone-flow">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Same Store engine"
            title="One buying flow, not another mini-store"
            titleId="standalone-flow"
            lede="This page explains the relationship. The actual package, quantities, fulfillment, and submission all come from the same Business Solution Builder used across Door 2."
          />
          <ol className="relative grid gap-8 md:grid-cols-2 lg:grid-cols-5 lg:gap-6">
            <span aria-hidden="true" className="absolute left-0 right-0 top-5 hidden h-px bg-[var(--de-paper-hairline)] lg:block" />
            {flow.map(([number, title, body]) => (
              <li key={number} className="relative">
                <span className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--de-paper-hairline)] bg-white font-mono text-sm font-semibold text-de-magenta-paper-ink">
                  {String(Number(number) + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 font-heading text-lg font-semibold leading-snug text-[#1A1228]">{title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-[#3A3448]">{body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Chapter>

      <Chapter tone="surface" aria-labelledby="relationship-compare">
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="Compare"
            title="Choose the relationship, not a duplicate catalog"
            titleId="relationship-compare"
            layout="stack"
          />
          <SolutionsRelationshipTable tone="surface" rows={comparisons} label="Standalone services table" />
        </Container>
      </Chapter>

      <ClosingCta
        tone="well"
        eyebrow="Next step"
        title="Start with your profile, then pick the need"
        lede={
          <>
            The Store will show what is included, how quantities are sized, whether anything ships, and whether self-install, remote setup, or a technician makes sense for that package.
            <span className="mt-4 flex items-start gap-2 text-sm text-white/65">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
              If a package genuinely requires an assessment, the builder will say so. DE does not force the same assessment step onto every standalone purchase.
            </span>
          </>
        }
        primary={{ label: "Open the Solution Builder", href: "/store" }}
      />
    </PageTemplate>
  );
}

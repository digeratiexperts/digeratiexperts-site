import { Layers, Shield, Users, ClipboardCheck, GitBranch } from "lucide-react";
import { EcosystemProgression } from "@/components/EcosystemProgression";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  FactStrip,
  FeatureGrid,
  HeroActions,
  HeroFacts,
  IndexedList,
  StepRail,
} from "@/components/site/chapters";
import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { BreadcrumbJsonLd, ServiceJsonLd } from "@/components/JsonLd";
import { CTA } from "@/lib/ctaCopy";
import { pricing, pricingTiers, formatUserPrice, formatPrice, PRICING_SCOPE_NOTE } from "@/data/pricing";
import { ProActiveEcosystemDiagram } from "@/components/visual/ProActiveEcosystemDiagram";
import { AssessmentReportSample } from "@/components/evidence/AssessmentReportSample";
import { ScrollStory } from "@/scrollstory/ScrollStory";
import { EnvironmentAssembly } from "@/scrollstory/EnvironmentAssembly";

/** Folio chapters, labelled with the page's existing heading language. */
const CHAPTERS = [
  { id: "ch-model", label: "Cybersecurity-first IT" },
  { id: "ch-architecture", label: "Operating architecture" },
  { id: "ch-progression", label: "Ecosystem progression" },
  { id: "ch-assessment", label: "Assessment report" },
  { id: "ch-capabilities", label: "Capabilities per tier" },
  { id: "ch-fit", label: "Standalone and co-managed" },
  { id: "ch-compare", label: "Compare capabilities" },
];

const lifecycle = [
  { title: "Assessment", body: "Review identity, endpoints, email, backups, network, and operating reality — not a sales script." },
  { title: "Roadmap", body: "Match the operating model to the environment. If Office would need heavy modification, Business is the fit." },
  { title: "Implementation", body: "Documented credentials, owned by you. Controls, backup, and monitoring sized to the model." },
  { title: "Operations", body: "Day-to-day support and managed security are included at every tier; detection, response, recovery, compliance, and review depth increase with the operating model." },
];

export default function ProActiveEcosystemPage() {
  useSEO({
    title: "ProActive Ecosystem",
    description:
      "Digerati Experts ProActive Ecosystem is the umbrella operating model: IT, Office, Business, and Enterprise. Cybersecurity-first managed IT matched to how your environment actually runs.",
    canonical: "/solutions/proactive-ecosystem",
  });

  const tierRows = [
    {
      name: "IT",
      text: (
        <>
          Service desk plus the DE Security Foundation: managed endpoint, identity, email, awareness, and security monitoring baseline. Starts at {formatUserPrice("it")} ({formatPrice(pricing.it.monthlyMin)}/mo minimum).
        </>
      ),
    },
    {
      name: "Office",
      text: (
        <>
          Adds 24/7 managed detection and response, managed network, stronger identity/email protection, endpoint backup, and an annual technology + cyber review. Starts at {formatUserPrice("office")} ({formatPrice(pricing.office.monthlyMin)}/mo minimum).
        </>
      ),
    },
    {
      name: "Business",
      text: (
        <>
          Deepens security operations and response, adds BCDR posture, compliance/risk reporting support, and semi-annual reviews. Starts at {formatUserPrice("business")} ({formatPrice(pricing.business.monthlyMin)}/mo minimum).
        </>
      ),
    },
    {
      name: "Enterprise",
      text: (
        <>
          Adds unified posture reporting, deeper compliance reporting, custom BCDR architecture support, privileged access program elements, quarterly executive reviews. Starts at {formatUserPrice("enterprise")} ({formatPrice(pricing.enterprise.monthlyMin)}/mo minimum).
        </>
      ),
    },
  ];

  return (
    <PageTemplate
      layout="chapters"
      readable
      eyebrow="Solutions · Door 1"
      title="The ProActive Ecosystem"
      subtitle="ProActive is the umbrella — not a single “Office package.” It is a cybersecurity-first managed IT operating model that progresses IT → Office → Business → Enterprise. Each tier is a fit for a different environment, not a merchandising rank."
      breadcrumbs={[{ label: "Solutions", href: "/solutions" }, { label: "ProActive Ecosystem" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book" }}
            secondary={{ label: CTA.secondary, href: "/proactive-ecosystem-pricing" }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Starting rates"
          rows={pricingTiers.map((t) => ({
            label: t.label,
            value: `${formatUserPrice(t.id)} · ${formatPrice(t.monthlyMinimum)}/mo min`,
          }))}
          footnote="Four fit-based operating models — not a ranking. Final scope is confirmed after a Cyber Risk Assessment."
        />
      }
    >
      <ServiceJsonLd
        name="ProActive Ecosystem"
        description="Cybersecurity-first managed IT operating model with four fit-based tiers: IT, Office, Business, and Enterprise."
        url="/solutions/proactive-ecosystem"
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "ProActive Ecosystem", url: "/solutions/proactive-ecosystem" },
        ]}
      />

      <ScrollStory chapters={CHAPTERS}>
        <FactStrip
          label="ProActive Ecosystem at a glance"
          facts={[
            { icon: Layers, title: "4 models", text: "IT · Office · Business · Enterprise" },
            { icon: Shield, title: "8 blocks", text: "Engineered architecture" },
            { icon: Users, title: "Arizona", text: "Principal-led engagement" },
          ]}
        />

        <Chapter
          tone="well"
          seam={false}
          id="ch-model"
          data-de-chapter="0"
          data-sc-act="flow"
          data-sc-in
          data-sc-stagger="60"
        >
          <Container>
            <ChapterHeader
              tone="well"
              eyebrow="The model"
              title="Cybersecurity-first IT, one accountable relationship"
            />
            <FeatureGrid
              tone="well"
              items={[
                { icon: Shield, title: "Cybersecurity-first IT", text: "Every ProActive tier includes the DE Security Foundation across identity, endpoint, email, awareness, and managed security monitoring. Higher tiers add deeper response, recovery, compliance, and governance." },
                { icon: Layers, title: "One accountable model", text: "Support, workplace, security operations, and strategy sit in one operating relationship instead of a pile of vendors." },
                { icon: GitBranch, title: "Fit, not upsell theater", text: "We match users, devices, locations, infrastructure, compliance, and whether you need fully managed or co-managed coverage." },
              ]}
            />
          </Container>
        </Chapter>

        {/* The peak: the fragmented environment assembles under scroll.
            Coded visual only; resolves into the real diagram below. */}
        <section
          id="ch-architecture"
          data-de-chapter="1"
          data-sc-act="pin"
          data-sc-span="2.2"
          className="de-peak"
        >
          <div data-sc-stage>
            <EnvironmentAssembly />
            <p className="de-peak__caption" data-sc-cue="0.5 0.95 0.2 0.3">
              <strong>One accountable model.</strong> Support, workplace, security
              operations, and strategy in one operating relationship instead of a
              pile of vendors.
            </p>
          </div>
        </section>

        <Chapter tone="surface">
          <Container>
            <ProActiveEcosystemDiagram />
          </Container>
        </Chapter>

        <Chapter tone="well" id="ch-progression" data-de-chapter="2" data-sc-act="flow">
          <Container>
            <ChapterHeader
              tone="well"
              eyebrow="ProActive Ecosystem"
              title="Four operating models. One matched to your environment."
              lede="We do not start with a package and pile on add-ons. If Office would need heavy modification, Business is the correct fit for that environment — not universally “better.” User count is a signal, never the sole criterion."
            />
            <div data-sc-reveal="up" data-sc-reveal-at="0.04 0.4">
              <EcosystemProgression bare />
            </div>
          </Container>
        </Chapter>

        <Chapter tone="surface" id="ch-assessment" data-de-chapter="3" data-sc-act="flow">
          <Container>
            <div data-sc-parallax="-0.5">
              <AssessmentReportSample />
            </div>
          </Container>
        </Chapter>

        <Chapter
          tone="paper"
          id="ch-capabilities"
          data-de-chapter="4"
          data-sc-act="flow"
          data-sc-in
          data-sc-stagger="70"
        >
          <Container>
            <ChapterHeader tone="paper" eyebrow="By tier" title="Capabilities added per tier" lede={PRICING_SCOPE_NOTE} />
            <IndexedList tone="paper" columns={2} items={tierRows.map((r) => ({ title: r.name, text: r.text }))} />

            <div className="mt-16 border-t border-[var(--de-paper-hairline)] pt-14">
              <ChapterHeader tone="paper" eyebrow="Engagement" title="How engagement works" layout="stack" />
              <StepRail tone="paper" steps={lifecycle.map((l) => ({ title: l.title, text: l.body }))} />
            </div>
          </Container>
        </Chapter>

        <Chapter tone="surface" id="ch-fit" data-de-chapter="5" data-sc-act="flow">
          <Container>
            <ChapterHeader tone="surface" eyebrow="Fit" title="Standalone and co-managed" layout="stack" />
            <div data-sc-reveal="up" data-sc-reveal-at="0.05 0.42">
              <FeatureGrid
                tone="surface"
                columns={2}
                items={[
                  {
                    icon: ClipboardCheck,
                    title: "Standalone vs ProActive",
                    text: "Standalone services solve a specific gap — backup, UCaaS, awareness, a project — when a full operating relationship is not the right fit yet. ProActive is the ongoing model: one accountable partner for day-to-day IT and cybersecurity.",
                    href: "/solutions/standalone-services",
                    linkLabel: "View standalone services",
                  },
                  {
                    icon: Users,
                    title: "Co-managed vs ProActive",
                    text: "Co-managed extends an internal IT team with DE operations, security coverage, and escalation — you keep the team. Fully managed ProActive is for organizations that want DE to own the operating model end to end.",
                    href: "/solutions/co-managed-it",
                    linkLabel: "See co-managed IT",
                  },
                ]}
              />
            </div>
          </Container>
        </Chapter>

        <div id="ch-compare" data-de-chapter="6" data-sc-act="flow" data-sc-in>
          <ClosingCta
            tone="well"
            eyebrow="Compare"
            title="Compare capabilities and operating depth"
            lede="The comparison matrix shows what is included at each tier — not which package is “highest” or “best.” Final scope is confirmed after a Cyber Risk Assessment."
            primary={{ label: "Compare all packages", href: "/proactive-ecosystem-pricing" }}
            secondary={{ label: CTA.primary, href: "/book" }}
          />
        </div>
      </ScrollStory>
    </PageTemplate>
  );
}

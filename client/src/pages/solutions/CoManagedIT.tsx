import { Handshake, Layers3, Network, PackageCheck, ShieldCheck, Wrench } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  CheckList,
  ClosingCta,
  FeatureGrid,
  HeroActions,
  HeroFacts,
  cardDark,
} from "@/components/site/chapters";
import { SolutionsRelationshipTable } from "@/components/site/SolutionsRelationshipTable";
import { useSEO } from "@/hooks/useSEO";

const principles = [
  {
    icon: Handshake,
    title: "Shared responsibility",
    body: "DE and your technology team agree who owns each part of the selected solution instead of creating two overlapping IT departments.",
  },
  {
    icon: PackageCheck,
    title: "The same preconfigured packages",
    body: "Co-Managed uses the same customer-readable package engine as Standalone. The relationship changes; DE does not maintain a second hidden mini-catalog for it.",
  },
  {
    icon: ShieldCheck,
    title: "Preferred pricing position",
    body: "Co-Managed can receive preferred pricing where the ongoing relationship legitimately reduces delivery effort or creates shared operating value. It is not a blanket percentage discount.",
  },
  {
    icon: Wrench,
    title: "Joint implementation and support",
    body: "Remote setup, escalation, technical assistance, and on-site work can be coordinated with your team based on what the selected package actually requires.",
  },
];

const responsibilityExamples = [
  ["Business approvals", "Client", "DE supports the process; your business retains approval authority."],
  ["Package design", "DE", "DE defines the approved solution package and documented boundaries."],
  ["Implementation", "Shared", "The selected install mode and responsibility map determine who executes each step."],
  ["Day-to-day operation", "Shared", "Responsibilities are assigned explicitly instead of implied by a generic service label."],
  ["Escalation", "Shared", "Your team keeps its role while DE provides the agreed specialist or operational lane."],
];

const comparisons = [
  ["Who is this for?", "Business wants the package without an ongoing DE operating relationship", "Business already has IT capability and wants DE involved", "Business wants DE to own the broader IT operating model"],
  ["Pricing", "Standard", "Preferred where justified", "Plan / tier pricing"],
  ["Responsibility", "Customer / current provider", "Shared and documented", "Primarily DE within contracted scope"],
  ["Support", "Optional", "Part of the shared design where selected", "Part of the managed service"],
];

export default function CoManagedIT() {
  useSEO({
    title: "Co-Managed IT & Cybersecurity Solutions | Digerati Experts",
    description:
      "Keep your internal IT capability and add Digerati Experts where it helps. Build co-managed technology and cybersecurity packages with defined responsibilities, implementation options, and preferred pricing where appropriate.",
    canonical: "/solutions/co-managed-it",
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Co-Managed Solutions"
      title="Keep your IT team. Add DE where it helps."
      subtitle="Co-Managed is a shared operating relationship for selected solutions. Your team stays in the picture; DE adds package design, implementation capacity, specialist support, monitoring, or escalation where the agreed responsibility model calls for it."
      breadcrumbs={[{ label: "Solutions", href: "/solutions" }, { label: "Co-Managed IT" }]}
      actions={
        <div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <HeroActions
              primary={{ label: "Build a co-managed solution", href: "/store" }}
              secondary={{ label: "Compare Standalone", href: "/solutions/standalone-services" }}
            />
          </div>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/60">
            Preferred pricing is a commercial position, not a promise of a fixed percentage discount on every product or service.
          </p>
        </div>
      }
      heroAside={
        <HeroFacts
          title="Co-Managed at a glance"
          rows={comparisons.slice(1).map(([dimension, , coManaged]) => ({ label: dimension, value: coManaged }))}
          footnote="Co-Managed changes the responsibility and pricing relationship, not the package catalog."
        />
      }
    >
      <Chapter tone="well" seam={false} aria-labelledby="co-managed-means">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="One definition everywhere"
            title="What Co-Managed means at DE"
            titleId="co-managed-means"
          />
          <FeatureGrid
            tone="well"
            columns={4}
            items={principles.map((p) => ({ icon: p.icon, title: p.title, text: p.body }))}
          />
        </Container>
      </Chapter>

      <Chapter tone="paper" aria-labelledby="responsibility-model">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              <ChapterHeader
                tone="paper"
                layout="stack"
                eyebrow="Responsibility"
                title="The responsibility matrix is part of the solution"
                titleId="responsibility-model"
                lede="Co-Managed should remove ambiguity, not add it. The package and scope identify which activities belong to DE, which stay with your team, and which require both sides."
                className="mb-0"
              />
            </div>
            <div className="lg:col-span-8">
              <dl className="border-t border-[var(--de-paper-hairline)]">
                {responsibilityExamples.map(([capability, owner, explanation]) => (
                  <div
                    key={capability}
                    className="grid gap-1.5 border-b border-[var(--de-paper-hairline)] py-5 md:grid-cols-[11rem_6rem_minmax(0,1fr)] md:gap-6"
                  >
                    <dt className="font-heading text-base font-semibold text-[#1A1228]">{capability}</dt>
                    <dd className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-de-magenta-paper-ink md:pt-1">
                      {owner}
                    </dd>
                    <dd className="text-base leading-relaxed text-[#3A3448]">{explanation}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="surface" aria-labelledby="same-engine">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-7">
              <ChapterHeader
                tone="surface"
                layout="stack"
                eyebrow="Same engine"
                title="No separate “kits” store or parallel package system"
                titleId="same-engine"
                lede="Hardware, identity, backup, network, security, communications, and other needs all flow through the same Business Solution Builder. Your business profile sizes the package once; Co-Managed changes the responsibility and pricing relationship rather than creating a competing catalog."
              />
              <CheckList
                tone="surface"
                items={[
                  "One business profile across every package",
                  "Customer-readable included line items",
                  "Shipping and provisioning behavior per package",
                  "Self-install, remote, and on-site choices where supported",
                  "Remote-support preference captured before contact",
                  "Only company, name, email, and phone at the end",
                ]}
              />
            </div>
            <aside className={`${cardDark} self-start p-6 md:p-7 lg:col-span-5`}>
              <Network className="h-6 w-6 text-de-accent-ink" aria-hidden="true" />
              <h3 className="mt-4 font-heading text-lg font-semibold text-white">Good Co-Managed fit</h3>
              <p className="mt-2 text-base leading-relaxed text-white/70">
                You have an internal technology owner, IT staff, or an existing provider you intend to keep—and you want DE to own or strengthen specific agreed capabilities with clear handoffs.
              </p>
            </aside>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="paper" aria-labelledby="relationship-choice">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Compare"
            title="Three relationships. One clear boundary between them."
            titleId="relationship-choice"
            layout="stack"
          />
          <SolutionsRelationshipTable rows={comparisons} label="Co-managed IT responsibility table" />
        </Container>
      </Chapter>

      <ClosingCta
        tone="well"
        eyebrow="Next step"
        title="Build the need first. Define the shared model second."
        lede="Start with users, devices, and sites, select the business pain, and let the Store generate the package. Then choose Co-Managed so the same solution is scoped around shared responsibilities and the appropriate commercial position."
        primary={{ label: "Open the Solution Builder", href: "/store" }}
      />
    </PageTemplate>
  );
}

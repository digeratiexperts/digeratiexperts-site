import { Link } from "wouter";
import { ArrowRight, Layers, Shield, Users, ClipboardCheck, GitBranch } from "lucide-react";
import { EcosystemProgression } from "@/components/EcosystemProgression";
import { IconWell } from "@/components/visual/IconWell";
import { Button } from "@/components/ui/button";
import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { BreadcrumbJsonLd, ServiceJsonLd } from "@/components/JsonLd";
import { CTA } from "@/lib/ctaCopy";
import { pricing, formatUserPrice, formatPrice, PRICING_SCOPE_NOTE } from "@/data/pricing";
import { ProofChip } from "@/components/evidence/ProofChip";
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
  { title: "Operations", body: "Day-to-day support, security operations where included, and reviews at the cadence of that tier." },
];

export default function ProActiveEcosystemPage() {
  useSEO({
    title: "ProActive Ecosystem",
    description:
      "Digerati Experts ProActive Ecosystem is the umbrella operating model: IT, Office, Business, and Enterprise. Cybersecurity-first managed IT matched to how your environment actually runs.",
    canonical: "/solutions/proactive-ecosystem",
  });

  return (
    <PageTemplate
      title="The ProActive Ecosystem"
      subtitle="ProActive is the umbrella — not a single “Office package.” It is a cybersecurity-first managed IT operating model that progresses IT → Office → Business → Enterprise. Each tier is a fit for a different environment, not a merchandising rank."
      breadcrumbs={[{ label: "Solutions", href: "/solutions" }, { label: "ProActive Ecosystem" }]}
      actions={
        <div className="flex flex-wrap gap-3">
          <Button asChild className="h-12 bg-[#D3126A] px-6 font-semibold text-white">
            <Link href="/book">
              {CTA.primary}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 border-white/20 px-6 font-semibold text-white hover:bg-white/10">
            <Link href="/proactive-ecosystem-pricing">{CTA.secondary}</Link>
          </Button>
        </div>
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
      <div className="space-y-16">
          {/* Sourced Contextual Proof Chips */}
          <div className="flex flex-wrap items-center gap-3">
            <ProofChip metric="4 MODELS" label="IT · Office · Business · Enterprise" icon={Layers} />
            <ProofChip metric="8 BLOCKS" label="Engineered Architecture" icon={Shield} />
            <ProofChip metric="ARIZONA" label="Principal-Led Engagement" icon={Users} />
          </div>

          <section
            id="ch-model"
            data-de-chapter="0"
            data-sc-act="flow"
            data-sc-in
            data-sc-stagger="60"
            className="grid gap-6 md:grid-cols-3"
          >
            {[
              { icon: Shield, title: "Cybersecurity-first IT", body: "Identity, endpoints, email, and recovery are designed in — not bolted on after a help-desk contract." },
              { icon: Layers, title: "One accountable model", body: "Support, workplace, security operations, and strategy sit in one operating relationship instead of a pile of vendors." },
              { icon: GitBranch, title: "Fit, not upsell theater", body: "We match users, devices, locations, infrastructure, compliance, and whether you need fully managed or co-managed coverage." },
            ].map((item) => (
              <div key={item.title} className="de-hud-card p-6 transition-all duration-200 hover:border-[#D3126A]/40">
                <IconWell icon={item.icon} size="sm" surface="dark" />
                <h2 className="mt-4 text-lg font-semibold text-white font-heading">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{item.body}</p>
              </div>
            ))}
          </section>

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

          {/* Flagship Ecosystem Operating Architecture Diagram */}
          <section className="mb-16">
            <ProActiveEcosystemDiagram />
          </section>

          <section
            id="ch-progression"
            data-de-chapter="2"
            data-sc-act="flow"
            className="mb-16"
          >
            <div data-sc-reveal="up" data-sc-reveal-at="0.04 0.4">
              <EcosystemProgression />
            </div>
          </section>

          {/* Discovery Deliverable Sample Excerpt */}
          <section
            id="ch-assessment"
            data-de-chapter="3"
            data-sc-act="flow"
            className="mb-16"
          >
            <div data-sc-parallax="-0.5">
              <AssessmentReportSample />
            </div>
          </section>

          <section
            id="ch-capabilities"
            data-de-chapter="4"
            data-sc-act="flow"
            data-sc-in
            data-sc-stagger="70"
            className="mb-16 grid gap-10 lg:grid-cols-2"
          >
            <div>
              <h2 className="font-heading text-2xl font-semibold text-white">Capabilities added per tier</h2>
              <ul className="mt-6 space-y-4">
                <li className="text-sm leading-relaxed text-white/70">
                  <span className="font-semibold text-white">IT</span> — service desk, endpoint foundation, identity guidance, documented environment. Starts at {formatUserPrice("it")} ({formatPrice(pricing.it.monthlyMin)}/mo minimum).
                </li>
                <li className="text-sm leading-relaxed text-white/70">
                  <span className="font-semibold text-white">Office</span> — adds managed network, stronger identity/email hygiene, endpoint backup, annual technology + cyber review. Starts at {formatUserPrice("office")} ({formatPrice(pricing.office.monthlyMin)}/mo minimum).
                </li>
                <li className="text-sm leading-relaxed text-white/70">
                  <span className="font-semibold text-white">Business</span> — adds security operations / threat detection, awareness training, BCDR posture, compliance/risk reporting support, semi-annual reviews. Starts at {formatUserPrice("business")} ({formatPrice(pricing.business.monthlyMin)}/mo minimum).
                </li>
                <li className="text-sm leading-relaxed text-white/70">
                  <span className="font-semibold text-white">Enterprise</span> — adds unified posture reporting, deeper compliance reporting, custom BCDR architecture support, privileged access program elements, quarterly executive reviews. Starts at {formatUserPrice("enterprise")} ({formatPrice(pricing.enterprise.monthlyMin)}/mo minimum).
                </li>
              </ul>
              <p className="mt-4 text-xs text-white/55">{PRICING_SCOPE_NOTE}</p>
            </div>
            <div>
              <h2 className="font-heading text-2xl font-semibold text-white">How engagement works</h2>
              <ol className="mt-6 space-y-5">
                {lifecycle.map((step, i) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="font-mono text-xs font-semibold tracking-[0.16em] text-[#F04C97]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="font-semibold text-white">{step.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section
            id="ch-fit"
            data-de-chapter="5"
            data-sc-act="flow"
            className="mb-16 grid gap-6 md:grid-cols-2"
          >
            <div
              data-sc-reveal="left"
              data-sc-reveal-at="0.05 0.42"
              className="rounded-2xl border border-de-hairline bg-de-raised p-6"
            >
              <div className="flex items-center gap-3">
                <IconWell icon={ClipboardCheck} size="sm" surface="dark" />
                <h2 className="text-lg font-semibold text-white">Standalone vs ProActive</h2>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/65">
                Standalone services solve a specific gap — backup, UCaaS, awareness, a project —
                when a full operating relationship is not the right fit yet. ProActive is the
                ongoing model: one accountable partner for day-to-day IT and cybersecurity.
              </p>
              <Link href="/solutions/standalone-services">
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#F04C97]">
                  View standalone services
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
            <div
              data-sc-reveal="right"
              data-sc-reveal-at="0.12 0.5"
              className="rounded-2xl border border-de-hairline bg-de-raised p-6"
            >
              <div className="flex items-center gap-3">
                <IconWell icon={Users} size="sm" surface="dark" />
                <h2 className="text-lg font-semibold text-white">Co-managed vs ProActive</h2>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/65">
                Co-managed extends an internal IT team with DE operations, security coverage, and
                escalation — you keep the team. Fully managed ProActive is for organizations that
                want DE to own the operating model end to end.
              </p>
              <Link href="/solutions/co-managed-it">
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#F04C97]">
                  See co-managed IT
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
          </section>

          <section
            id="ch-compare"
            data-de-chapter="6"
            data-sc-act="flow"
            data-sc-in
            className="rounded-2xl border border-de-hairline bg-de-raised p-6 md:flex md:items-center md:justify-between md:gap-8 md:p-8"
          >
            <div className="max-w-xl">
              <h2 className="text-xl font-semibold text-white">Compare capabilities and operating depth</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                The comparison matrix shows what is included at each tier — not which package is
                “highest” or “best.” Final scope is confirmed after a Cyber Risk Assessment.
              </p>
            </div>
            <Link href="/proactive-ecosystem-pricing">
              <span className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#D3126A] px-6 text-base font-semibold text-white hover:bg-[#e01874] md:mt-0">
                Compare all packages
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </section>
      </div>
      </ScrollStory>
    </PageTemplate>
  );
}

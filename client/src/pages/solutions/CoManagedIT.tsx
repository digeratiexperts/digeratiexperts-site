import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  Handshake,
  Layers3,
  Network,
  PackageCheck,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen bg-de-bg text-white">
      <MegaMenu />
      <main className="de-nav-clear pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mx-auto max-w-4xl py-12 text-center md:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-de-accent-ink">Co-Managed Solutions</p>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-[-0.035em] md:text-6xl">
              Keep your IT team. <span className="text-de-accent-ink">Add DE where it helps.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-white/70 md:text-xl">
              Co-Managed is a shared operating relationship for selected solutions. Your team stays in the picture; DE adds package design, implementation capacity, specialist support, monitoring, or escalation where the agreed responsibility model calls for it.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild variant="brand" size="lg" className="h-12">
                <Link href="/store">
                  Build a co-managed solution <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 border-white/15 text-white hover:bg-white/5">
                <Link href="/solutions/standalone-services">Compare Standalone</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-white/55">Preferred pricing is a commercial position, not a promise of a fixed percentage discount on every product or service.</p>
          </header>

          <section className="border-y border-white/10 py-12" aria-labelledby="co-managed-means">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-de-accent-ink">One definition everywhere</p>
              <h2 id="co-managed-means" className="mt-2 text-3xl font-semibold tracking-tight">What Co-Managed means at DE</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {principles.map(({ icon: Icon, title, body }) => (
                <article key={title} className="rounded-2xl border border-white/10 bg-de-raised p-6">
                  <Icon className="h-6 w-6 text-de-accent-ink" aria-hidden="true" />
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/60">{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="py-14" aria-labelledby="responsibility-model">
            <div className="grid gap-10 lg:grid-cols-[21rem_minmax(0,1fr)]">
              <div>
                <Users className="h-7 w-7 text-de-accent-ink" aria-hidden="true" />
                <h2 id="responsibility-model" className="mt-4 text-3xl font-semibold tracking-tight">The responsibility matrix is part of the solution</h2>
                <p className="mt-4 text-sm leading-relaxed text-white/55">
                  Co-Managed should remove ambiguity, not add it. The package and scope identify which activities belong to DE, which stay with your team, and which require both sides.
                </p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-de-raised">
                {responsibilityExamples.map(([capability, owner, explanation], index) => (
                  <div key={capability} className={`grid gap-2 px-5 py-4 md:grid-cols-[12rem_7rem_minmax(0,1fr)] md:items-start ${index ? "border-t border-white/10" : ""}`}>
                    <span className="font-medium text-white/80">{capability}</span>
                    <span className="text-sm font-semibold text-de-accent-ink">{owner}</span>
                    <span className="text-sm leading-relaxed text-white/50">{explanation}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-de-raised p-6 md:p-8" aria-labelledby="same-engine">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <div>
                <Layers3 className="h-6 w-6 text-de-accent-ink" aria-hidden="true" />
                <h2 id="same-engine" className="mt-4 text-2xl font-semibold">No separate “kits” store or parallel package system</h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-white/60">
                  Hardware, identity, backup, network, security, communications, and other needs all flow through the same Business Solution Builder. Your business profile sizes the package once; Co-Managed changes the responsibility and pricing relationship rather than creating a competing catalog.
                </p>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    "One business profile across every package",
                    "Customer-readable included line items",
                    "Shipping and provisioning behavior per package",
                    "Self-install, remote, and on-site choices where supported",
                    "Remote-support preference captured before contact",
                    "Only company, name, email, and phone at the end",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-white/65">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <aside className="rounded-xl border border-de-accent/25 bg-de-accent/5 p-5">
                <Network className="h-6 w-6 text-de-accent-ink" aria-hidden="true" />
                <h3 className="mt-4 font-semibold">Good Co-Managed fit</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  You have an internal technology owner, IT staff, or an existing provider you intend to keep—and you want DE to own or strengthen specific agreed capabilities with clear handoffs.
                </p>
              </aside>
            </div>
          </section>

          <section className="py-14" aria-labelledby="relationship-choice">
            <h2 id="relationship-choice" className="text-3xl font-semibold tracking-tight">Three relationships. One clear boundary between them.</h2>
            <div className="mt-7 overflow-x-auto rounded-2xl border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink" tabIndex={0} role="region" aria-label="Co-managed IT responsibility table">
              <table className="w-full min-w-[760px] border-collapse bg-de-raised text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="px-4 py-3 font-medium">Dimension</th>
                    <th className="px-4 py-3 font-medium text-white">Standalone</th>
                    <th className="px-4 py-3 font-medium text-white">Co-Managed</th>
                    <th className="px-4 py-3 font-medium text-white">ProActive Managed IT</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map(([dimension, standalone, coManaged, proactive]) => (
                    <tr key={dimension} className="border-b border-white/8 align-top last:border-0">
                      <th className="px-4 py-4 font-medium text-white/70">{dimension}</th>
                      <td className="px-4 py-4 leading-relaxed text-white/55">{standalone}</td>
                      <td className="px-4 py-4 leading-relaxed text-white/55">{coManaged}</td>
                      <td className="px-4 py-4 leading-relaxed text-white/55">{proactive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mx-auto max-w-3xl py-10 text-center">
            <Handshake className="mx-auto h-7 w-7 text-de-accent-ink" aria-hidden="true" />
            <h2 className="mt-4 text-3xl font-semibold">Build the need first. Define the shared model second.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/60">
              Start with users, devices, and sites, select the business pain, and let the Store generate the package. Then choose Co-Managed so the same solution is scoped around shared responsibilities and the appropriate commercial position.
            </p>
            <Button asChild variant="brand" size="lg" className="mt-7 h-12">
              <Link href="/store">
                Open the Solution Builder <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </section>
        </div>
      </main>
      <DigeratiEnhancedFooterSection />
    </div>
  );
}

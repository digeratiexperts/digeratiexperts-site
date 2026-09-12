import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  Layers3,
  PackageCheck,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Wrench,
} from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen bg-de-bg text-white">
      <MegaMenu />
      <main className="de-nav-clear pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mx-auto max-w-4xl py-12 text-center md:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-de-accent-ink">Standalone Solutions</p>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-[-0.035em] md:text-6xl" data-testid="heading-standalone-hero">
              Buy the solution. <span className="text-de-accent-ink">Keep control of your IT.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-white/70 md:text-xl">
              Standalone means you can buy a DE-designed package for a specific business need without turning your whole environment over to a new managed-services provider.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild variant="brand" size="lg" className="h-12">
                <Link href="/store">
                  Build a standalone solution <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 border-white/15 text-white hover:bg-white/5">
                <Link href="/solutions/co-managed-it">Compare Co-Managed</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-white/55">No payment is taken in the public builder. DE confirms package fit, scope, fulfillment, and pricing before commitment.</p>
          </header>

          <section className="border-y border-white/10 py-12" aria-labelledby="standalone-means">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-de-accent-ink">One definition everywhere</p>
              <h2 id="standalone-means" className="mt-2 text-3xl font-semibold tracking-tight">What Standalone means at DE</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {standalonePrinciples.map(({ icon: Icon, title, body }) => (
                <article key={title} className="rounded-2xl border border-white/10 bg-de-raised p-6">
                  <Icon className="h-6 w-6 text-de-accent-ink" aria-hidden="true" />
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/60">{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="py-14" aria-labelledby="standalone-flow">
            <div className="grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-de-accent-ink">Same Store engine</p>
                <h2 id="standalone-flow" className="mt-2 text-3xl font-semibold tracking-tight">One buying flow, not another mini-store</h2>
                <p className="mt-4 text-sm leading-relaxed text-white/55">
                  This page explains the relationship. The actual package, quantities, fulfillment, and submission all come from the same Business Solution Builder used across Door 2.
                </p>
              </div>
              <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {flow.map(([number, title, body]) => (
                  <li key={number} className="rounded-xl border border-white/10 bg-de-raised p-5">
                    <p className="font-mono text-xs text-de-accent-ink">{number}</p>
                    <h3 className="mt-3 font-semibold">{title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-white/50">{body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-de-raised p-6 md:p-8" aria-labelledby="relationship-compare">
            <div className="flex items-center gap-3">
              <Layers3 className="h-6 w-6 text-de-accent-ink" aria-hidden="true" />
              <h2 id="relationship-compare" className="text-2xl font-semibold">Choose the relationship, not a duplicate catalog</h2>
            </div>
            <div className="mt-7 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink" tabIndex={0} role="region" aria-label="Standalone services table">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="px-3 py-3 font-medium">Dimension</th>
                    <th className="px-3 py-3 font-medium text-white">Standalone</th>
                    <th className="px-3 py-3 font-medium text-white">Co-Managed</th>
                    <th className="px-3 py-3 font-medium text-white">ProActive Managed IT</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map(([dimension, standalone, coManaged, proactive]) => (
                    <tr key={dimension} className="border-b border-white/8 align-top last:border-0">
                      <th className="px-3 py-4 font-medium text-white/70">{dimension}</th>
                      <td className="px-3 py-4 leading-relaxed text-white/60">{standalone}</td>
                      <td className="px-3 py-4 leading-relaxed text-white/60">{coManaged}</td>
                      <td className="px-3 py-4 leading-relaxed text-white/60">{proactive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mx-auto max-w-3xl py-16 text-center">
            <Truck className="mx-auto h-7 w-7 text-de-accent-ink" aria-hidden="true" />
            <h2 className="mt-4 text-3xl font-semibold">Start with your profile, then pick the need</h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/60">
              The Store will show what is included, how quantities are sized, whether anything ships, and whether self-install, remote setup, or a technician makes sense for that package.
            </p>
            <Button asChild variant="brand" size="lg" className="mt-7 h-12">
              <Link href="/store">
                Open the Solution Builder <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-5 inline-flex items-start gap-2 text-left text-sm text-white/55">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
              If a package genuinely requires an assessment, the builder will say so. DE does not force the same assessment step onto every standalone purchase.
            </p>
          </section>
        </div>
      </main>
      <DigeratiEnhancedFooterSection />
    </div>
  );
}

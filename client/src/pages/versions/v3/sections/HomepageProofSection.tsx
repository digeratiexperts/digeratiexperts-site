// FROZEN — homepage version 3, snapshot of client/src/pages/sections/HomepageProofSection.tsx from the working tree on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { Link } from "wouter";
import { ArrowRight, ShieldCheck, FileText, Scale, Star, type LucideIcon } from "lucide-react";
import { IconWell } from "@/components/visual/IconWell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Trust surfaces — Bill of Rights, reviews, Trust Center, case studies.
 * Keep copy client-facing; never invent logos, ratings, or case-study results.
 */
type ProofSurface = {
  id: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  icon: LucideIcon;
  testId: string;
  hash?: boolean;
};

const surfaces: ProofSurface[] = [
  {
    id: "reviews",
    title: "Client reviews",
    body: "Real client feedback from Google and other approved sources — shown only when we have live API data or verbatim published reviews.",
    cta: "See reviews",
    href: "/#google-reviews",
    icon: Star,
    testId: "link-proof-google-reviews",
    hash: true,
  },
  {
    id: "rights",
    title: "Client Bill of Rights",
    body: "Your credentials, tenants, and licenses stay yours — with access transparency and a clear path if you ever need to transition.",
    cta: "Read the Bill of Rights",
    href: "/about/client-bill-of-rights",
    icon: Scale,
    testId: "link-proof-section-rights",
  },
  {
    id: "trust-center",
    title: "Trust Center",
    body: "Security documentation and operating expectations in one place for diligence and cyber-insurance conversations.",
    cta: "Open Trust Center",
    href: "/trust/trust-center",
    icon: ShieldCheck,
    testId: "link-proof-section-trust",
  },
  {
    id: "case-studies",
    title: "Case studies",
    body: "Real engagements with challenge, approach, and outcome — published with client permission.",
    cta: "View case studies",
    href: "/resources/case-studies",
    icon: FileText,
    testId: "link-proof-section-cases",
  },
];

function ProofCta({
  surface,
  className,
  testId,
  quiet = false,
}: {
  surface: ProofSurface;
  className?: string;
  testId?: string;
  quiet?: boolean;
}) {
  const classes = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 text-base font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]",
    quiet
      ? "text-white/50 hover:text-white"
      : "text-de-magenta-ink hover:text-[#f0187a]",
    className,
  );

  const label = (
    <>
      {surface.cta}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </>
  );

  if (surface.hash) {
    return (
      <a href={surface.href} className={classes} data-testid={testId}>
        {label}
      </a>
    );
  }

  return (
    <Link href={surface.href} data-testid={testId}>
      <span className={classes}>{label}</span>
    </Link>
  );
}

export function HomepageProofSection() {
  return (
    <section id="proof" className="de-dark-well de-chapter-hairline de-field-grain py-14 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-base font-semibold uppercase tracking-[0.2em] text-de-magenta-ink">
            Trust & transparency
          </p>
          <h2 className="font-heading text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl lg:text-5xl">
            Built for accountability you can verify
            <span className="text-[#D3126A]" aria-hidden="true">
              :
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/55 md:text-lg">
            Ownership clarity, documented operations, and public surfaces you can open before you
            engage — not marketing claims you have to take on faith.
          </p>
        </div>

        <Tabs defaultValue={surfaces[0].id} className="mt-10 md:mt-12">
          <TabsList
            aria-label="Trust and transparency surfaces"
            className="grid h-auto w-full max-w-full grid-cols-2 items-stretch gap-2.5 bg-transparent p-0 lg:flex lg:flex-wrap lg:justify-center lg:gap-3"
          >
            {surfaces.map((surface) => {
              const Icon = surface.icon;
              return (
                <TabsTrigger
                  key={surface.id}
                  value={surface.id}
                  className={cn(
                    "group h-full min-h-11 w-full justify-start rounded-xl border bg-transparent px-3.5 py-2.5 text-left text-base font-medium text-white shadow-none lg:w-auto",
                    "whitespace-normal hover:bg-white/[0.03] hover:text-white",
                    "focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]",
                    "data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-white",
                    "border-[var(--de-hairline)] data-[state=active]:border-[#D3126A] data-[state=active]:shadow-[inset_0_0_0_1px_#D3126A]",
                  )}
                >
                  <span
                    className={cn(
                      "mr-2.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                      "border-white/20 bg-transparent text-white",
                      "group-data-[state=active]:border-[#D3126A] group-data-[state=active]:bg-[#D3126A] group-data-[state=active]:text-white",
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {surface.title}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {surfaces.map((surface) => (
            <TabsContent
              key={surface.id}
              value={surface.id}
              className="mt-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)] md:mt-10"
            >
              <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                <IconWell icon={surface.icon} size="md" surface="dark" className="mb-5" />
                <h3 className="font-heading text-xl font-semibold text-white md:text-2xl">
                  {surface.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-white/55 md:text-lg">
                  {surface.body}
                </p>
                <ProofCta surface={surface} className="mt-6 self-center" />
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <nav
          aria-label="Open a trust surface"
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-[var(--de-hairline)] pt-8 md:mt-12"
        >
          {surfaces.map((surface) => (
            <ProofCta key={surface.id} surface={surface} testId={surface.testId} quiet />
          ))}
        </nav>
      </div>
    </section>
  );
}

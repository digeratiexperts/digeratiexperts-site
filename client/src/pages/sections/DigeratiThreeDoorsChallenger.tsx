import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ClipboardCheck, ShieldCheck, Store, Target, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { IconWell } from "@/components/visual/IconWell";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";

const doors: Array<{
  icon: LucideIcon;
  title: string;
  eyebrow: string;
  description: string;
  detail: string;
  href: string;
  cta: string;
  testId: string;
}> = [
  {
    icon: ShieldCheck,
    title: "Handle Our IT",
    eyebrow: "Ongoing relationship",
    description:
      "Put DE in the operating loop through the ProActive Ecosystem or a co-managed relationship with your internal IT team.",
    detail: "Assessment defines the baseline and DE-owned scope. Preferred ecosystem pricing applies inside ProActive.",
    href: "/solutions/proactive-ecosystem",
    cta: "Explore ongoing IT",
    testId: "challenger-door-handle-it",
  },
  {
    icon: Target,
    title: "Solve a Business Need",
    eyebrow: "Defined outcome",
    description:
      "Start with the problem you need solved — security, cloud, identity, communications, automation, recovery, or another defined need.",
    detail: "Assessment is the preferred starting point and becomes required whenever the solution needs technical discovery.",
    href: "/solutions/business-needs",
    cta: "Choose the business need",
    testId: "challenger-door-business-need",
  },
  {
    icon: Store,
    title: "Client Marketplace",
    eyebrow: "Existing clients",
    description:
      "Buy approved services and solutions against the environment and relationship DE already knows instead of starting from zero.",
    detail: "Availability depends on the client's established baseline, service relationship, and technical eligibility.",
    href: "/portal/marketplace",
    cta: "Open Client Marketplace",
    testId: "challenger-door-marketplace",
  },
];

export function DigeratiThreeDoorsChallenger(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="services"
      className="de-dark-chapter de-chapter-hairline de-field-grain relative overflow-hidden py-12 md:py-16 lg:py-20"
      data-testid="challenger-three-doors"
    >
      <div className="container relative z-10 mx-auto px-3 sm:px-4 lg:px-6">
        <motion.div
          className="max-w-3xl"
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <p className="mb-3 text-base font-semibold uppercase tracking-[0.2em] text-de-magenta-ink">
            How to work with us
          </p>
          <h2 className="font-heading text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl lg:text-5xl">
            Three doors. <span className="de-hero-accent">One operating standard.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65 md:text-lg">
            Choose the relationship that matches what you need. Assessment sits across the model so the recommendation is based on the environment, not a guess.
          </p>
        </motion.div>

        <motion.div
          className="mt-8 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-5 md:p-6"
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
          data-testid="challenger-assessment-control"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D3126A]/45 bg-[#D3126A]/10">
            <ClipboardCheck className="h-5 w-5 text-de-magenta-ink" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-de-magenta-ink">Assessment controls the entry</p>
            <p className="mt-1 text-base leading-relaxed text-white/70">
              The depth, price, and requirement change by pathway; the principle does not: understand the environment before prescribing the answer.
            </p>
          </div>
          <Link
            href="/book"
            className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-base font-semibold text-white hover:text-de-magenta-ink"
            data-testid="challenger-assessment-link"
          >
            Start assessment
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </motion.div>

        <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
          {doors.map((door, index) => {
            const Icon = door.icon;
            return (
              <motion.div
                key={door.title}
                className="h-full"
                initial={prefersReducedMotion ? false : revealInitial}
                whileInView={revealInView}
                viewport={revealViewport}
                transition={{ ...revealTransition, delay: index * 0.045 }}
              >
                <Link
                  href={door.href}
                  data-testid={door.testId}
                  className="de-interactive-tile group flex h-full flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-[#17131c] to-[#0e0c13] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D3126A]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)] lg:p-7"
                >
                  <IconWell icon={Icon} size="md" surface="dark" className="mb-5" />
                  <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-de-magenta-ink">
                    {door.eyebrow}
                  </p>
                  <h3 className="text-2xl font-semibold tracking-[-0.02em] text-white">{door.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-white/70">{door.description}</p>
                  <p className="mt-4 flex-1 border-t border-white/10 pt-4 text-sm leading-relaxed text-white/50">
                    {door.detail}
                  </p>
                  <span className="mt-6 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-de-magenta-ink group-hover:text-[#f0187a]">
                    {door.cta}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-white/45 md:text-base">
          Standalone work does not silently include full managed IT, SOC, backup, network, compliance, or help-desk coverage. Scope stays explicit.
        </p>
      </div>
    </section>
  );
}

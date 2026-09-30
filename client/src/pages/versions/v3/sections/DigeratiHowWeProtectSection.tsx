// FROZEN — homepage version 3, snapshot of client/src/pages/sections/DigeratiHowWeProtectSection.tsx from the working tree on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Diagram } from "@/diagrams/Diagram";
import { Search, FileText, Settings, Activity, KeyRound, Monitor, Mail, Wifi, Database, Radio, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { IconWell } from "@/components/visual/IconWell";
import type { LucideIcon } from "lucide-react";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { ProtectionCommandDeck, protectionDomains } from "@/components/visual/ProtectionCommandDeck";

/** The deck's six domains as the six layers of the protection diagram, in deck order. */
const deckLayers = [
  { code: "01", label: "Identity", answers: "credential theft" },
  { code: "02", label: "Endpoint", answers: "malware" },
  { code: "03", label: "Email", answers: "phishing" },
  { code: "04", label: "Network", answers: "lateral movement" },
  { code: "05", label: "Recovery", answers: "ransomware encryption" },
  { code: "06", label: "Compliance", answers: "audit & insurance requirements" },
];

const steps: {
  number: number;
  title: string;
  description: string;
  icon: LucideIcon;
  testId: string;
  href: string;
}[] = [
  {
    number: 1,
    title: "Assessment",
    description: "Review identity, endpoints, email, backups, network, and operating reality.",
    icon: Search,
    testId: "step-discovery",
    href: "/book",
  },
  {
    number: 2,
    title: "Roadmap",
    description: "Match the operating model to the environment — fit, not a ranking ladder.",
    icon: FileText,
    testId: "step-planning",
    href: "/solutions/proactive-ecosystem",
  },
  {
    number: 3,
    title: "Implementation",
    description: "Documented credentials you own. Controls sized to the model we matched.",
    icon: Settings,
    testId: "step-implementation",
    href: "/solutions/proactive-ecosystem",
  },
  {
    number: 4,
    title: "Continuous",
    description: "Day-to-day support and the DE Security Foundation are included at every tier; detection, response, recovery, and governance deepen with the plan.",
    icon: Activity,
    testId: "step-protection",
    href: "/solutions/proactive-ecosystem",
  },
];

export const DigeratiHowWeProtectSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const [domainIndex, setDomainIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState<number | null>(null);

  return (
    <>
      <section className="de-dark-well relative py-8 md:py-14">
        <div className="mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
          <div className="de-paper-island relative px-6 py-10 sm:px-10 sm:py-14 md:px-12 md:py-16">
            <div className="relative z-10">
              <div className="mb-8 grid grid-cols-1 gap-8 md:mb-12 lg:grid-cols-12 lg:items-center lg:gap-10">
                <motion.div
                  className="max-w-2xl lg:col-span-5"
                  initial={prefersReducedMotion ? false : revealInitial}
                  whileInView={revealInView}
                  viewport={revealViewport}
                  transition={revealTransition}
                >
                  <p className="mb-3 text-base font-semibold uppercase tracking-[0.2em] text-[#A30E52]">
                    What we protect
                  </p>
                  <h2 className="mb-4 font-heading text-3xl font-semibold tracking-[-0.02em] text-[#1A1228] md:text-4xl">
                    Six domains. One accountable operating model.
                  </h2>
                  <p className="text-lg leading-relaxed text-[#3A3448]">
                    Protection is layered around the business, and each layer answers a specific
                    class of threat. Select a domain below to see how we operate it.
                  </p>
                </motion.div>
                <div className="lg:col-span-7">
                  <Diagram
                    id="protection"
                    tone="paper"
                    state={1}
                    focus={`layer-${domainIndex + 1}`}
                    data={{ layers: deckLayers }}
                    className="rounded-2xl border border-[var(--de-paper-hairline)] bg-white p-4 md:p-6"
                  />
                </div>
              </div>

              {/* Interactive Six Domains Protection Command Deck */}
              <div id="protection-stack">
                <ProtectionCommandDeck
                  onDomainChange={(id) => setDomainIndex(Math.max(0, protectionDomains.findIndex((d) => d.id === id)))}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-protection-works"
        className="de-process-band relative overflow-hidden py-14 md:py-16 lg:py-20"
        aria-labelledby="how-protection-works-heading"
      >
        <div className="container relative z-10 mx-auto px-3 sm:px-4 lg:px-6">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4 md:mb-12">
            <div className="max-w-5xl">
              <p className="mb-2 text-base font-semibold uppercase tracking-[0.2em] text-de-magenta-ink">
                How protection works
              </p>
              <h3
                id="how-protection-works-heading"
                className="font-heading text-2xl font-semibold tracking-[-0.02em] text-white md:text-3xl"
              >
                Assessment → Roadmap → Implementation → Continuous
              </h3>
            </div>
            <Link href="/solutions/proactive-ecosystem">
              <span className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-white underline-offset-4 hover:text-[#D3126A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]">
                Full methodology
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="lg:col-span-6">
              <Diagram
                id="lifecycle"
                tone="dark"
                state={stepIndex === null ? 1 : (stepIndex + 0.5) / 5}
                className="rounded-2xl border border-[var(--de-hairline)] bg-[var(--de-surface)] p-5 md:p-6"
              />
            </div>
            <ol className="divide-y divide-[var(--de-hairline)] border-y border-[var(--de-hairline)] lg:col-span-6">
              {steps.map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <li key={step.number}>
                    <Link
                      href={step.href}
                      data-testid={step.testId}
                      className="group flex items-start gap-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)] md:py-5"
                      onMouseEnter={() => setStepIndex(index)}
                      onMouseLeave={() => setStepIndex(null)}
                      onFocus={() => setStepIndex(index)}
                      onBlur={() => setStepIndex(null)}
                    >
                      <span className="pt-1 font-mono text-sm font-bold tracking-[0.18em] text-[#D3126A]" aria-hidden="true">
                        {String(step.number).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-lg font-semibold text-white">
                          <IconComponent className="h-4 w-4 shrink-0 text-white/60 group-hover:text-[#D3126A]" aria-hidden="true" />
                          {step.title}
                        </span>
                        <span className="mt-1 block text-base leading-relaxed text-white/70">{step.description}</span>
                      </span>
                      <ArrowRight
                        className="mt-2 h-4 w-4 shrink-0 text-white/35 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#D3126A]"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
};

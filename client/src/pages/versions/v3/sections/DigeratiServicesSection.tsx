// FROZEN — homepage version 3, snapshot of client/src/pages/sections/DigeratiServicesSection.tsx from the working tree on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Diagram } from "@/diagrams/Diagram";
import { Link } from "wouter";
import {
  Shield,
  Users,
  ClipboardCheck,
  ArrowRight,
  Layers,
  Eye,
  ShieldCheck,
  UserCheck,
  KeyRound,
  Cloud,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { CTA } from "@/lib/ctaCopy";
import { IconWell } from "@/components/visual/IconWell";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";

/**
 * Homepage engagement paths — three primary choices.
 * Capability cards also previewed here (same stack as Protect) so nothing feels deleted.
 * Lucide IconWell (A+C), not engage-path sculptures — DE: 3D reads as tech-made, not business-first.
 */
const paths: {
  icon: LucideIcon;
  title: string;
  description: string;
  link: string;
  cta: string;
  testId: string;
  eyebrow?: string;
}[] = [
  {
    icon: Shield,
    title: "Fully Managed IT & Cybersecurity",
    eyebrow: "ProActive Ecosystem",
    description:
      "One accountable team for support, identity, endpoints, email, backup, and security operations — delivered through our ProActive Ecosystem.",
    link: "/solutions/proactive-ecosystem",
    cta: "Explore managed services",
    testId: "engage-fully-managed",
  },
  {
    icon: Users,
    title: "Co-Managed IT",
    description:
      "Augment your internal IT with DE security operations, monitoring, and specialized coverage without replacing your team.",
    link: "/solutions/co-managed-it",
    cta: "See co-managed",
    testId: "engage-co-managed",
  },
  {
    icon: ClipboardCheck,
    title: "Cyber Risk Assessment",
    description:
      "Start with a practical review of identity, endpoints, email, backups, and security posture — then choose what to own together.",
    link: "/book",
    cta: CTA.primary,
    testId: "engage-assessment",
  },
];

const capabilityPreview: {
  icon: LucideIcon;
  title: string;
  link: string;
  desc: string;
}[] = [
  {
    icon: Eye,
    title: "SOC / MDR Monitoring",
    link: "/solutions/security-operations",
    desc: "24/7 detection and response.",
  },
  {
    icon: ShieldCheck,
    title: "Endpoint Security (EDR)",
    link: "/solutions/threat-detection",
    desc: "Protect devices across the environment.",
  },
  {
    icon: UserCheck,
    title: "SMART Identity (MFA + SSO)",
    link: "/solutions/unified-security",
    desc: "Stronger access without user chaos.",
  },
  {
    icon: KeyRound,
    title: "Privileged Access Controls",
    link: "/solutions/unified-security",
    desc: "Admin controls and audit visibility.",
  },
  {
    icon: Cloud,
    title: "Backup & Disaster Recovery",
    link: "/solutions/backup-disaster-recovery",
    desc: "Recovery planning and restore discipline.",
  },
  {
    icon: AlertCircle,
    title: "Email Protection",
    link: "/solutions/security-operations",
    desc: "Anti-phishing and mailbox defenses.",
  },
];

/** Which node of the environment diagram each capability lives on. */
const capabilityNode: Record<string, string> = {
  "SOC / MDR Monitoring": "operations",
  "Endpoint Security (EDR)": "devices",
  "SMART Identity (MFA + SSO)": "identity",
  "Privileged Access Controls": "identity",
  "Backup & Disaster Recovery": "backup",
  "Email Protection": "email",
};

export const DigeratiServicesSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const [focusNode, setFocusNode] = useState<string | null>(null);

  return (
    <section
      id="services"
      className="de-dark-chapter de-chapter-hairline de-field-grain relative overflow-hidden py-10 md:py-18 lg:py-22"
    >
      <div className="container relative z-10 mx-auto px-3 sm:px-4 lg:px-6">
        <motion.div
          className="mb-10 max-w-2xl md:mb-14"
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <p className="mb-3 text-base font-semibold uppercase tracking-[0.2em] text-de-magenta-ink">
            How to work with us
          </p>
          <h2 className="mb-4 font-heading text-3xl font-semibold tracking-[-0.02em] text-white md:text-4xl">
            Cybersecurity-First <span className="de-hero-accent">Managed IT</span>
          </h2>
          <p className="max-w-2xl text-base font-medium leading-relaxed text-white/80 md:text-lg md:font-normal md:text-white/65">
            Three clear paths. Capability depth stays available here and under Protect — nothing
            removed.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
          {paths.map((path, index) => {
            const Icon = path.icon;
            const isFeatured = index === 0;
            return (
              <motion.div
                key={path.title}
                initial={prefersReducedMotion ? false : revealInitial}
                whileInView={revealInView}
                viewport={revealViewport}
                transition={{ ...revealTransition, delay: index * 0.045 }}
                className="h-full"
              >
                <Link
                  href={path.link}
                  data-testid={path.testId}
                  className={`de-interactive-tile group flex h-full flex-col rounded-2xl border p-6 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)] lg:p-8 ${
                    isFeatured
                      ? "border-[#D3126A]/60 bg-gradient-to-b from-[#1e1526] via-[#14101b] to-[#0e0c13] shadow-lg shadow-[#D3126A]/15 hover:-translate-y-0.5 hover:border-[#D3126A]"
                      : "border-white/10 bg-gradient-to-b from-[#16131b] to-[#0f0d14] hover:-translate-y-0.5 hover:border-[#D3126A]/60 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <IconWell icon={Icon} size="md" surface="dark" className="mb-5" />
                    {isFeatured && (
                      <span className="rounded-full bg-[#D3126A] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Full Operations
                      </span>
                    )}
                  </div>
                  <p
                    className={`mb-2 min-h-4 text-base font-semibold uppercase tracking-[0.2em] ${
                      path.eyebrow ? "text-de-magenta-ink" : "invisible"
                    }`}
                    aria-hidden={!path.eyebrow}
                  >
                    {path.eyebrow ?? "\u00a0"}
                  </p>
                  <h3 className="mb-2 text-xl font-semibold text-white lg:text-2xl">{path.title}</h3>
                  <p className="mb-5 flex-1 text-base font-medium leading-relaxed text-white/80 md:font-normal md:text-white/65">
                    {path.description}
                  </p>
                  <span
                    data-testid={`link-${path.testId}`}
                    className="inline-flex min-h-11 items-center gap-2 text-base font-medium text-de-magenta-ink group-hover:text-[#f0187a]"
                  >
                    {path.cta}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-6 text-base font-medium leading-relaxed text-white/80 md:text-lg md:font-normal md:text-white/55">
          Need one specific service?{" "}
          <Link href="/solutions/standalone-services">
            <span className="font-semibold text-white underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white/50">
              View Standalone Services
            </span>
          </Link>
        </p>

        <div className="mt-16 md:mt-20" data-testid="engage-capability-preview">
          <div className="mx-auto max-w-4xl text-center">
            <h3 className="font-heading text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl lg:text-5xl">
              ProActive Ecosystem
              <span className="text-[#D3126A]" aria-hidden="true">
                :
              </span>
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-base text-white/55 md:text-lg">
              One environment, six capabilities we operate inside it. Each capability below is
              mapped to where it lives.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:mt-10 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <Diagram
                id="environment"
                tone="dark"
                focus={focusNode}
                className="rounded-2xl border border-[var(--de-hairline)] bg-[var(--de-surface)] p-5 md:p-6"
              />
            </div>
            <ul
              className="divide-y divide-[var(--de-hairline)] border-y border-[var(--de-hairline)] lg:col-span-5"
              aria-label="Security capabilities"
            >
              {capabilityPreview.map((item, index) => {
                const Icon = item.icon;
                const node = capabilityNode[item.title] ?? null;
                return (
                  <li key={item.title}>
                    <Link href={item.link}>
                      <span
                        className="group flex items-start gap-4 py-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)] md:py-5"
                        onMouseEnter={() => setFocusNode(node)}
                        onMouseLeave={() => setFocusNode(null)}
                        onFocus={() => setFocusNode(node)}
                        onBlur={() => setFocusNode(null)}
                        data-testid={`capability-row-${index}`}
                      >
                        <span className="pt-1 font-mono text-xs font-bold tracking-[0.18em] text-[#D3126A]" aria-hidden="true">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-base font-semibold text-white md:text-lg">
                            <Icon className="h-4 w-4 shrink-0 text-white/60 group-hover:text-[#D3126A]" aria-hidden="true" />
                            {item.title}
                          </span>
                          <span className="mt-1 block text-sm leading-relaxed text-white/60 md:text-base">{item.desc}</span>
                        </span>
                        <ArrowRight
                          className="mt-1.5 h-4 w-4 shrink-0 text-white/35 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#D3126A]"
                          aria-hidden="true"
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-8 flex justify-center md:mt-10">
            <Link href="/#protection" data-testid="link-see-security-stack">
              <span className="inline-flex min-h-11 items-center gap-2 text-base text-white/65 hover:text-white">
                <Layers className="h-4 w-4 text-[#D3126A]" aria-hidden="true" />
                See full Protect process
              </span>
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4 text-base md:mt-12 md:text-lg">
          <Link href="/solutions/proactive-ecosystem" data-testid="link-proactive-ecosystem">
            <span className="inline-flex items-center gap-2 text-white/75 transition-colors hover:text-white">
              How the ProActive Ecosystem works
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
};

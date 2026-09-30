// FROZEN — homepage version 1, snapshot of client/src/pages/sections/DigeratiServicesSection.tsx from git ref origin/main on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { motion, useReducedMotion } from "framer-motion";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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

export const DigeratiServicesSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();

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
              Preview of the stack we manage — also detailed under Protect.
            </p>
          </div>

          <Tabs defaultValue={capabilityPreview[0].title} className="mt-8 md:mt-10">
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[var(--de-surface)] to-transparent md:hidden"
                aria-hidden="true"
              />
              <TabsList
                aria-label="Security capabilities"
                className="h-auto w-full max-w-full justify-start gap-2.5 overflow-x-auto bg-transparent p-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:justify-center md:gap-3"
              >
                {capabilityPreview.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TabsTrigger
                      key={item.title}
                      value={item.title}
                      className={cn(
                        "group h-auto min-h-11 shrink-0 rounded-xl border bg-transparent px-3.5 py-2.5 text-base font-medium text-white shadow-none",
                        "hover:bg-white/[0.03] hover:text-white",
                        "focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]",
                        "data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-white",
                        "border-[var(--de-hairline)] data-[state=active]:border-[#D3126A] data-[state=active]:shadow-[inset_0_0_0_1px_#D3126A]",
                      )}
                    >
                      <Icon
                        className="mr-2 h-4 w-4 shrink-0 text-white group-data-[state=active]:text-[#D3126A]"
                        aria-hidden="true"
                      />
                      {item.title}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {capabilityPreview.map((item) => (
              <TabsContent
                key={item.title}
                value={item.title}
                className="mt-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]"
              >
                <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                  <p className="font-heading text-xl font-semibold text-white md:text-2xl">{item.title}</p>
                  <p className="mt-2 text-base leading-relaxed text-white/55 md:text-lg">{item.desc}</p>
                  <Link href={item.link}>
                    <span className="mt-5 inline-flex min-h-11 items-center gap-2 text-base font-medium text-white/80 underline decoration-white/20 underline-offset-4 hover:text-white hover:decoration-white/50">
                      {item.title} details
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </Link>
                </div>
              </TabsContent>
            ))}
          </Tabs>

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

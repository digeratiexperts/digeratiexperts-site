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
import {
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
  cardDarkInteractive,
  ledeClass,
  textLinkClass,
} from "@/components/home/HomeChapter";

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

/**
 * Radix derives the trigger/content element ids from the tab value. A value
 * such as "SOC / MDR Monitoring" produces ids containing spaces and slashes,
 * which makes aria-controls / aria-labelledby point at invalid id tokens
 * (axe: aria-valid-attr-value, critical). Use a slug for the value and keep
 * the human title for display.
 */
export const tabValue = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

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

const tabTriggerClass = cn(
  "group h-auto min-h-11 shrink-0 rounded-lg border bg-transparent px-3.5 py-2.5 text-base font-medium text-white/80 shadow-none",
  "hover:bg-white/[0.03] hover:text-white",
  "focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]",
  "data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-white",
  "border-[var(--de-hairline)] data-[state=active]:border-[#D3126A] data-[state=active]:shadow-[inset_0_0_0_1px_#D3126A]",
);

export const DigeratiServicesSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <HomeChapter tone="well" data-section="services">
      <HomeContainer>
        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <HomeChapterHeader
            tone="well"
            eyebrow="How to work with us"
            title={
              <>
                Cybersecurity-First <span className="de-hero-accent">Managed IT</span>
              </>
            }
            lede="Three clear paths. Capability depth stays available here and under Protect — nothing removed."
            link={{
              label: "View Standalone Services",
              href: "/solutions/standalone-services",
            }}
          />
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
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
                  className={cn(
                    cardDarkInteractive,
                    "flex h-full flex-col p-6",
                    isFeatured && "border-[#D3126A]/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <IconWell icon={Icon} size="md" surface="dark" />
                    {isFeatured && (
                      <span className="rounded-full border border-[#D3126A]/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-de-magenta-ink">
                        Full Operations
                      </span>
                    )}
                  </div>
                  {path.eyebrow && (
                    <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-de-magenta-ink">
                      {path.eyebrow}
                    </p>
                  )}
                  <h3 className={cn("text-xl font-semibold text-white", path.eyebrow ? "mt-1.5" : "mt-5")}>
                    {path.title}
                  </h3>
                  <p className="mt-2 flex-1 text-base leading-relaxed text-white/65">{path.description}</p>
                  <span
                    data-testid={`link-${path.testId}`}
                    className="mt-5 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-de-magenta-ink group-hover:text-[#f0187a]"
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

        {/* ProActive Ecosystem preview — same chapter, hairline seam, sub-heading. */}
        <div className="mt-14 border-t border-[var(--de-hairline)] pt-10" data-testid="engage-capability-preview">
          <div className="grid gap-5 lg:grid-cols-12 lg:items-end lg:gap-10">
            <div className="lg:col-span-7">
              <h3 className="font-heading text-2xl font-semibold tracking-[-0.02em] text-white md:text-3xl">
                ProActive Ecosystem
                <span className="text-[#D3126A]" aria-hidden="true">
                  :
                </span>
              </h3>
            </div>
            <p className={cn(ledeClass("well"), "max-w-xl lg:col-span-5")}>
              Preview of the stack we manage — also detailed under Protect.
            </p>
          </div>

          <Tabs defaultValue={tabValue(capabilityPreview[0].title)} className="mt-7">
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[var(--de-bg)] to-transparent md:hidden"
                aria-hidden="true"
              />
              <TabsList
                aria-label="Security capabilities"
                className="h-auto w-full max-w-full justify-start gap-2.5 overflow-x-auto bg-transparent p-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex-wrap"
              >
                {capabilityPreview.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TabsTrigger key={item.title} value={tabValue(item.title)} className={tabTriggerClass}>
                      <Icon
                        className="mr-2 h-4 w-4 shrink-0 text-white/70 group-data-[state=active]:text-[#D3126A]"
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
                value={tabValue(item.title)}
                className="mt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
              >
                <div className="flex flex-col gap-4 rounded-xl border border-[var(--de-hairline)] bg-[var(--de-raised)] p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <IconWell icon={item.icon} size="sm" surface="dark" />
                    <div>
                      <p className="font-heading text-lg font-semibold text-white md:text-xl">{item.title}</p>
                      <p className="mt-1 text-base leading-relaxed text-white/65">{item.desc}</p>
                    </div>
                  </div>
                  <Link href={item.link} className={cn(textLinkClass("well"), "shrink-0")}>
                    {item.title} details
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2">
            <Link href="/#protection" data-testid="link-see-security-stack" className={textLinkClass("well")}>
              <Layers className="h-4 w-4" aria-hidden="true" />
              See full Protect process
            </Link>
            <Link href="/solutions/proactive-ecosystem" data-testid="link-proactive-ecosystem" className={textLinkClass("well")}>
              How the ProActive Ecosystem works
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </HomeContainer>
    </HomeChapter>
  );
};

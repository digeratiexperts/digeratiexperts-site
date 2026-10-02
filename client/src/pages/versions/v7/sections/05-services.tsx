import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowRight,
  ClipboardCheck,
  Cloud,
  Eye,
  KeyRound,
  MailCheck,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CTA } from "@/lib/ctaCopy";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
// v7.css first so this section's rules follow the base system in the cascade,
// as the section stylesheet follows tokens.css in the mock.
import "../v7.css";
import "./05-services.css";

/**
 * Section 05: Services on the surface field. One head, three paths, one stack
 * rail, one link. Mock: artifacts/design-concepts/homepage-sections-2026-10/
 * sections/05-services.html. Paths and capabilities verbatim from the live
 * DigeratiServicesSection.tsx.
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

const capabilityPreview: { icon: LucideIcon; title: string; link: string; desc: string }[] = [
  { icon: Eye, title: "SOC / MDR Monitoring", link: "/solutions/security-operations", desc: "24/7 detection and response." },
  { icon: ShieldCheck, title: "Endpoint Security (EDR)", link: "/solutions/threat-detection", desc: "Protect devices across the environment." },
  { icon: UserCheck, title: "SMART Identity (MFA + SSO)", link: "/solutions/unified-security", desc: "Stronger access without user chaos." },
  { icon: KeyRound, title: "Privileged Access Controls", link: "/solutions/unified-security", desc: "Admin controls and audit visibility." },
  { icon: Cloud, title: "Backup & Disaster Recovery", link: "/solutions/backup-disaster-recovery", desc: "Recovery planning and restore discipline." },
  { icon: MailCheck, title: "Email Protection", link: "/solutions/security-operations", desc: "Anti-phishing and mailbox defenses." },
];

const iconProps = { size: 20, strokeWidth: 1.8, "aria-hidden": true } as const;
const Arrow = () => <ArrowRight {...iconProps} />;

export function V7Services(): JSX.Element {
  const reduce = useReducedMotion();
  const reveal = {
    initial: reduce ? false : revealInitial,
    whileInView: revealInView,
    viewport: revealViewport,
    transition: revealTransition,
  } as const;

  return (
    <section className="f-surface v7-section v7-grain" data-section="services" aria-labelledby="services-heading">
      <div className="v7-canvas">
        <motion.div className="svc-head" {...reveal}>
          <div className="v7-head">
            <p className="v7-eyebrow">How to work with us</p>
            <h2 className="v7-h2" id="services-heading">
              Cybersecurity-First <span className="v7-accent">Managed IT</span>
            </h2>
            <p className="v7-lede">
              Three clear paths. Capability depth stays available here and under Protect — nothing removed.
            </p>
          </div>
          <p className="svc-aside">
            <span>Need one specific service?</span>{" "}
            <Link className="v7-link" href="/solutions/standalone-services">
              View Standalone Services <Arrow />
            </Link>
          </p>
        </motion.div>

        <motion.ul className="v7-grid v7-grid--3 svc-paths" {...reveal}>
          {paths.map((path, index) => {
            const Icon = path.icon;
            const featured = index === 0;
            return (
              <li key={path.testId}>
                <article className={featured ? "v7-card svc-path svc-path--featured" : "v7-card svc-path"} data-testid={path.testId}>
                  <div className="svc-path__top">
                    <span className="v7-iconwell">
                      <Icon {...iconProps} />
                    </span>
                    {path.eyebrow ? <p className="svc-path__kicker">{path.eyebrow}</p> : null}
                    {featured ? <span className="v7-tag">Full Operations</span> : null}
                  </div>
                  <h3 className="v7-h3">{path.title}</h3>
                  <p className="v7-body">{path.description}</p>
                  <Link className="v7-link" href={path.link} data-testid={`link-${path.testId}`}>
                    {path.cta} <Arrow />
                  </Link>
                </article>
              </li>
            );
          })}
        </motion.ul>

        <motion.div
          className="svc-stack"
          role="region"
          aria-labelledby="services-stack-heading"
          data-testid="engage-capability-preview"
          {...reveal}
        >
          <div className="svc-stack__head">
            <div>
              <h3 className="v7-h2--sub svc-stack__title" id="services-stack-heading">
                ProActive Ecosystem
                <span className="v7-colon" aria-hidden="true">
                  :
                </span>
              </h3>
              <p className="v7-body svc-stack__lede">
                Preview of the stack we manage — also detailed under{" "}
                <Link className="v7-link--quiet" href="/#protection" data-testid="link-see-security-stack">
                  Protect
                </Link>
                .
              </p>
            </div>
            <Link className="v7-link" href="/solutions/proactive-ecosystem" data-testid="link-proactive-ecosystem">
              How the ProActive Ecosystem works <Arrow />
            </Link>
          </div>

          <ul className="v7-cells svc-rail" aria-label="Security capabilities">
            {capabilityPreview.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <span className="v7-iconwell v7-iconwell--sm">
                    <Icon {...iconProps} />
                  </span>
                  <div className="svc-cell">
                    <h4 className="v7-h4">{item.title}</h4>
                    <p className="v7-body">{item.desc}</p>
                    <Link className="v7-link" href={item.link}>
                      <span className="sr-only">{item.title} </span>Details <Arrow />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}

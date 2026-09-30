import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import {
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
  buttonPrimary,
  indexClass,
} from "@/components/home/HomeChapter";

const challenges = [
  {
    title: "Ransomware & Malware",
    description:
      "Advanced threat detection and rapid response to eliminate malicious attacks before damage occurs",
    href: "/solutions/threat-detection",
  },
  {
    title: "Data Loss Prevention",
    description:
      "Comprehensive backup strategies with tested disaster recovery ensuring business continuity",
    href: "/solutions/backup-disaster-recovery",
  },
  {
    title: "Compliance Gaps",
    description:
      "Navigate HIPAA, PCI DSS, and SOC 2 requirements with continuous monitoring and reporting",
    href: "/resources/cyber-facts",
  },
  {
    title: "Phishing & Social Engineering",
    description:
      "Multi-layered email security combined with ongoing employee security awareness training",
    href: "/solutions/security-operations",
  },
  {
    title: "Zero-Day Vulnerabilities",
    description:
      "Proactive patch management and security assessments to close gaps before exploitation",
    href: "/solutions/threat-detection",
  },
  {
    title: "Insider Threats",
    description:
      "User behavior analytics and access controls to prevent internal security breaches",
    href: "/solutions/unified-security",
  },
];

export const DigeratiWhatWeTackleSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <HomeChapter tone="paper">
      <HomeContainer>
        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <HomeChapterHeader
            tone="paper"
            eyebrow="Problems we solve"
            title="What We Tackle"
            lede="Compact view of the problems we own with you. Sourced industry statistics live on Cyber Facts; capability detail lives on Solutions."
            link={{ label: "Full threat context", href: "/resources/cyber-facts" }}
          />
        </motion.div>

        {/* Numbered 2×3 list with hairline seams — archetype "Problems grid". */}
        <motion.div
          className="grid grid-cols-1 border-t border-[var(--de-paper-hairline)] md:grid-cols-3 md:divide-x md:divide-[var(--de-paper-hairline)]"
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          {[0, 1, 2].map((column) => (
            <ul
              key={column}
              className={`flex flex-col divide-y divide-[var(--de-paper-hairline)] ${column === 0 ? "" : "md:pl-6"} ${column === 2 ? "" : "md:pr-6"}`}
            >
              {challenges.slice(column * 2, column * 2 + 2).map((challenge, offset) => {
                const index = column * 2 + offset;
                return (
                  <li key={challenge.title} className="border-b border-[var(--de-paper-hairline)] md:border-b-0">
                    <Link
                      href={challenge.href}
                      data-testid={`tackle-card-${index}`}
                      className="group flex h-full flex-col py-6 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--de-paper)]"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className={indexClass("paper")}>{String(index + 1).padStart(2, "0")}</span>
                        <ArrowRight
                          className="h-4 w-4 text-[#5A5368]/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#D3126A]"
                          aria-hidden="true"
                        />
                      </div>
                      <h3 className="text-lg font-semibold text-[#1A1228] transition-colors group-hover:text-de-magenta-paper-ink">
                        {challenge.title}
                      </h3>
                      <p className="mt-2 text-base leading-relaxed text-[#5A5368]">{challenge.description}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ))}
        </motion.div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base text-[#5A5368]">
            Don&apos;t see your specific challenge? We handle custom threat profiles across Arizona.
          </p>
          <a
            href="/book"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonPrimary("paper")}
            data-testid="tackle-cta"
          >
            Discuss Your Security Needs
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </HomeContainer>
    </HomeChapter>
  );
};

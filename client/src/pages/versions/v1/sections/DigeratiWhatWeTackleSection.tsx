// FROZEN — homepage version 1, snapshot of client/src/pages/sections/DigeratiWhatWeTackleSection.tsx from git ref origin/main on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";

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
    <section className="de-dark-well relative py-12 md:py-20 lg:py-24">
      <div className="mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
        <div className="de-paper-island relative px-6 py-10 sm:px-10 sm:py-14 md:px-14 md:py-18 lg:px-16 lg:py-20">
          <div className="mx-auto max-w-5xl relative z-10">
            {/* Editorial Header */}
            <motion.div
              className="mb-10 md:mb-14 border-b border-[var(--de-paper-hairline)] pb-8 md:pb-10"
              initial={prefersReducedMotion ? false : revealInitial}
              whileInView={revealInView}
              viewport={revealViewport}
              transition={revealTransition}
            >
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                <div className="max-w-2xl">
                  <p className="mb-3 text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-[#D3126A]">
                    Problems we solve
                  </p>
                  <h2 className="mb-4 font-heading text-3xl font-bold tracking-tight text-[#1A1228] sm:text-4xl lg:text-5xl">
                    What We Tackle
                  </h2>
                  <p className="text-base leading-relaxed text-[#3A3448] md:text-lg">
                    Compact view of the problems we own with you. Sourced industry statistics live on
                    Cyber Facts; capability detail lives on Solutions.
                  </p>
                </div>
                <Link href="/resources/cyber-facts" className="group inline-flex shrink-0 items-center gap-1.5 text-sm md:text-base font-semibold text-[#A30E52] hover:text-[#D3126A] transition-colors">
                  Full threat context
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>

            {/* Editorial Grid (Clean column structure with hairlines, no boxed cards) */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--de-paper-hairline)]"
              initial={prefersReducedMotion ? false : revealInitial}
              whileInView={revealInView}
              viewport={revealViewport}
              transition={revealTransition}
            >
              {/* Column 1 */}
              <div className="flex flex-col divide-y divide-[var(--de-paper-hairline)]">
                {challenges.slice(0, 2).map((challenge, index) => (
                  <Link
                    key={challenge.title}
                    href={challenge.href}
                    data-testid={`tackle-card-${index}`}
                    className="group relative flex flex-col p-6 transition-all duration-200 hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold text-[#D3126A] tracking-wider">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-[#5A5368]/40 transition-all duration-200 group-hover:text-[#D3126A] group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="text-base md:text-lg font-semibold text-[#1A1228] transition-colors group-hover:text-[#D3126A]">
                      {challenge.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5A5368]">
                      {challenge.description}
                    </p>
                  </Link>
                ))}
              </div>

              {/* Column 2 */}
              <div className="flex flex-col divide-y divide-[var(--de-paper-hairline)]">
                {challenges.slice(2, 4).map((challenge, index) => (
                  <Link
                    key={challenge.title}
                    href={challenge.href}
                    data-testid={`tackle-card-${index + 2}`}
                    className="group relative flex flex-col p-6 transition-all duration-200 hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold text-[#D3126A] tracking-wider">
                        {String(index + 3).padStart(2, "0")}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-[#5A5368]/40 transition-all duration-200 group-hover:text-[#D3126A] group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="text-base md:text-lg font-semibold text-[#1A1228] transition-colors group-hover:text-[#D3126A]">
                      {challenge.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5A5368]">
                      {challenge.description}
                    </p>
                  </Link>
                ))}
              </div>

              {/* Column 3 */}
              <div className="flex flex-col divide-y divide-[var(--de-paper-hairline)]">
                {challenges.slice(4, 6).map((challenge, index) => (
                  <Link
                    key={challenge.title}
                    href={challenge.href}
                    data-testid={`tackle-card-${index + 4}`}
                    className="group relative flex flex-col p-6 transition-all duration-200 hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold text-[#D3126A] tracking-wider">
                        {String(index + 5).padStart(2, "0")}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-[#5A5368]/40 transition-all duration-200 group-hover:text-[#D3126A] group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="text-base md:text-lg font-semibold text-[#1A1228] transition-colors group-hover:text-[#D3126A]">
                      {challenge.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5A5368]">
                      {challenge.description}
                    </p>
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Reassurance & CTA Footer */}
            <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-[var(--de-paper-hairline)] pt-8">
              <p className="text-sm md:text-base text-[#5A5368]">
                Don&apos;t see your specific challenge? We handle custom threat profiles across Arizona.
              </p>
              <a
                href="/book"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#D3126A] px-6 py-3 text-sm md:text-base font-semibold text-white transition-all duration-200 hover:bg-[#e01874] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]"
                data-testid="tackle-cta"
              >
                Discuss Your Security Needs
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

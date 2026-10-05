import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import "./04-what-we-tackle.css";
import { ChapterPattern } from "@/components/site/Atmosphere";

/**
 * 04 · What we tackle, ported from
 * artifacts/design-concepts/homepage-sections-2026-10/sections/04-what-we-tackle.html.
 * Copy, destinations and test ids from
 * client/src/pages/sections/DigeratiWhatWeTackleSection.tsx. Reading order is
 * row-major as the mock (live is column-first); "Discuss Your Security Needs"
 * opens /book in the same tab (live's target=_blank is a recorded defect, T-06).
 */

const CHALLENGES = [
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

export function V8WhatWeTackle(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const reveal = {
    initial: prefersReducedMotion ? false : revealInitial,
    whileInView: revealInView,
    viewport: revealViewport,
    transition: revealTransition,
  } as const;

  return (
    <section className="f-paper v8-section" id="challenges" aria-labelledby="what-we-tackle-title">
      <ChapterPattern variant="dots" />
      <div className="v8-canvas">
        <motion.div className="tackle__head" {...reveal}>
          <div className="v8-head">
            <p className="v8-eyebrow">Problems we solve</p>
            <h2 className="v8-h2" id="what-we-tackle-title">
              What We Tackle
            </h2>
            <p className="v8-lede">
              Compact view of the problems we own with you. Sourced industry statistics live on Cyber Facts;
              capability detail lives on Solutions.
            </p>
          </div>
          <Link className="v8-link tackle__more" href="/resources/cyber-facts">
            Full threat context <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </motion.div>

        <motion.ol className="v8-cells v8-cells--paper problems" {...reveal}>
          {CHALLENGES.map((challenge, index) => (
            <li className="problem" key={challenge.title}>
              <div className="problem__top">
                <span className="v8-seq" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <ArrowRight className="problem__arrow" size={16} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h3 className="v8-h4 problem__title">
                <Link className="problem__link" href={challenge.href} data-testid={`tackle-card-${index}`}>
                  {challenge.title}
                </Link>
              </h3>
              <p className="v8-body problem__body">{challenge.description}</p>
            </li>
          ))}
        </motion.ol>

        <div className="tackle__ask">
          <p className="v8-lede">
            Don&apos;t see your specific challenge? We handle custom threat profiles across Arizona.
          </p>
          <a className="v8-btn v8-btn--primary" href="/book" data-testid="tackle-cta">
            Discuss Your Security Needs <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

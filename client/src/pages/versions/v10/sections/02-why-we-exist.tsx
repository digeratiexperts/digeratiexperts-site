import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronRight, Phone } from "lucide-react";
import { Link } from "wouter";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import "./02-why-we-exist.css";
import { SceneBackdrop } from "../scene/SceneBackdrop";

/**
 * 02 · Why we exist, ported from
 * artifacts/design-concepts/homepage-sections-2026-10/sections/02-why-we-exist.html.
 * Copy, destinations and test ids from client/src/pages/sections/DigeratiAlertBanner.tsx.
 */

const ICON = { size: 20, strokeWidth: 1.8, "aria-hidden": true } as const;

// The mock keeps the dash and its neighbour together (.nb) so the hyphen never
// starts a line; the copy is the live component's verbatim.
const CLAIMS: Array<{ title: string; body: ReactNode; href: string; testId: string }> = [
  {
    title: "Security-First Operations",
    body: (
      <>
        Every system, endpoint, and user is <span className="nb">protected - by</span> design, not by reaction.
      </>
    ),
    href: "/solutions/proactive-ecosystem",
    testId: "card-security-first",
  },
  {
    title: "Co-Managed or Fully Managed",
    body: "We support your internal IT or serve as your outsourced technology team.",
    href: "/solutions/co-managed-it",
    testId: "card-co-managed",
  },
  {
    title: "Executive-Level Transparency",
    body: (
      <>
        Reports, KPIs, and compliance insights that make <span className="nb">sense - and</span> drive decisions.
      </>
    ),
    href: "/trust",
    testId: "card-transparency",
  },
];

export function V10WhyWeExist(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const reveal = {
    initial: prefersReducedMotion ? false : revealInitial,
    whileInView: revealInView,
    viewport: revealViewport,
    transition: revealTransition,
  } as const;

  return (
    <section className="f-paper v10-section" id="why-we-exist" aria-labelledby="why-we-exist-title">
      <SceneBackdrop frame="network" />
      <div className="v10-canvas why">
        <motion.div className="why__statement" {...reveal}>
          <p className="v10-eyebrow">Why we exist</p>
          <h2 className="v10-h2" id="why-we-exist-title">
            We Exist to Protect and Enable Your Business
          </h2>
          <p className="v10-lede">
            If you&apos;re like most business leaders, you don&apos;t want another vendor — you want a security-first
            partner who proactively reduces risk, improves uptime, and keeps your team moving.
          </p>
        </motion.div>

        <motion.ul className="v10-cells v10-cells--paper claims why__claims" {...reveal}>
          {CLAIMS.map((claim) => (
            <li className="claim" key={claim.title}>
              <span className="v10-dash" aria-hidden="true" />
              <h3 className="v10-h4 claim__title">
                <Link href={claim.href} data-testid={claim.testId}>
                  {claim.title}
                </Link>
              </h3>
              <p className="v10-body claim__body">{claim.body}</p>
              <ChevronRight className="claim__chev" {...ICON} />
            </li>
          ))}
        </motion.ul>

        <motion.div className="why__ask" {...reveal}>
          <h3 className="v10-h3">Ready to Secure Your Business?</h3>
          <p className="v10-body">
            Get enterprise-grade protection tailored for Arizona businesses. Let&apos;s discuss your security needs.
          </p>
          <div className="ask__actions">
            <a className="v10-btn v10-btn--primary" href="/book" data-testid="button-schedule-consultation-banner">
              Schedule Consultation <ArrowRight {...ICON} />
            </a>
            <a
              className="v10-btn v10-btn--outline-paper"
              href={PRIMARY_PHONE.telHref}
              data-testid="button-call-banner"
            >
              <Phone {...ICON} /> Call {PRIMARY_PHONE.display}
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

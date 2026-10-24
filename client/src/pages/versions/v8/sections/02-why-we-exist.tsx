import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import "./02-why-we-exist.css";
import { ChapterPattern } from "@/components/site/Atmosphere";

/**
 * 02 · Why we exist, ported from
 * artifacts/design-concepts/homepage-sections-2026-10/sections/02-why-we-exist.html.
 * Copy, destinations and test ids from client/src/pages/sections/DigeratiAlertBanner.tsx.
 * Lane H: this is now the thin credibility strip under the hero. Its "Ready to Secure
 * Your Business?" CTA band moved to the closing block (CTA system: primary assessment +
 * secondary "Talk to an Expert" with the phone), so the strip carries the narrative only.
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

export function V8WhyWeExist(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const reveal = {
    initial: prefersReducedMotion ? false : revealInitial,
    whileInView: revealInView,
    viewport: revealViewport,
    transition: revealTransition,
  } as const;

  return (
    <section className="f-paper v8-section v8-section--tight" id="why-we-exist" aria-labelledby="why-we-exist-title">
      <ChapterPattern variant="dots" />
      <div className="v8-canvas why">
        <motion.div className="why__statement" {...reveal}>
          <p className="v8-eyebrow">Why we exist</p>
          <h2 className="v8-h2" id="why-we-exist-title">
            We Exist to Protect and Enable Your Business
          </h2>
          <p className="v8-lede">
            If you&apos;re like most business leaders, you don&apos;t want another vendor — you want a security-first
            partner who proactively reduces risk, improves uptime, and keeps your team moving.
          </p>
        </motion.div>

        <motion.ul className="v8-cells v8-cells--paper claims why__claims" {...reveal}>
          {CLAIMS.map((claim) => (
            <li className="claim" key={claim.title}>
              <span className="v8-dash" aria-hidden="true" />
              <h3 className="v8-h4 claim__title">
                <Link href={claim.href} data-testid={claim.testId}>
                  {claim.title}
                </Link>
              </h3>
              <p className="v8-body claim__body">{claim.body}</p>
              <ChevronRight className="claim__chev" {...ICON} />
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

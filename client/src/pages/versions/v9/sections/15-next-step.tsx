import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { useBooking } from "@/contexts/BookingContext";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import "./15-next-step.css";
import { StoryBackdrop } from "../story/StoryBackdrop";

/**
 * Section 15 (mock: artifacts/design-concepts/homepage-sections-2026-10/sections/15-next-step.html).
 * Joe, round 2: one assessment form on the page (13). The live email field here never submitted;
 * it only opened the booking modal, so it is now the button it really was: openBooking("homepage-cta").
 */

const operatingPoints: { key: string; label: JSX.Element }[] = [
  { key: "Audit readiness support", label: <>Audit readiness support</> },
  { key: "Microsoft-aligned stack", label: <><span className="nw">Microsoft-aligned</span> stack</> },
  { key: "HIPAA-minded controls", label: <><span className="nw">HIPAA-minded</span> controls</> },
  { key: "Documented standards", label: <>Documented standards</> },
];

export function V9NextStep(): JSX.Element {
  const { openBooking } = useBooking();
  const reduceMotion = useReducedMotion();
  const reveal = reduceMotion
    ? {}
    : { initial: revealInitial, whileInView: revealInView, viewport: revealViewport, transition: revealTransition };

  return (
    <section className="f-paper v9-section" aria-labelledby="cta-title">
      <StoryBackdrop chapter="converge" />
      <div className="v9-canvas">
        <motion.div className="next" {...reveal}>
          <p className="v9-eyebrow">Cyber Risk Assessment</p>
          <h2 className="v9-h2" id="cta-title">
            Start with a Cyber Risk Assessment
          </h2>
          <p className="v9-lede">
            Discover identity, endpoint, email, backup, and operating gaps before you buy a package.
          </p>
          <p className="next__context">
            Assessment-led recommendations. Final scope confirmed after we see the environment.{" "}
            <span>Serving Arizona professional services, healthcare, and growing SMBs.</span>
          </p>

          <ul className="next__standards" aria-label="Standards we work to">
            {operatingPoints.map((item) => (
              <li key={item.key} data-testid={`badge-${item.key.toLowerCase().replace(/\s+/g, "-")}`}>
                {item.label}
              </li>
            ))}
          </ul>

          <div className="next__action">
            <button
              className="v9-btn v9-btn--primary"
              type="button"
              onClick={() => openBooking("homepage-cta")}
              data-testid="button-cta-assessment"
            >
              {CTA.primary}{" "}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="next__foot">
            <a className="v9-link" href="#contact" data-testid="link-cta-contact">
              Or send a message below
            </a>
            <span className="next__sep" aria-hidden="true">
              ·
            </span>
            <p className="next__call">
              Prefer to call?{" "}
              <a href={PRIMARY_PHONE.telHref} aria-label={`Call ${PRIMARY_PHONE.display}`}>
                {PRIMARY_PHONE.display}
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

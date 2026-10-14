import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, MapPin } from "lucide-react";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { useBooking } from "@/contexts/BookingContext";
import "./09-team.css";
import { StoryBackdrop } from "../story/StoryBackdrop";

/**
 * 09 · The people behind your technology (mock: sections/09-team.html).
 * Founder portrait is the real, approved studio photo (webp with jpg fallback).
 * "Talk to an Expert" opens the booking modal in place, as live (meet_experts).
 */

const ops = [
  { title: "Security Operations", detail: "Monitoring, detection, and response ownership when threats appear." },
  { title: "Technical Operations", detail: "Day-to-day support, identity, endpoints, and environment stability." },
  { title: "Client Success", detail: "QBRs, roadmaps, and a named relationship — not a rotating ticket queue." },
];

const icon = { size: 20, strokeWidth: 1.8, "aria-hidden": true } as const;

export function V9Team(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const { openBooking } = useBooking();
  const reveal = {
    initial: prefersReducedMotion ? false : revealInitial,
    whileInView: revealInView,
    viewport: revealViewport,
    transition: revealTransition,
  } as const;

  return (
    <section className="f-well v9-section team" aria-labelledby="team-title" data-testid="section-meet-experts">
      <StoryBackdrop chapter="owner" />
      <div className="v9-canvas">
        <motion.div className="team__head" {...reveal}>
          <header className="v9-head">
            <p className="v9-eyebrow">Human Trust &amp; Ownership</p>
            <h2 className="v9-h2" id="team-title">
              The people behind <span className="v9-accent">your technology</span>
            </h2>
            <p className="v9-lede">
              When something happens, you should know who owns it — not wonder which anonymous queue picked up your
              ticket.
            </p>
          </header>
          <Link className="v9-link" href="/about/team">
            Meet the team <ArrowRight {...icon} />
          </Link>
        </motion.div>

        <motion.div className="team__body" {...reveal}>
          <figure className="portrait v9-card">
            <picture>
              <source srcSet="/images/founder/joe-petro-studio-blazer-white.webp" type="image/webp" />
              <img
                src="/images/founder/joe-petro-studio-blazer-white.jpg"
                alt="Joseph Petro, Founder of Digerati Experts"
                width={768}
                height={1024}
                loading="lazy"
                decoding="async"
                data-testid="img-founder-joe"
              />
            </picture>
            <figcaption>
              <p className="portrait__name">Joseph Petro</p>
              <p className="portrait__role">Founder &amp; Chief Technology Strategist</p>
              <p className="portrait__loc">
                <MapPin {...icon} />
                Chandler, Arizona HQ
              </p>
            </figcaption>
          </figure>

          <div className="lead">
            <h3 className="v9-h3 lead__title">Principal-Led Managed Security Operations</h3>
            <p className="lead__para">
              Based right here in Chandler, Arizona. Joe stays directly involved in risk assessments, infrastructure
              architecture, and key client milestones — so growing organizations get elite cybersecurity-first managed
              IT without becoming account number four thousand.
            </p>

            <ol className="ops">
              {ops.map((o, i) => (
                <li key={o.title}>
                  <span className="v9-seq">{String(i + 1).padStart(2, "0")}</span>
                  <h4 className="v9-h4">{o.title}</h4>
                  <p className="v9-body">{o.detail}</p>
                </li>
              ))}
            </ol>

            <p className="lead__cta">
              <a
                className="v9-btn v9-btn--primary"
                href="/book"
                onClick={(e) => {
                  e.preventDefault();
                  openBooking("meet_experts");
                }}
                data-testid="button-talk-to-expert"
              >
                Talk to an Expert <ArrowRight {...icon} />
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

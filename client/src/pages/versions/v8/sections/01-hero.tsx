import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  Lock,
  Mail,
  MapPin,
  Play,
  Server,
  Shield,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { useBooking } from "@/contexts/BookingContext";
import { analytics } from "@/lib/analytics";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import heroCityLights from "@/assets/flagship/home-managed-core.jpg?w=2000&format=webp";
import { TipTag } from "./TipTag";
import "./01-hero.css";

/**
 * 01 · Hero + attached trust strip, ported from
 * artifacts/design-concepts/homepage-sections-2026-10/sections/01-hero.html.
 * The mock's site chrome (utility strip, nav, spy row, read-progress hairline)
 * is omitted: the real MegaMenu renders above and the hero clears it via
 * --de-nav-offset (01-hero.css).
 */

const ICON = { size: 20, strokeWidth: 1.8, "aria-hidden": true } as const;

/* ---- Pronunciation (logic from client/src/components/PronunciationCard.tsx) ---- */
const AUDIO_SRC = "/audio/digerati-pronunciation.wav";
const SPOKEN_PRONUNCIATION = "dij-uh-RAH-tee";
const SPEECH_RATE = 0.78;
const METER_STEPS = [1, 0.62, 0.45, 0.62];
const METER_TICK_MS = 150;
const MARK_BARS = [
  { x: 0, y: 0, w: 44 },
  { x: 6.5, y: 15.67, w: 31 },
  { x: 6.5, y: 31.33, w: 31 },
  { x: 0, y: 47, w: 44 },
];

function SayRow(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const [speaking, setSpeaking] = useState(false);
  const [phase, setPhase] = useState(0);
  const [status, setStatus] = useState("Ready to play pronunciation.");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animate = speaking && !prefersReducedMotion;

  useEffect(() => {
    if (!animate) {
      setPhase(0);
      return;
    }
    const id = window.setInterval(() => setPhase((p) => p + 1), METER_TICK_MS);
    return () => window.clearInterval(id);
  }, [animate]);

  // Stop in-flight playback if the hero unmounts mid-utterance.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      audioRef.current?.pause();
    };
  }, []);

  const speak = (text: string, label: string) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      setStatus(`Audio pronunciation is not supported in this browser. Say ${SPOKEN_PRONUNCIATION}.`);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = SPEECH_RATE;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => {
      setSpeaking(true);
      setStatus(`Playing ${label}.`);
    };
    utterance.onend = () => {
      setSpeaking(false);
      setStatus("Pronunciation finished.");
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setStatus(`Audio could not play. Say ${SPOKEN_PRONUNCIATION}.`);
    };
    window.speechSynthesis.speak(utterance);
  };

  const play = () => {
    const el = audioRef.current ?? new Audio(AUDIO_SRC);
    audioRef.current = el;
    el.currentTime = 0;
    el.onended = () => {
      setSpeaking(false);
      setStatus("Pronunciation finished.");
    };
    // A missing or blocked recording falls back to synthesis rather than going silent.
    const fallback = () => {
      setSpeaking(false);
      speak(SPOKEN_PRONUNCIATION, `pronunciation: ${SPOKEN_PRONUNCIATION}`);
    };
    el.onerror = fallback;
    setSpeaking(true);
    setStatus(`Playing pronunciation: ${SPOKEN_PRONUNCIATION}.`);
    void el.play().catch(fallback);
  };

  return (
    <div
      className="say"
      role="group"
      aria-label="How to say Digerati (Digerati Experts)"
      data-testid="digerati-pronunciation-card"
    >
      <svg
        className="say__mark"
        viewBox="0 0 44 56.5"
        aria-hidden="true"
        data-testid="pronunciation-wordmark-meter"
      >
        <g fill="#E3B23C">
          {MARK_BARS.map((bar, i) => (
            <rect
              key={bar.y}
              x={bar.x}
              y={bar.y}
              width={bar.w}
              height={9.5}
              rx={4.75}
              style={
                animate
                  ? { transform: `scaleX(${METER_STEPS[(phase + i) % METER_STEPS.length]})` }
                  : undefined
              }
            />
          ))}
        </g>
      </svg>
      <span className="say__word" lang="en">
        DIG<i>·</i>ER<i>·</i>
        <u>AH</u>
        <i>·</i>TEE
      </span>
      <span className="say__phon">
        \ ˌdi-jə-ˈrä-tē \&nbsp;&nbsp;<b>dij-uh-RAH-tee</b>
      </span>
      <button
        className="say__btn"
        type="button"
        aria-label={`Hear it: ${SPOKEN_PRONUNCIATION}`}
        onClick={play}
        data-testid="button-play-digerati-pronunciation"
      >
        <Play {...ICON} />
        Hear it
      </button>
      <p className="vh" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

/* ---- Assessment preview (values from client/src/components/graphics/DashboardMockup.tsx) ---- */
const REVIEW_AREAS: Array<{ icon: LucideIcon; label: string; bar: string }> = [
  { icon: Lock, label: "Identity & access", bar: "Identity" },
  { icon: Server, label: "Endpoints & devices", bar: "Endpoints" },
  { icon: Mail, label: "Email security", bar: "Email" },
  { icon: FileCheck, label: "Backups & recovery", bar: "Backups" },
];

const POSTURE_BARS: Array<{ label: string; level: number; overall?: boolean }> = [
  { label: "Identity", level: 68 },
  { label: "Endpoints", level: 77 },
  { label: "Email", level: 61 },
  { label: "Backups", level: 84 },
  { label: "Controls", level: 56 },
  { label: "Overall", level: 69, overall: true },
];

const OUTCOMES = ["Prioritized findings", "Business-impact context", "Right-sized recommendations"];

function AssessmentPreview(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  // Staggered grow-in: 40% → level, 0.32s ease-out, delay 0.08 + i*0.03.
  // Skipped under reduced motion and under automation (renders show final state).
  const skipGrow =
    Boolean(prefersReducedMotion) || (typeof navigator !== "undefined" && navigator.webdriver);
  const [grown, setGrown] = useState(skipGrow);

  useEffect(() => {
    if (grown) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [grown]);

  const shown = active ?? "Overall";
  const score = POSTURE_BARS.find((b) => b.label === shown)?.level ?? 69;

  return (
    <motion.figure
      className="win"
      aria-label="Illustrative preview of a Digerati Experts Cyber Risk Assessment"
      initial={prefersReducedMotion ? false : { opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.52,
        delay: prefersReducedMotion ? 0 : 0.08,
        ease: "easeOut",
      }}
      data-testid="hero-assessment-card"
    >
      <div className="win__bar">
        <span className="win__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="win__title">
          <Shield {...ICON} />
          Cyber Risk Assessment · overview
        </span>
        <TipTag tip="Example format, not client data. Real scores come from your assessment.">Illustrative preview</TipTag>
      </div>

      <div className="win__sec">
        <TipTag className="win__tag-sm" tip="Example format, not client data. Real scores come from your assessment.">Illustrative preview</TipTag>
        <p className="win__h">What the assessment reviews</p>
        <p className="win__lead">Review of identity, endpoints, email, backups, and foundational security controls.</p>
        <ul className="areas">
          {REVIEW_AREAS.map(({ icon: Icon, label, bar }) => (
            <li key={bar}>
              <button
                className="area"
                type="button"
                aria-pressed={active === bar}
                onClick={() => setActive((cur) => (cur === bar ? null : bar))}
                onMouseEnter={() => setActive(bar)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(bar)}
                onBlur={() => setActive(null)}
              >
                <span className="v8-iconwell" aria-hidden="true">
                  <Icon {...ICON} />
                </span>
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="win__sec">
        <div className="win__label">
          <div>
            <p className="v8-meta">Posture across key areas</p>
            <p className="win__lead" style={{ marginTop: 4 }}>
              {shown} posture
            </p>
          </div>
          <div className="win__score">
            <p className="score">
              <span className="v8-num">{score}</span>
              <span>/ 100</span>
            </p>
          </div>
        </div>
        {/* Bars follow the pointer as live; keyboard reaches the same readout via
            the tiles (the rows are too short for a 44px target, and every value is printed). */}
        <ul className="bars" aria-label="Sample posture values, illustrative">
          {POSTURE_BARS.map((bar, i) => (
            <li
              key={bar.label}
              data-bar={bar.label}
              className={[bar.overall ? "is-overall" : "", shown === bar.label ? "is-active" : ""]
                .filter(Boolean)
                .join(" ") || undefined}
              onMouseEnter={() => setActive(bar.label)}
              onMouseLeave={() => setActive(null)}
            >
              {bar.label}
              <span className="bar">
                <i
                  style={{
                    width: grown ? `${bar.level}%` : "40%",
                    transition:
                      grown && !skipGrow
                        ? `width 0.32s ease-out ${(0.08 + i * 0.03).toFixed(2)}s, opacity 150ms`
                        : skipGrow
                          ? undefined
                          : "none",
                  }}
                />
              </span>
              <span className="v8-num">{bar.level}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="win__sec win__sec--out">
        <ul className="outcomes" aria-label="What you receive">
          {OUTCOMES.map((item) => (
            <li key={item}>
              <CheckCircle {...ICON} />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </motion.figure>
  );
}

const TRUST_ITEMS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  { icon: ShieldCheck, title: "Cybersecurity First", body: "We secure your business from the inside out." },
  { icon: CheckCircle2, title: "Proactive IT", body: "Prevent issues before they impact your business." },
  { icon: ClipboardCheck, title: "Compliance Ready", body: "Stay compliant with industry standards and regulations." },
  { icon: MapPin, title: "Local & Responsive", body: "Arizona-based team, always here when you need us." },
];

const POSITIONING = ["Assessment-led", "Client-owned access", "Fully managed or co-managed"];

export function V8Hero(): JSX.Element {
  const { openBooking } = useBooking();
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const plateY = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? ["0%", "0%"] : ["0%", "9%"]);

  const openAssessment = (e: MouseEvent<HTMLAnchorElement>) => {
    // Modified clicks keep the /book href (new tab / window).
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    analytics.bookingOpened("hero-reference");
    openBooking("hero-reference");
  };

  return (
    <>
      <section
        ref={sectionRef}
        className="hero scroll-mt-[var(--de-nav-offset)]"
        id="home"
        aria-labelledby="hero-title"
      >
        <motion.div
          className="hero__plate"
          aria-hidden="true"
          style={{ y: plateY, backgroundImage: `url(${heroCityLights})` }}
        />
        <div className="hero__grid" aria-hidden="true" />
        <div className="hero__glow" aria-hidden="true" />

        <div className="v8-canvas hero__body">
          <motion.div
            className="hero__copy"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.42, ease: "easeOut" }}
          >
            <p className="v8-eyebrow">
              Arizona MSP<span className="sep"> · </span>
              <span className="l2">Cybersecurity &amp; Managed IT</span>
            </p>
            <h1 className="v8-h1" id="hero-title">
              <span>Cybersecurity-First</span> <span>IT That Powers</span>{" "}
              <span className="v8-accent">Your Business</span>
            </h1>
            <p className="hero__sub">
              Managed IT, security, and compliance — built for Arizona businesses that can&apos;t afford downtime.
            </p>

            <div className="hero__actions">
              <a
                className="v8-btn v8-btn--hero"
                href="/book"
                onClick={openAssessment}
                data-testid="button-hero-schedule"
              >
                {CTA.heroPrimary} <ArrowRight {...ICON} />
              </a>
              <Link className="v8-btn v8-btn--outline" href={CTA.secondaryHref} data-testid="button-hero-pricing">
                {CTA.secondary}
              </Link>
            </div>

            <ul className="hero__checks">
              <li className="v8-check">
                <Check {...ICON} />
                No obligation
              </li>
              <li className="v8-check">
                <Check {...ICON} />
                Response within one business day
              </li>
              <li>
                <a className="v8-link--quiet" href={PRIMARY_PHONE.telHref} data-testid="link-hero-phone">
                  Call {PRIMARY_PHONE.display}
                </a>
              </li>
            </ul>

            <div className="hero__meta">
              <ul className="hero__position" aria-label="How we work">
                {POSITIONING.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <SayRow />
            </div>
          </motion.div>

          <AssessmentPreview />
        </div>
      </section>

      {/* Joe, 2026-10-03: the live homepage's trust strip reads better than V7's
          heading-over-cells, so V8 uses its layout (ruled label, four items with
          dividers, white icon tiles) on the white band instead of the cream. */}
      <section className="f-paper tstrip" aria-labelledby="trust-title">
        <div className="v8-canvas tstrip__row">
          <h2 id="trust-title" className="tstrip__label">
            Trusted IT partner
            <span>for Arizona businesses</span>
          </h2>
          <ul className="tstrip__items">
            {TRUST_ITEMS.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <span className="tstrip__icon" aria-hidden="true">
                  <Icon {...ICON} />
                </span>
                <div className="tstrip__text">
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

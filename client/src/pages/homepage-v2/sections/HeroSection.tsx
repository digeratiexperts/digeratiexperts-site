import type { CSSProperties } from "react";
import heroImage from "@assets/de-hero-arizona-dusk-1600.webp";
import { DexMark } from "@/components/mascots/Mascots";
import { CheckIcon, PhoneIcon } from "../icons";
import { PHONE_DISPLAY, PHONE_HREF, objectIcon } from "../content";
import { HOME_CTA } from "../cta";
import { ReviewChip } from "./Reviews";

const READINESS_BARS = [
  { label: "Identity", value: 68 },
  { label: "Endpoints", value: 77 },
  { label: "Email", value: 61 },
  { label: "Backups", value: 84 },
  { label: "Controls", value: 56 },
];

const ASSESSED_AREAS = [
  { icon: "lock", label: "Identity & access" },
  { icon: "laptop", label: "Endpoints & devices" },
  { icon: "email", label: "Email security" },
  { icon: "backup", label: "Backups & recovery" },
];

/**
 * The card previews a SAMPLE report (example values, not a client's score) and links to
 * the full sample, so the numbers read as "this is what you get", not as a claim.
 * The pronunciation widget moved to About (/about/mission-values) to keep the hero on task.
 */
const SAMPLE_REPORT_HREF = "/resources/reports/cyber-risk-assessment-sample";

/** Dex sits on the assessment card only; the hero carries no founder photo. */
export function HeroSection(): JSX.Element {
  return (
    <header
      className="hero band on-photo t-sonoran"
      style={{ "--hero-img": `url(${heroImage})` } as CSSProperties}
    >
      <div className="wrap">
        <div>
          <p className="mark">Arizona MSP for cybersecurity and managed IT</p>
          <h1>Cybersecurity-first IT that powers your business.</h1>
          <p className="lede">Managed IT, security, and compliance — built for Arizona businesses that can't afford downtime.</p>
          <div className="row">
            <a href="#contact" className="btn btn-cta" data-testid="button-hero-schedule">{HOME_CTA.primary}</a>
            <a href="/pricing" className="btn btn-line" data-testid="button-hero-pricing">See Plans &amp; Pricing</a>
          </div>
          <div className="facts">
            <ReviewChip />
            <span><CheckIcon />No obligation</span>
            <span><CheckIcon />Response within one business day</span>
            <span><PhoneIcon /><a href={PHONE_HREF}>{PHONE_DISPLAY}</a></span>
          </div>
        </div>

        <a
          className="card deep assess"
          href={SAMPLE_REPORT_HREF}
          aria-label="See a sample report: Cyber Risk Assessment overview"
          data-testid="link-hero-sample-report"
        >
          <DexMark size={66} className="dex-perch" title="Dex" />
          <div className="assess-top"><span>Cyber Risk Assessment overview</span><span className="chip">Sample report</span></div>
          <h3>What the assessment reviews</h3>
          <p className="muted small">Identity, endpoints, email, backups, and foundational security controls.</p>
          <div className="areas">
            {ASSESSED_AREAS.map((area) => (
              <div key={area.label}><img src={objectIcon(area.icon)} alt="" />{area.label}</div>
            ))}
          </div>
          <div className="score"><span className="muted small">Overall posture</span><b>69 <small>/ 100</small></b></div>
          {READINESS_BARS.map((bar) => (
            <div className="bar" key={bar.label}>
              <span>{bar.label}</span>
              <i style={{ "--v": `${bar.value}%` } as CSSProperties} />
              <span>{bar.value}</span>
            </div>
          ))}
          <span className="link assess-link">See a sample report</span>
        </a>
      </div>
    </header>
  );
}

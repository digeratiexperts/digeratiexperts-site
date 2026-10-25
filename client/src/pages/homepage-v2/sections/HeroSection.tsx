import type { CSSProperties } from "react";
import heroImage from "@assets/de-hero-arizona-dusk-1600.webp";
import { DexMark } from "@/components/mascots/Mascots";
import { CheckIcon, PhoneIcon, SoundIcon } from "../icons";
import { PHONE_DISPLAY, PHONE_HREF, objectIcon } from "../content";
import { HOME_CTA } from "../cta";

/** See client/public/audio/README.md for how the file was made and how to replace it. */
const PRONUNCIATION_AUDIO = "/audio/digerati-pronunciation.wav";
/** Second voice, tried when the main file cannot play (client/public/audio/README.md). */
const PRONUNCIATION_BACKUP = "/audio/digerati-pronunciation-backup.mp3";

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

/** Dex sits on the assessment card only; the hero carries no founder photo. */
export function HeroSection(): JSX.Element {
  // Plays the fixed pronunciation asset so the name sounds the same on every
  // device; the backup voice is tried next, and browser synthesis only if
  // neither file can play.
  const speakName = () => {
    let fellBack = false;
    const synth = () => {
      if (fellBack) return;
      fellBack = true;
      try {
        const utterance = new SpeechSynthesisUtterance("dij uh RAH tee");
        utterance.rate = 0.8;
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
      } catch {
        // Speech synthesis is optional; the phonetic spelling is printed beside the button.
      }
    };
    let triedBackup = false;
    const backup = () => {
      if (triedBackup) return;
      triedBackup = true;
      const second = new Audio(PRONUNCIATION_BACKUP);
      second.onerror = synth;
      void second.play().catch(synth);
    };
    const audio = new Audio(PRONUNCIATION_AUDIO);
    audio.onerror = backup;
    void audio.play().catch(backup);
  };

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
            <span><CheckIcon />No obligation</span>
            <span><CheckIcon />Response within one business day</span>
            <span><PhoneIcon /><a href={PHONE_HREF}>{PHONE_DISPLAY}</a></span>
          </div>
          <div className="word" data-testid="digerati-pronunciation-card">
            <b>DIG·ER·A·TI</b>
            <span>\ ˌdi-jə-ˈrä-tē \</span>
            <span className="say">dij-uh-RAH-tee</span>
            <button type="button" onClick={speakName} data-testid="button-play-digerati-pronunciation"><SoundIcon />Hear it</button>
          </div>
        </div>

        <div className="card deep assess" aria-label="Illustrative Cyber Risk Assessment preview">
          <DexMark size={66} className="dex-perch" title="Dex" />
          <div className="assess-top"><span>Cyber Risk Assessment overview</span><span className="chip">Illustrative</span></div>
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
        </div>
      </div>
    </header>
  );
}

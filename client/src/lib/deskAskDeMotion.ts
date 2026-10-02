/**
 * Ask DE motion helpers — page-aware greeting/starters + client-side reveal.
 * Server still returns the full reply; streaming is presentation only.
 */

import { isDoor2Path } from "@/lib/isDoor2Path";
import { readAnonymousSituation } from "@/lib/anonymousSituation";

export type DeskMotionPage =
  | "home"
  | "pricing"
  | "compliance"
  | "store"
  | "cybersecurity"
  | "support"
  | "other";

export type DeskMotionChipIcon =
  | "wrench"
  | "shield"
  | "file"
  | "grid"
  | "alert"
  | "dollar"
  | "cart";

export type DeskMotionChip = {
  label: string;
  icon: DeskMotionChipIcon;
  /** When set, chip opens Get Support with that ticket chip instead of sending chat. */
  ticketChip?: "security-incident";
};

export type DeskMotionPageCopy = {
  greet: string;
  chips: DeskMotionChip[];
};

export const DESK_INCIDENT_STARTER: DeskMotionChip = {
  label: "Possible security incident",
  icon: "alert",
  ticketChip: "security-incident",
};

export const DESK_PAGE_COPY: Record<DeskMotionPage, DeskMotionPageCopy> = {
  home: {
    greet:
      "DE Desk here. Tell me what broke, what you're evaluating, or what you're trying to protect — you'll get a clear read and the sensible next step.",
    chips: [
      { label: "I need IT help", icon: "wrench" },
      { label: "I'm concerned about cybersecurity", icon: "shield" },
      { label: "I need help with compliance", icon: "file" },
      { label: "I'm evaluating managed IT", icon: "grid" },
    ],
  },
  pricing: {
    greet:
      "Looking at ProActive tiers? Tell me your headcount and whether you're under HIPAA, CMMC or a cyber-insurance questionnaire, and I'll say which tier actually fits — no upsell.",
    chips: [
      { label: "What's the difference between Office and Enterprise?", icon: "dollar" },
      { label: "We're 25 people, what would this run?", icon: "grid" },
      { label: "Which tier covers HIPAA?", icon: "file" },
      { label: "Can we start with just security?", icon: "wrench" },
    ],
  },
  compliance: {
    greet:
      "HIPAA questions land here a lot. Ask about a specific control, an audit deadline, or what a risk assessment involves and I'll give you the straight version.",
    chips: [
      { label: "We got an OCR letter — what now?", icon: "file" },
      { label: "Do we need a HIPAA risk assessment every year?", icon: "shield" },
      { label: "What does DE handle vs. what stays on us?", icon: "grid" },
      { label: "Our EHR vendor says we're covered. Are we?", icon: "wrench" },
    ],
  },
  // The public Store (Door 2): a solution is built from needs, sized from the
  // profile and confirmed by DE. No catalog, no cart, nothing priced here.
  store: {
    // Only what the Desk can answer from its own knowledge: it does not carry the
    // Store's sizing table, and its store mode quotes ProActive floors when asked
    // about price, so no starter invites a price question (DE confirms pricing
    // after it reads the solution).
    greet:
      "Building a solution? I can explain what each need covers and how Standalone and Co-Managed differ. DE confirms scope with you after you send it.",
    chips: [
      { label: "What's the difference between Standalone and Co-Managed?", icon: "grid" },
      { label: "Which need fits our situation?", icon: "file" },
      { label: "What happens after I send my solution?", icon: "shield" },
      { label: "Can I talk to an engineer first?", icon: "wrench" },
    ],
  },
  cybersecurity: {
    greet:
      "Security questions are welcome here. Tell me what you're worried about — mailbox, ransomware, MFA, vendor access — and I'll give you the straight read plus the next step.",
    chips: [
      { label: "I'm concerned about cybersecurity", icon: "shield" },
      { label: "Do we need MFA everywhere?", icon: "wrench" },
      { label: "What does a risk assessment cover?", icon: "file" },
      { label: "How do we lock down email?", icon: "grid" },
    ],
  },
  support: {
    greet:
      "DE Desk here. Describe what's broken or what you need routed, and we'll give you a clear next step — ticket, call, or guidance.",
    chips: [
      { label: "I need IT help", icon: "wrench" },
      { label: "Something isn't working", icon: "file" },
      { label: "I need help signing in", icon: "grid" },
      { label: "I'm evaluating managed IT", icon: "shield" },
    ],
  },
  other: {
    greet:
      "DE Desk here. Tell me what broke, what you're evaluating, or what you're trying to protect — you'll get a clear read and the sensible next step.",
    chips: [
      { label: "I need IT help", icon: "wrench" },
      { label: "I'm concerned about cybersecurity", icon: "shield" },
      { label: "I need help with compliance", icon: "file" },
      { label: "I'm evaluating managed IT", icon: "grid" },
    ],
  },
};

export function inferDeskPageType(pathname: string): DeskMotionPage {
  const p = pathname.toLowerCase();
  if (p === "/" || p === "") return "home";
  // Door 2 only: the staff warehouse and any other path containing "/store" are not the public Store.
  if (isDoor2Path(p)) return "store";
  if (p.includes("pricing") || p.includes("ecosystem") || p.includes("proactive")) return "pricing";
  if (p.includes("compliance") || p.includes("hipaa") || p.includes("cmmc")) return "compliance";
  if (p.includes("cyber") || p.includes("ransomware") || (p.includes("security") && !p.includes("incident")))
    return "cybersecurity";
  if (p.includes("/support")) return "support";
  return "other";
}

function deskSituationClause(): string {
  const situation = readAnonymousSituation();
  if (!situation) return "";
  // Keep this short: Ask DE typewrites the greeting before starter chips appear.
  return "This device already has a Store situation. I don't have a name or email from that — ask about that environment or a different path.";
}

export function startersForPage(page: DeskMotionPage): DeskMotionChip[] {
  const base = DESK_PAGE_COPY[page].chips.filter((c) => c.ticketChip !== "security-incident");
  const alreadyHasIncident = DESK_PAGE_COPY[page].chips.some((c) => c.ticketChip === "security-incident");
  // Always pin the magenta incident chip last (even if the page also listed it).
  const withoutDupIncident = alreadyHasIncident
    ? DESK_PAGE_COPY[page].chips.filter((c) => c.ticketChip !== "security-incident")
    : base;
  const chips = withoutDupIncident.slice(0, 4);
  if (readAnonymousSituation() && chips.length > 0) {
    chips[0] = {
      label:
        page === "store"
          ? "Help me finish the solution I started"
          : "Talk through the environment I started in the Store",
      icon: "grid",
    };
  }
  return [...chips, DESK_INCIDENT_STARTER];
}

export function greetingForPage(page: DeskMotionPage): string {
  const base = DESK_PAGE_COPY[page].greet;
  const clause = deskSituationClause();
  return clause ? `${base} ${clause}` : base;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export const DESK_NUDGE_SESSION_KEY = "de-desk-nudge-dismissed-v1";
export const DESK_NUDGE_SHOWN_KEY = "de-desk-nudge-shown-v1";

export function isDeskNudgeDismissed(): boolean {
  try {
    return sessionStorage.getItem(DESK_NUDGE_SESSION_KEY) === "1";
  } catch {
    return true;
  }
}

export function markDeskNudgeDismissed(): void {
  try {
    sessionStorage.setItem(DESK_NUDGE_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasDeskNudgeBeenShown(): boolean {
  try {
    return sessionStorage.getItem(DESK_NUDGE_SHOWN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markDeskNudgeShown(): void {
  try {
    sessionStorage.setItem(DESK_NUDGE_SHOWN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * True while the cookie banner is, or is about to be, on screen. Consent is
 * decided from storage, not from the DOM: the banner mounts ~1.2 s after load,
 * so a DOM-only check answers "no banner" during that window and the nudge can
 * land on top of it — and over the launcher — for reduced-motion visitors,
 * whose nudge delay is 0. No stored consent ⇒ the banner will show ⇒ blocking.
 */
export function isCookieBannerBlocking(): boolean {
  if (typeof document === "undefined") return false;
  try {
    if (
      localStorage.getItem("de_cookie_consent_v2") ||
      localStorage.getItem("de_cookie_consent")
    ) {
      return !!document.querySelector("[data-testid='cookie-consent-banner']");
    }
  } catch {
    /* storage unavailable — treat as blocking until known */
  }
  return true;
}

/** Char-by-char typewriter (~55 cps) with punctuation pauses. */
export function typewriteText(
  text: string,
  onUpdate: (partial: string) => void,
  onDone: () => void,
  options?: { cps?: number; signal?: { cancelled: boolean } },
): void {
  const cps = options?.cps ?? 55;
  const signal = options?.signal;
  if (prefersReducedMotion()) {
    onUpdate(text);
    onDone();
    return;
  }
  let i = 0;
  const step = () => {
    if (signal?.cancelled) return;
    if (i >= text.length) {
      onUpdate(text);
      onDone();
      return;
    }
    const ch = text[i++];
    onUpdate(text.slice(0, i));
    let delay = 1000 / cps;
    if (ch === "." || ch === "—" || ch === "?") delay *= 6;
    else if (ch === "," || ch === "\n") delay *= 3;
    window.setTimeout(step, delay);
  };
  step();
}

/** Word-by-word stream (28–68ms per token including whitespace). */
export function streamWords(
  text: string,
  onUpdate: (partial: string) => void,
  onDone: () => void,
  options?: { signal?: { cancelled: boolean } },
): void {
  const signal = options?.signal;
  if (prefersReducedMotion()) {
    onUpdate(text);
    onDone();
    return;
  }
  const parts = text.split(/(\s+)/);
  let i = 0;
  let shown = "";
  const step = () => {
    if (signal?.cancelled) return;
    if (i >= parts.length) {
      onUpdate(text);
      onDone();
      return;
    }
    shown += parts[i++];
    onUpdate(shown);
    window.setTimeout(step, 28 + Math.random() * 40);
  };
  step();
}

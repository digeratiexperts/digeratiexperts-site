// Dex's presence: which emotion, motion state and compact form to show for a situation (Joe, 2026-10-22).
// Written ahead of time so the choice is fast and needs no lookup at runtime. The rules read only the
// signals passed in, never notes or documents, so the same situation always gets the same presence.
// Rules are ordered: the first match wins. DEX_RULES_VERSION changes when a rule's meaning changes.
import { activeHoliday, type Holiday } from "./holidays";
import type { DexMode, DexState } from "./dexGeometry";

export const DEX_RULES_VERSION = 1;

export type CompactForm = "capsule" | "tile" | "beads" | "bubble" | "ring" | "pebble";
export type Audience = "client" | "prospect" | "public";
export type Phase = "greeting" | "working" | "waiting" | "handoff" | "resolved" | "failed" | "idle";
export type Topic = "security" | "outage" | "billing" | "general";
export type Urgency = 0 | 1 | 2 | 3;

export interface DexSignals {
  audience: Audience;
  phase: Phase;
  topic: Topic;
  urgency: Urgency;
  /** True outside DE working hours. */
  afterHours?: boolean;
  /** "email" puts Dex in an email signature or profile; default is the chat window. */
  surface?: "chat" | "email";
  /** True while Dex is composing a reply in the chat. */
  composing?: boolean;
}

export interface DexPresence {
  mode: DexMode;
  state: DexState;
  form: CompactForm | null;
  /** A DE person must take the next step. Dex never decides these alone. */
  mustHandOff: boolean;
  /** Why this presence was chosen, in plain words. Shown on the review page and in logs. */
  reason: string;
}

/**
 * Every emotion, written before it happens: when to use it, when never to, and a sample line in DE's voice.
 * The sample lines make no factual claims (no prices, no timings, no outcomes).
 */
export const DEX_EMOTIONS: Record<DexMode, { when: string; never: string; line: string }> = {
  normal: { when: "Greeting and idle presence.", never: "Never as a stand-in for real urgency.", line: "Hi, I'm Dex. What can I help you with?" },
  curious: { when: "Asking one clear question.", never: "Never to probe for details the client already gave.", line: "Quick question so we route this right: which site is affected?" },
  focused: { when: "Work is in progress on the client's request.", never: "Never to suggest a result before the work is done.", line: "Working on it now." },
  alert: { when: "Needs attention soon, not yet an incident.", never: "Never for routine or resolved items.", line: "This needs a person's attention soon. I've flagged it." },
  extreme: { when: "Live security incident or outage (urgency 3 only).", never: "Never for billing, sales or a routine alert.", line: "This is urgent. A technician is being brought in now." },
  reassuring: { when: "Handing to a person, or easing a worried client.", never: "Never promise a fix time or outcome.", line: "I've passed this to a DE technician. They have the details." },
  concerned: { when: "A step failed or went wrong.", never: "Never claim a fix is in place.", line: "That step didn't go through. I've let a person know." },
  done: { when: "A routine outcome is confirmed.", never: "Never for security, billing or anything not yet verified.", line: "That's sorted." },
  resting: { when: "Outside working hours, or paused.", never: "Never to hide an open urgent item.", line: "We're closed right now. Leave your details and we'll follow up." },
};

/** Builds one presence. mustHandOff comes from the signals only, so no rule can skip a person on security or billing. */
function present(
  mode: DexMode,
  state: DexState,
  form: CompactForm | null,
  reason: string,
  s: DexSignals,
): DexPresence {
  const mustHandOff =
    s.topic === "security" || s.topic === "billing" || s.urgency >= 2 || s.phase === "failed" || s.phase === "handoff";
  return { mode, state, form, mustHandOff, reason };
}

/** Pick Dex's presence from the signals. Pure: same input, same output. */
export function chooseDexPresence(s: DexSignals): DexPresence {
  const serious = s.topic === "security" || s.topic === "outage";
  const chatForm = (f: CompactForm): CompactForm => (s.surface === "email" ? "tile" : f);

  if (s.urgency === 3 && serious)
    return present("extreme", "thinking", "ring", "Live security or outage at urgency 3: full alert, attention ring, a person takes it.", s);

  if (s.phase === "failed")
    return present("concerned", "listening", chatForm("bubble"), "A step failed: show concern, say so, hand to a person. Never claim a fix.", s);

  if (s.phase === "handoff")
    return present("reassuring", "speaking", chatForm("bubble"), "Handing to a DE technician: calm, and say a person is taking over.", s);

  if (s.phase === "resolved") {
    if (s.topic === "security" || s.topic === "billing")
      return present("reassuring", "speaking", null, "Resolved, but security and billing are not celebrated until a person verifies them.", s);
    return present("done", "speaking", null, "Routine outcome confirmed: a quiet done, no celebration.", s);
  }

  if (s.urgency === 2)
    return present("alert", "listening", "ring", "Needs attention soon, not yet an incident.", s);

  if (s.phase === "idle" && s.afterHours)
    return present("resting", "idle", chatForm("pebble"), "Outside working hours: resting, leave details.", s);

  if (s.phase === "waiting")
    return present("curious", "speaking", chatForm("bubble"), "Waiting on the client: ask one clear question.", s);

  if (s.phase === "working")
    return present("focused", s.composing ? "speaking" : "thinking", s.composing ? "beads" : "capsule", "Work in progress on the client's request.", s);

  if (s.phase === "greeting")
    return present("normal", "listening", chatForm("bubble"), "First contact: calm, listening.", s);

  return present("normal", "idle", s.surface === "email" ? "tile" : null, "No specific reason to change shape: resting pose.", s);
}

export interface DexLook {
  presence: DexPresence;
  /** The holiday set showing on this day, or null. Never shown when a person must step in or urgency is 2 or more. */
  holiday: Holiday | null;
  holidayReason: string;
}

/** The one call other apps make: presence plus, when it is safe and the date falls in a holiday window, the holiday set. */
export function resolveDexLook(s: DexSignals, now: Date): DexLook {
  const presence = chooseDexPresence(s);
  if (presence.mustHandOff || s.urgency >= 2)
    return { presence, holiday: null, holidayReason: "Holiday sets are off while a person must step in or urgency is high." };
  const active = activeHoliday(now);
  if (!active) return { presence, holiday: null, holidayReason: "No holiday window on this date." };
  return { presence, holiday: active.holiday, holidayReason: `${active.holiday.name} window.` };
}

/**
 * Named interactions. Each is a signal set; the presence is computed by the rules, not written by hand.
 * The review page shows the computed result, so a rule change shows up there immediately.
 */
export const DEX_INTERACTIONS: { id: string; situation: string; signals: DexSignals }[] = [
  { id: "first-greeting", situation: "A prospect opens the chat for the first time.", signals: { audience: "prospect", phase: "greeting", topic: "general", urgency: 0 } },
  { id: "after-hours-visit", situation: "Someone writes in outside working hours.", signals: { audience: "public", phase: "idle", topic: "general", urgency: 0, afterHours: true } },
  { id: "client-ticket-working", situation: "A client's routine request is being worked.", signals: { audience: "client", phase: "working", topic: "general", urgency: 1 } },
  { id: "dex-composing", situation: "Dex is writing a reply in the chat.", signals: { audience: "client", phase: "working", topic: "general", urgency: 1, composing: true } },
  { id: "waiting-on-client", situation: "Dex needs one answer from the client to continue.", signals: { audience: "client", phase: "waiting", topic: "general", urgency: 1 } },
  { id: "routine-ticket-closed", situation: "A routine request is confirmed done.", signals: { audience: "client", phase: "resolved", topic: "general", urgency: 0 } },
  { id: "billing-question", situation: "A client asks about an invoice or payment.", signals: { audience: "client", phase: "handoff", topic: "billing", urgency: 1 } },
  { id: "security-alert-open", situation: "A security alert is open and needs a person soon.", signals: { audience: "client", phase: "working", topic: "security", urgency: 2 } },
  { id: "security-fixed-unverified", situation: "A security fix is reported but not yet verified.", signals: { audience: "client", phase: "resolved", topic: "security", urgency: 1 } },
  { id: "outage-incident", situation: "A live outage is affecting a client.", signals: { audience: "client", phase: "working", topic: "outage", urgency: 3 } },
  { id: "automation-failed", situation: "An automated step failed.", signals: { audience: "client", phase: "failed", topic: "general", urgency: 1 } },
  { id: "hand-to-technician", situation: "The request needs a DE technician.", signals: { audience: "client", phase: "handoff", topic: "general", urgency: 1, surface: "chat" } },
  { id: "email-signature", situation: "Dex's mark in an email signature or profile.", signals: { audience: "public", phase: "idle", topic: "general", urgency: 0, surface: "email" } },
];

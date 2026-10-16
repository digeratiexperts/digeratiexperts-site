import type { CampaignSlug } from "./campaigns";

/**
 * Public DE sessions — the live webinars a prospect or client can register for.
 *
 * SCOPE: only events a member of the public may see. Client-only and internal
 * events (QBR season, all-hands, patch reviews, staff training) live in
 * `scripts/de-events/program.ts`, which is never bundled into the site, and
 * are rendered into the internal calendar under `docs/marketing/`.
 *
 * TIME: every DE session is run from Chandler, Arizona. America/Phoenix has
 * no daylight saving, so the offset is always -07:00 and a start written here
 * is unambiguous all year.
 *
 * TRUTH (Tier 0): a session stays `planned` until Joe confirms the date, the
 * presenter and the meeting platform (5 and 19 Nov 2026 confirmed by Joe,
 * 2026-10-16: Joseph Petro presents, on Zoho). Joe, 2026-10-15: "Prepare campaign
 * assets but do not publish unconfirmed event details." So a planned session
 * is not public at all: /events does not list it, its page answers 404 (the
 * client shows Not Found and server/spaKnownPaths.ts does not know the path),
 * and nothing about it reaches search. Confirming a session means setting
 * `status: "confirmed"` here AND adding its path to spaKnownPaths; the tests
 * fail if either is missing. A public session never shows a join link, an
 * attendee count or a guest speaker it does not have.
 */

export type EventAudience = "prospects" | "clients" | "prospects-and-clients";
export type EventStatus = "planned" | "confirmed" | "completed" | "cancelled";

export interface DeEventSession {
  slug: string;
  title: string;
  /** One line for cards and the calendar grid. */
  summary: string;
  /** ISO start with the fixed Phoenix offset, e.g. 2026-10-29T11:00:00-07:00. */
  start: string;
  durationMinutes: number;
  audience: EventAudience;
  status: EventStatus;
  /** Why this month — the seasonal hook the session hangs on. */
  hook: string;
  /** What attendees leave with. Plain promises the session can keep. */
  takeaways: string[];
  agenda: { minutes: number; title: string }[];
  fitFor: string[];
  /** The /go/:slug campaign this session feeds. */
  campaign: CampaignSlug;
  format: "Live webinar" | "Live working session" | "Office hours";
  /** Named only once confirmed (Joe, 2026-10-16). */
  presenter?: string;
  /** Where the session runs. The join link itself is never public; it goes in the T-1 email. */
  platform?: string;
}

export const DE_EVENT_TIME_ZONE = "America/Phoenix";

export const DE_EVENT_SESSIONS: DeEventSession[] = [
  {
    slug: "cyber-insurance-renewal-readiness",
    title: "Before Your Cyber Insurance Renewal: The Controls Underwriters Ask About",
    summary:
      "Walk the questionnaire before it walks you: MFA, EDR, email authentication, backups and awareness training.",
    start: "2026-11-05T11:00:00-07:00",
    durationMinutes: 60,
    audience: "prospects-and-clients",
    status: "confirmed",
    hook:
      "Q4 and Q1 renewals are opening — the window where a missing control can still be fixed instead of explained.",
    takeaways: [
      "The control areas carrier questionnaires typically ask about, in plain language",
      "How to tell a missing control from missing evidence of a control you already run",
      "A sequencing order for the work when renewal is weeks away, not months",
      "What an MSP can and cannot do for you here — DE does not guarantee coverage or interpret policy terms",
    ],
    agenda: [
      { minutes: 10, title: "Why the application now asks how you operate" },
      { minutes: 20, title: "The control areas, one by one: identity, endpoint, email, backup, awareness" },
      { minutes: 15, title: "Missing control or missing evidence? Working a sample questionnaire" },
      { minutes: 15, title: "Open questions — bring the questionnaire you were sent" },
    ],
    fitFor: [
      "Owners and finance or operations leads who fill in the carrier questionnaire",
      "IT leads asked to produce evidence for a renewal",
    ],
    campaign: "cyber-insurance",
    format: "Live webinar",
    presenter: "Joseph Petro",
    platform: "Zoho Webinar",
  },
  {
    slug: "holiday-invoice-fraud-and-phishing",
    title: "Holiday Invoice Fraud: How Payment-Change Emails Get Past Busy Teams",
    summary:
      "The year-end rush is when a spoofed vendor asks for new bank details. See the pattern and the controls that help catch it.",
    start: "2026-11-19T11:00:00-07:00",
    durationMinutes: 45,
    audience: "prospects-and-clients",
    status: "confirmed",
    hook:
      "Year-end invoices, thin holiday staffing and gift-card requests give payment-change and gift-card scams the cover they rely on.",
    takeaways: [
      "The anatomy of a payment-change and gift-card request email",
      "Email authentication (SPF, DKIM, DMARC) explained without the jargon",
      "A call-back rule your accounts-payable team can adopt this week",
    ],
    agenda: [
      { minutes: 10, title: "What a payment-change attempt looks like" },
      { minutes: 15, title: "Email authentication and filtering — what each layer catches" },
      { minutes: 10, title: "The process controls that matter more than any tool" },
      { minutes: 10, title: "Open questions" },
    ],
    fitFor: [
      "Accounts-payable and office managers",
      "Owners who approve payments",
    ],
    campaign: "email-security",
    format: "Live webinar",
    presenter: "Joseph Petro",
    platform: "Zoho Webinar",
  },
  {
    slug: "ransomware-restore-readiness-2027",
    title: "Can You Actually Restore? A Ransomware Readiness Working Session",
    summary:
      "Start 2027 with the question that matters after an attack: how long until the business runs again.",
    start: "2027-01-21T11:00:00-07:00",
    durationMinutes: 60,
    audience: "prospects-and-clients",
    status: "planned",
    hook:
      "January is planning season — the right time to test a restore before an incident tests it for you.",
    takeaways: [
      "The difference between having backups and being able to restore",
      "How to set a realistic recovery-time expectation with leadership",
      "A one-page restore-test checklist you can run without us",
    ],
    agenda: [
      { minutes: 10, title: "What ransomware actually targets first" },
      { minutes: 20, title: "Backup, immutability and the restore test" },
      { minutes: 15, title: "Writing the recovery expectation down" },
      { minutes: 15, title: "Open questions" },
    ],
    fitFor: ["Owners and operators", "Internal IT and office managers who own backups"],
    campaign: "ransomware-readiness",
    format: "Live working session",
  },
  {
    slug: "co-managed-it-for-internal-teams",
    title: "Co-Managed IT: Backup for the Internal IT Team, Not a Replacement",
    summary:
      "For the one- or two-person IT department: where a co-managed partner fits, and where it should stay out.",
    start: "2027-02-18T11:00:00-07:00",
    durationMinutes: 45,
    audience: "prospects",
    status: "planned",
    hook: "Budgets are set and the year's projects are queued — the point where internal IT finds out what it cannot cover alone.",
    takeaways: [
      "Which work internal IT should keep, and which to hand off",
      "How tooling, after-hours coverage and escalation split in practice",
      "Questions to ask any co-managed provider, including us",
    ],
    agenda: [
      { minutes: 10, title: "Where small internal teams run out of hours" },
      { minutes: 20, title: "Splitting the work: ownership, tooling, escalation" },
      { minutes: 15, title: "Open questions" },
    ],
    fitFor: ["Internal IT leads and solo IT administrators", "Operations leaders who manage IT"],
    campaign: "co-managed-it",
    format: "Live webinar",
  },
  {
    slug: "world-backup-day-restore-drill",
    title: "World Backup Day: A Live Restore Drill",
    summary:
      "Watch a file and a machine come back from backup in real time, and leave with the drill to run yourself.",
    start: "2027-03-31T11:00:00-07:00",
    durationMinutes: 45,
    audience: "prospects-and-clients",
    status: "planned",
    hook: "March 31 is World Backup Day — a yearly reminder to check that a backup actually restores.",
    takeaways: [
      "A restore drill you can repeat quarterly",
      "What to record so the next audit or insurance renewal has evidence",
    ],
    agenda: [
      { minutes: 10, title: "Why a backup you have never restored is a hope" },
      { minutes: 20, title: "The live drill" },
      { minutes: 15, title: "Open questions" },
    ],
    fitFor: ["Anyone responsible for business data"],
    campaign: "ransomware-readiness",
    format: "Live working session",
  },
];

const MS_PER_MINUTE = 60_000;

export function sessionBySlug(slug: string): DeEventSession | undefined {
  return DE_EVENT_SESSIONS.find((session) => session.slug === slug);
}

export function sessionStart(session: DeEventSession): Date {
  return new Date(session.start);
}

export function sessionEnd(session: DeEventSession): Date {
  return new Date(sessionStart(session).getTime() + session.durationMinutes * MS_PER_MINUTE);
}

/** Only confirmed (or completed) sessions are public; planned ones are not shown anywhere. */
export function isPublic(session: DeEventSession): boolean {
  return session.status === "confirmed" || session.status === "completed";
}

/** A public session by slug; planned and cancelled sessions resolve to undefined. */
export function publicSessionBySlug(slug: string): DeEventSession | undefined {
  const session = sessionBySlug(slug);
  return session && isPublic(session) ? session : undefined;
}

/** Upcoming public sessions, soonest first. */
export function upcomingSessions(now: Date = new Date()): DeEventSession[] {
  return DE_EVENT_SESSIONS.filter(
    (session) => isPublic(session) && sessionEnd(session).getTime() > now.getTime(),
  ).sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime());
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the start has passed. */
  started: boolean;
}

export function countdownTo(start: Date, now: Date = new Date()): Countdown {
  const diff = start.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, started: true };
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    started: false,
  };
}

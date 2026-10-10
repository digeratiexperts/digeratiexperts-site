/**
 * The DE operating calendar: every recurring and seasonal event DE schedules
 * and preps for, across prospects, clients and the internal team.
 *
 * INTERNAL. This file is never imported by `client/`, so the internal rhythm
 * (all-hands, reviews, tabletop exercises) and client-only events never ship
 * in the public bundle. Public webinars are read from
 * `client/src/data/deEvents.ts`, the single source for the /events pages.
 *
 * Build: `npx tsx scripts/de-events/build.ts` writes the calendar into
 * `docs/marketing/` (Markdown, .ics for Zoho Calendar / Google / Outlook, and
 * an HTML year view). Every time is America/Phoenix.
 *
 * STATUS: everything here is a PROPOSED rhythm until Joe confirms it. Dates
 * marked `confirmDates` depend on an outside body publishing its own dates.
 */

import type { CampaignSlug } from "../../client/src/data/campaigns";

export type Audience = "prospects" | "clients" | "internal";
export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR";

export type Recurrence =
  | { kind: "weekly"; weekday: Weekday }
  /** nth weekday of the month; -1 = last. `months` limits it (quarterly). */
  | { kind: "monthly"; nth: 1 | 2 | 3 | 4 | -1; weekday: Weekday; months?: number[] };

export interface Series {
  id: string;
  title: string;
  audience: Audience;
  cadence: "weekly" | "monthly" | "quarterly";
  recurrence: Recurrence;
  time: string; // "HH:MM" Phoenix
  durationMinutes: number;
  owner: string;
  purpose: string;
  prep: string[];
  /** Existing material to start from (repo path or WorkDrive location). */
  source?: string;
}

export interface Dated {
  id: string;
  title: string;
  audience: Audience | "prospects-and-clients";
  /** "YYYY-MM-DD" all-day, or "YYYY-MM-DDTHH:MM" timed. */
  date: string;
  /** All-day span in days (campaign windows, QBR seasons). */
  days?: number;
  durationMinutes?: number;
  owner: string;
  note: string;
  campaign?: CampaignSlug;
  /** Outside body sets the date — confirm before promoting. */
  confirmDates?: boolean;
  /** A proposed webinar topic that is not yet a session in deEvents.ts. */
  proposedSession?: boolean;
  source?: string;
}

const QUARTER_STARTS = [1, 4, 7, 10];

export const SERIES: Series[] = [
  // ------------------------------------------------------------- weekly
  {
    id: "weekly-huddle",
    title: "Team huddle: week plan, dispatch and blockers",
    audience: "internal",
    cadence: "weekly",
    recurrence: { kind: "weekly", weekday: "MO" },
    time: "08:30",
    durationMinutes: 30,
    owner: "Operations",
    purpose: "Set the week: on-site visits, projects, escalations, who covers what.",
    prep: ["Open ticket queue sorted by SLA", "Calendar of on-site visits", "Carry-over blockers from Friday"],
  },
  {
    id: "weekly-pipeline",
    title: "Pipeline review",
    audience: "internal",
    cadence: "weekly",
    recurrence: { kind: "weekly", weekday: "TU" },
    time: "09:00",
    durationMinutes: 30,
    owner: "Sales",
    purpose: "Move every open deal one step; check event registrants and /go leads got a reply.",
    prep: ["Zoho CRM open deals and new leads", "Event registrations from the past week"],
  },
  {
    id: "weekly-publish",
    title: "Content publish block: one Journal post or LinkedIn piece",
    audience: "prospects",
    cadence: "weekly",
    recurrence: { kind: "weekly", weekday: "WE" },
    time: "10:00",
    durationMinutes: 60,
    owner: "Marketing",
    purpose: "Steady search and social presence that points to the current month's campaign.",
    prep: ["Draft reviewed against docs/CLAIMS-REGISTER.md", "Link to the month's /go page or session"],
  },
  {
    id: "weekly-wrap",
    title: "Week wrap + threat-intel briefing",
    audience: "internal",
    cadence: "weekly",
    recurrence: { kind: "weekly", weekday: "FR" },
    time: "15:00",
    durationMinutes: 30,
    owner: "Technical Office",
    purpose: "Close the week's tickets, review notable advisories, decide what clients need to hear.",
    prep: ["Threat-intel feed highlights (docs/THREAT-INTEL-FEED.md)", "Tickets at risk of breaching SLA"],
  },

  // ------------------------------------------------------------ monthly
  {
    id: "monthly-all-hands",
    title: "All-hands: KPIs, wins, the month ahead",
    audience: "internal",
    cadence: "monthly",
    recurrence: { kind: "monthly", nth: 1, weekday: "MO" },
    time: "09:00",
    durationMinutes: 60,
    owner: "Joe",
    purpose: "One view of the business: tickets, SLA, pipeline, cash, the month's campaign and events.",
    prep: ["Last month's KPI sheet", "This month's campaign and session list (this calendar)"],
  },
  {
    id: "monthly-client-newsletter",
    title: "Client newsletter goes out",
    audience: "clients",
    cadence: "monthly",
    recurrence: { kind: "monthly", nth: 1, weekday: "TH" },
    time: "07:00",
    durationMinutes: 30,
    owner: "Marketing",
    purpose: "The month's security tip, the next session invite, service notices.",
    prep: ["Draft by the prior Monday", "Session invite block", "Reviewed against the claims register"],
    source: "WorkDrive: Newsletter folder and DE printed newsletter PDFs",
  },
  {
    id: "monthly-patch-review",
    title: "Patch Tuesday review and client advisory",
    audience: "clients",
    cadence: "monthly",
    recurrence: { kind: "monthly", nth: 2, weekday: "WE" },
    time: "09:00",
    durationMinutes: 45,
    owner: "Technical Office",
    purpose: "Microsoft ships on the second Tuesday; the day after, decide rings and tell clients what changes.",
    prep: ["Microsoft release notes", "RMM patch-ring status"],
  },
  {
    id: "monthly-prospect-newsletter",
    title: "Prospect newsletter: the month's campaign and next session",
    audience: "prospects",
    cadence: "monthly",
    recurrence: { kind: "monthly", nth: 2, weekday: "TH" },
    time: "07:00",
    durationMinutes: 30,
    owner: "Marketing",
    purpose: "One idea, one link to the month's /go page, one session invite.",
    prep: ["Campaign page link", "Session registration link"],
  },
  {
    id: "monthly-lunch-learn",
    title: "Lunch & learn (internal training)",
    audience: "internal",
    cadence: "monthly",
    recurrence: { kind: "monthly", nth: 3, weekday: "WE" },
    time: "12:00",
    durationMinutes: 60,
    owner: "Technical Office",
    purpose: "One tool, process or threat, taught by a team member. Doubles as a rehearsal for the month's webinar.",
    prep: ["Presenter picked at the all-hands", "Slides or a live demo"],
    source: "WorkDrive: Lunch & Learn folder (2012) and attendee-survey templates",
  },
  {
    id: "monthly-office-hours",
    title: "Client office hours: Ask DE Live",
    audience: "clients",
    cadence: "monthly",
    recurrence: { kind: "monthly", nth: 3, weekday: "TH" },
    time: "12:00",
    durationMinutes: 30,
    owner: "Technical Office",
    purpose: "An open half hour for client questions: no agenda, no sales.",
    prep: ["Meeting link in the client newsletter", "Questions submitted in the portal"],
  },
  {
    id: "monthly-close",
    title: "Month-end close and client reporting",
    audience: "internal",
    cadence: "monthly",
    recurrence: { kind: "monthly", nth: -1, weekday: "FR" },
    time: "13:00",
    durationMinutes: 120,
    owner: "Back Office",
    purpose: "Invoices, license true-ups, client monthly reports out.",
    prep: ["Zoho Books open items", "License counts from the vendor portals"],
  },

  // ---------------------------------------------------------- quarterly
  {
    id: "quarterly-planning",
    title: "Quarterly planning: goals, campaigns and events for the quarter",
    audience: "internal",
    cadence: "quarterly",
    recurrence: { kind: "monthly", nth: 2, weekday: "FR", months: QUARTER_STARTS },
    time: "09:00",
    durationMinutes: 180,
    owner: "Joe",
    purpose: "Confirm next quarter's sessions (flip them to confirmed in deEvents.ts) and assign owners.",
    prep: ["This calendar", "Last quarter's registrations and conversions"],
    source: "WorkDrive: Quarterly Marketing Planning Slide Deck; 4. Event & Strategic Planning",
  },
  {
    id: "quarterly-restore-test",
    title: "Quarterly backup restore test (clients and DE)",
    audience: "clients",
    cadence: "quarterly",
    recurrence: { kind: "monthly", nth: 2, weekday: "TH", months: [3, 6, 9, 12] },
    time: "08:00",
    durationMinutes: 240,
    owner: "Technical Office",
    purpose: "Restore a file and a system for each managed client; record the result for QBRs and insurance renewals.",
    prep: ["Restore-test checklist", "Evidence template for the QBR pack"],
  },
  {
    id: "quarterly-tabletop",
    title: "Incident-response tabletop exercise",
    audience: "internal",
    cadence: "quarterly",
    recurrence: { kind: "monthly", nth: 3, weekday: "TU", months: [2, 5, 8, 11] },
    time: "14:00",
    durationMinutes: 90,
    owner: "Technical Office",
    purpose: "Walk one scenario end to end: who calls whom, what gets isolated, what the client hears.",
    prep: ["Scenario card", "Current escalation contacts"],
  },
];

function qbrSeason(year: number, month: number): Dated {
  const mm = String(month).padStart(2, "0");
  return {
    id: `qbr-${year}-${mm}`,
    title: `QBR season (Q${QUARTER_STARTS.indexOf(month) + 1} business reviews)`,
    audience: "clients",
    date: `${year}-${mm}-05`,
    days: 19,
    owner: "Account management",
    note: "Book every managed client's review; prep the pack two weeks ahead (tickets, risk, restore-test evidence, roadmap).",
    source: "Portal /portal/qbr; WorkDrive: QBR Campaign E-mails, QBR Campaign Blueprint, S9 QBR Agenda Template",
  };
}

export const DATED: Dated[] = [
  // ---------------------------------------------------------------- 2026 Q4
  {
    id: "csam-2026",
    title: "Cybersecurity Awareness Month",
    audience: "prospects-and-clients",
    date: "2026-10-01",
    days: 31,
    owner: "Marketing",
    note: "October, every year (CISA / National Cybersecurity Alliance). Weekly tips to clients; insurance-readiness push to prospects.",
    campaign: "cyber-insurance",
    source: "WorkDrive: Cybersecurity Awareness Month 2021/2022 assets (vendor content — rewrite before reuse)",
  },
  qbrSeason(2026, 10),
  {
    id: "client-survey-2026",
    title: "Annual client satisfaction survey sent",
    audience: "clients",
    date: "2026-11-02",
    owner: "Account management",
    note: "Portal satisfaction survey; results feed the January planning kickoff.",
    source: "Portal satisfaction survey (PortalSatisfactionSurvey)",
  },
  {
    id: "license-audit-2026",
    title: "Annual license and renewal audit",
    audience: "clients",
    date: "2026-11-09",
    days: 5,
    owner: "Back Office",
    note: "Every client's licenses, warranties and domain renewals expiring in the next 12 months, ready for year-end budget talks.",
  },
  {
    id: "thanks-2026",
    title: "Client appreciation: Thanksgiving thank-you cards mailed",
    audience: "clients",
    date: "2026-11-16",
    owner: "Marketing",
    note: "Handwritten, no offer inside.",
  },
  {
    id: "holiday-shopping-advisory-2026",
    title: "Holiday shopping-scam advisory to clients",
    audience: "clients",
    date: "2026-11-24",
    owner: "Technical Office",
    note: "Before Black Friday / Cyber Monday: delivery-notice and gift-card scams.",
    campaign: "email-security",
  },
  {
    id: "holiday-schedule-2026",
    title: "Holiday support schedule sent to clients",
    audience: "clients",
    date: "2026-12-01",
    owner: "Operations",
    note: "Coverage and escalation for the holidays.",
  },
  {
    id: "budget-2027",
    title: "Year-end budget and 2027 roadmap conversations",
    audience: "clients",
    date: "2026-12-01",
    days: 18,
    owner: "Account management",
    note: "Use the license audit and QBR roadmaps; the prospect equivalent is the ProActive Business offer.",
    campaign: "proactive-business",
  },
  {
    id: "reviews-2026",
    title: "Annual performance reviews",
    audience: "internal",
    date: "2026-12-07",
    days: 12,
    owner: "Joe",
    note: "One-to-ones; training goals set for the year.",
  },
  {
    id: "policy-review-2026",
    title: "Annual policy, DR plan and vendor review (DE's own)",
    audience: "internal",
    date: "2026-12-14",
    days: 5,
    owner: "Back Office",
    note: "Re-read and re-sign internal policies; test DE's own recovery plan.",
  },
  {
    id: "celebration-2026",
    title: "Year-end team celebration",
    audience: "internal",
    date: "2026-12-17T17:30",
    durationMinutes: 180,
    owner: "Joe",
    note: "",
  },

  // ---------------------------------------------------------------- 2027 Q1
  {
    id: "kickoff-2027",
    title: "Annual planning kickoff",
    audience: "internal",
    date: "2027-01-05T09:00",
    durationMinutes: 240,
    owner: "Joe",
    note: "Set the year's goals; confirm Q1 sessions and owners; review survey results.",
    source: "WorkDrive: Company Strategy & Frameworks; 2024 Business Planning; Digerati_Experts_Marketing_Calendar.docx",
  },
  {
    id: "awareness-training-2027",
    title: "Annual staff security awareness training and policy acknowledgment",
    audience: "internal",
    date: "2027-01-11",
    days: 12,
    owner: "Technical Office",
    note: "Every DE employee completes training and signs the acceptable-use and security policies. Offer the same to clients on awareness plans.",
  },
  qbrSeason(2027, 1),
  {
    id: "privacy-day-2027",
    title: "Data Privacy Day",
    audience: "prospects-and-clients",
    date: "2027-01-28",
    owner: "Marketing",
    note: "January 28 every year. Client newsletter tip and one Journal post.",
  },
  {
    id: "sid-2027",
    title: "Safer Internet Day",
    audience: "clients",
    date: "2027-02-09",
    owner: "Marketing",
    note: "Second week of February; confirm the date. A family-and-staff safety tip for client newsletters.",
    confirmDates: true,
  },
  {
    id: "backup-day-2027",
    title: "World Backup Day",
    audience: "prospects-and-clients",
    date: "2027-03-31",
    owner: "Marketing",
    note: "March 31 every year; the live restore drill session runs that day.",
    campaign: "ransomware-readiness",
  },

  // ---------------------------------------------------------------- 2027 Q2
  {
    id: "tax-fraud-2027",
    title: "Tax-season fraud advisory (IRS and payroll impersonation)",
    audience: "prospects-and-clients",
    date: "2027-04-01",
    owner: "Technical Office",
    note: "Before the April 15 deadline: W-2 requests, direct-deposit changes, fake IRS notices.",
    campaign: "email-security",
  },
  qbrSeason(2027, 4),
  {
    id: "healthcare-webinar-2027",
    title: "Webinar (proposed): HIPAA security risk analysis for Arizona practices",
    audience: "prospects",
    date: "2027-04-22T11:00",
    durationMinutes: 60,
    owner: "Marketing",
    note: "Topic proposal; add to deEvents.ts once confirmed.",
    campaign: "healthcare-it",
    proposedSession: true,
  },
  {
    id: "nsbw-2027",
    title: "National Small Business Week",
    audience: "prospects",
    date: "2027-05-02",
    days: 7,
    owner: "Marketing",
    note: "SBA sets the dates each year (usually late April or early May); confirm. Assessment push to owners.",
    campaign: "cyber-risk-assessment",
    confirmDates: true,
  },
  {
    id: "assessment-webinar-2027",
    title: "Webinar (proposed): What a Cyber Risk Assessment actually looks at",
    audience: "prospects",
    date: "2027-05-20T11:00",
    durationMinutes: 45,
    owner: "Marketing",
    note: "Topic proposal; ties to National Small Business Week follow-up.",
    campaign: "cyber-risk-assessment",
    proposedSession: true,
  },
  {
    id: "referral-2027",
    title: "Mid-year client referral push",
    audience: "clients",
    date: "2027-05-03",
    days: 26,
    owner: "Marketing",
    note: "A newsletter feature and a QBR-follow-up ask.",
  },
  {
    id: "managed-it-webinar-2027",
    title: "Webinar (proposed): Managed IT without the mystery — what ProActive covers",
    audience: "prospects",
    date: "2027-06-24T11:00",
    durationMinutes: 45,
    owner: "Marketing",
    note: "Topic proposal.",
    campaign: "managed-it",
    proposedSession: true,
  },
  {
    id: "midyear-2027",
    title: "Mid-year review",
    audience: "internal",
    date: "2027-06-28T09:00",
    durationMinutes: 180,
    owner: "Joe",
    note: "Goals against plan; reset H2 campaigns.",
  },

  // ---------------------------------------------------------------- 2027 Q3
  qbrSeason(2027, 7),
  {
    id: "mfa-webinar-2027",
    title: "Webinar (proposed): MFA everywhere — closing the logins attackers try first",
    audience: "prospects",
    date: "2027-08-26T11:00",
    durationMinutes: 45,
    owner: "Marketing",
    note: "Topic proposal; back-to-school timing for password and MFA refreshes.",
    campaign: "cyber-risk-assessment",
    proposedSession: true,
  },
  {
    id: "preparedness-2027",
    title: "National Preparedness Month",
    audience: "prospects-and-clients",
    date: "2027-09-01",
    days: 30,
    owner: "Marketing",
    note: "September every year (FEMA / Ready.gov). Business-continuity and backup messaging.",
    campaign: "ransomware-readiness",
  },
  {
    id: "insurance-webinar-2027",
    title: "Webinar (proposed): Q4 cyber insurance renewal readiness",
    audience: "prospects-and-clients",
    date: "2027-09-23T11:00",
    durationMinutes: 60,
    owner: "Marketing",
    note: "Repeat of the October 2026 session, updated with what renewals asked this year.",
    campaign: "cyber-insurance",
    proposedSession: true,
  },

  // ---------------------------------------------------------------- 2027 Q4
  {
    id: "csam-2027",
    title: "Cybersecurity Awareness Month",
    audience: "prospects-and-clients",
    date: "2027-10-01",
    days: 31,
    owner: "Marketing",
    note: "October, every year.",
    campaign: "cyber-insurance",
  },
  qbrSeason(2027, 10),
  {
    id: "halloween-webinar-2027",
    title: "Webinar (proposed): Halloween cyber horror stories",
    audience: "prospects-and-clients",
    date: "2027-10-28T11:00",
    durationMinutes: 45,
    owner: "Marketing",
    note: "Reuse the 2023 Halloween campaign kit (email invites, call script, postcard).",
    campaign: "email-security",
    proposedSession: true,
    source: "WorkDrive: Halloween Cybersecurity Webinar campaign kit (2023)",
  },
  {
    id: "client-survey-2027",
    title: "Annual client satisfaction survey sent",
    audience: "clients",
    date: "2027-11-01",
    owner: "Account management",
    note: "",
  },
  {
    id: "license-audit-2027",
    title: "Annual license and renewal audit",
    audience: "clients",
    date: "2027-11-08",
    days: 5,
    owner: "Back Office",
    note: "",
  },
  {
    id: "holiday-fraud-webinar-2027",
    title: "Webinar (proposed): Holiday invoice fraud, 2027 edition",
    audience: "prospects-and-clients",
    date: "2027-11-18T11:00",
    durationMinutes: 45,
    owner: "Marketing",
    note: "",
    campaign: "email-security",
    proposedSession: true,
  },
  {
    id: "thanks-2027",
    title: "Client appreciation: Thanksgiving thank-you cards mailed",
    audience: "clients",
    date: "2027-11-15",
    owner: "Marketing",
    note: "",
  },
  {
    id: "budget-2028",
    title: "Year-end budget and 2028 roadmap conversations",
    audience: "clients",
    date: "2027-12-01",
    days: 17,
    owner: "Account management",
    note: "",
    campaign: "proactive-business",
  },
  {
    id: "reviews-2027",
    title: "Annual performance reviews",
    audience: "internal",
    date: "2027-12-06",
    days: 12,
    owner: "Joe",
    note: "",
  },
  {
    id: "celebration-2027",
    title: "Year-end team celebration",
    audience: "internal",
    date: "2027-12-16T17:30",
    durationMinutes: 180,
    owner: "Joe",
    note: "",
  },
];

/**
 * Prep milestones for a live session, counted back from its date. A webinar
 * needs about five weeks: topic and page, invites, reminders, then follow-up.
 */
export const SESSION_PREP: { offsetDays: number; task: string }[] = [
  { offsetDays: -35, task: "Confirm topic, presenter and platform; flip the session to confirmed; page live" },
  { offsetDays: -28, task: "First invite: client and prospect newsletters, LinkedIn, call list" },
  { offsetDays: -14, task: "Second invite; dry run at the lunch & learn" },
  { offsetDays: -7, task: "Reminder to registrants; final slides" },
  { offsetDays: -1, task: "Day-before reminder with the join link" },
  { offsetDays: 2, task: "Follow-up: recording, slides, assessment offer; log attendance in CRM" },
];

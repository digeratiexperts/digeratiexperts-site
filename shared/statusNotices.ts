import { z } from "zod";

/**
 * System Status notices (migrations/0021_portal_status_notices.sql).
 *
 * DE staff post incidents, maintenance windows and general notices, either for
 * one client company or for every client (clientId null). Clients see what
 * applies to them on /portal/status and as a status line on Home. There is no
 * device health here: no RMM integration exists yet, and the page never shows
 * invented health data (docs/plans/opencode/lane-d-status-shipping.md).
 */

export const NOTICE_KINDS = ["incident", "maintenance", "notice"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export const NOTICE_SEVERITIES = ["info", "degraded", "outage"] as const;
export type NoticeSeverity = (typeof NOTICE_SEVERITIES)[number];

export const KIND_LABELS: Record<NoticeKind, string> = {
  incident: "Incident",
  maintenance: "Maintenance",
  notice: "Notice",
};

export const SEVERITY_LABELS: Record<NoticeSeverity, string> = {
  info: "No impact",
  degraded: "Degraded",
  outage: "Outage",
};

export type NoticeUpdate = { at: string; byName: string; body: string };

export type StatusNotice = {
  id: string;
  /** null = shown to every client company. */
  clientId: string | null;
  kind: NoticeKind;
  severity: NoticeSeverity;
  title: string;
  body: string;
  affectedServices: string[];
  startsAt: string;
  /** Maintenance: planned end. Incident: expected recovery, if known. */
  endsAt: string | null;
  resolvedAt: string | null;
  updates: NoticeUpdate[];
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

export type OverallState = "operational" | "maintenance" | "degraded" | "outage";

export const OVERALL_LABELS: Record<OverallState, string> = {
  operational: "No known issues",
  maintenance: "Maintenance in progress",
  degraded: "Some services degraded",
  outage: "Service outage",
};

export type StatusView = {
  company: { id: string; name: string } | null;
  overall: OverallState;
  /** Incidents and notices that have started and are not resolved. */
  active: StatusNotice[];
  /** Maintenance that is in progress now. */
  inProgress: StatusNotice[];
  /** Maintenance that starts later. */
  upcoming: StatusNotice[];
  /** Resolved or finished in the last HISTORY_DAYS days, newest first. */
  history: StatusNotice[];
};

export const HISTORY_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const iso = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Use a valid date and time");

export const noticeInputSchema = z
  .object({
    clientId: z.string().trim().min(1).max(80).nullable(),
    kind: z.enum(NOTICE_KINDS),
    severity: z.enum(NOTICE_SEVERITIES),
    title: z.string().trim().min(1, "Title is required").max(160),
    body: z.string().trim().max(4000).default(""),
    affectedServices: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    startsAt: iso,
    endsAt: iso.nullable().default(null),
  })
  .refine((v) => !v.endsAt || Date.parse(v.endsAt) >= Date.parse(v.startsAt), {
    message: "The end must be after the start",
    path: ["endsAt"],
  })
  .refine((v) => v.kind !== "maintenance" || Boolean(v.endsAt), {
    message: "Maintenance needs a planned end",
    path: ["endsAt"],
  });
export type NoticeInput = z.infer<typeof noticeInputSchema>;

export const noticeUpdateSchema = z.object({
  body: z.string().trim().min(1, "Write the update").max(4000),
  resolve: z.boolean().default(false),
});

/** Which list a notice belongs in at `now`, or null when it is too old to show. */
export function placeNotice(n: StatusNotice, now: Date): keyof Omit<StatusView, "company" | "overall"> | null {
  const t = now.getTime();
  const starts = Date.parse(n.startsAt);
  const ends = n.endsAt ? Date.parse(n.endsAt) : null;
  const resolved = n.resolvedAt ? Date.parse(n.resolvedAt) : null;
  const finishedAt = resolved ?? (n.kind === "maintenance" && ends !== null && ends <= t ? ends : null);
  if (finishedAt !== null) return t - finishedAt <= HISTORY_DAYS * DAY_MS ? "history" : null;
  if (n.kind === "maintenance") return starts > t ? "upcoming" : "inProgress";
  // An incident or notice posted ahead of its start time waits until it starts.
  return starts > t ? "upcoming" : "active";
}

/** Group notices for one viewer and derive the overall line. */
export function buildStatusView(notices: StatusNotice[], now: Date, company: StatusView["company"]): StatusView {
  const view: StatusView = { company, overall: "operational", active: [], inProgress: [], upcoming: [], history: [] };
  for (const n of notices) {
    const slot = placeNotice(n, now);
    if (slot) view[slot].push(n);
  }
  const byStart = (a: StatusNotice, b: StatusNotice) => Date.parse(a.startsAt) - Date.parse(b.startsAt);
  const finished = (n: StatusNotice) => Date.parse(n.resolvedAt ?? n.endsAt ?? n.startsAt);
  view.active.sort((a, b) => -byStart(a, b));
  view.inProgress.sort(byStart);
  view.upcoming.sort(byStart);
  view.history.sort((a, b) => finished(b) - finished(a));

  const live = [...view.active, ...view.inProgress];
  if (live.some((n) => n.severity === "outage")) view.overall = "outage";
  else if (live.some((n) => n.severity === "degraded")) view.overall = "degraded";
  else if (view.inProgress.length > 0) view.overall = "maintenance";
  return view;
}

import { z } from "zod";
import { QUARTER_RE } from "./roadmap";

/**
 * Business reviews (migrations/0023_portal_business_reviews.sql).
 *
 * DE writes one per client meeting: the date, a summary, the decisions taken,
 * the roadmap items discussed and the report PDF (a file already shared with
 * the company). Owners see published reviews on /portal/qbr
 * (docs/plans/opencode/lane-c-planning.md). Drafts stay DE-only.
 */

export const REVIEW_STATUSES = ["draft", "published"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export type BusinessReview = {
  id: string;
  clientId: string;
  title: string;
  /** "2026-Q3", or null when the review isn't tied to a quarter. */
  period: string | null;
  /** The meeting day, YYYY-MM-DD. */
  meetingOn: string;
  status: ReviewStatus;
  summary: string;
  decisions: string[];
  roadmapItemIds: string[];
  /** A tenant file of the same company (Files & Downloads). */
  fileId: string | null;
  createdByName: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** What a client sees: links resolved, nothing from another company. */
export type ClientBusinessReview = Omit<BusinessReview, "clientId" | "roadmapItemIds" | "fileId" | "status"> & {
  roadmapItems: Array<{ id: string; title: string; status: string }>;
  report: { fileName: string; url: string } | null;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const reviewInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  period: z
    .string()
    .trim()
    .regex(QUARTER_RE, "Use a quarter like 2026-Q3")
    .nullable()
    .default(null),
  meetingOn: z
    .string()
    .trim()
    .regex(DAY_RE, "Use the meeting date")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Use a real date"),
  status: z.enum(REVIEW_STATUSES).default("draft"),
  summary: z.string().trim().max(8000).default(""),
  decisions: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  roadmapItemIds: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  fileId: z.string().trim().min(1).max(80).nullable().default(null),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

/** Newest meeting first. */
export const sortReviews = <T extends Pick<BusinessReview, "meetingOn" | "createdAt">>(list: T[]): T[] =>
  [...list].sort((a, b) => b.meetingOn.localeCompare(a.meetingOn) || b.createdAt.localeCompare(a.createdAt));

export const formatMeetingDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

import { z } from "zod";

/**
 * IT Roadmap items (migrations/0022_portal_roadmap_items.sql).
 *
 * DE writes a roadmap per client company: what to do, why it matters, how
 * urgent, which quarter and roughly what it costs. The company's owners see
 * it on /portal/roadmap, comment, and approve or decline proposed items
 * (docs/plans/opencode/lane-c-planning.md). Every figure on the page comes from
 * these rows; there are no illustrative numbers.
 */

export const ROADMAP_CATEGORIES = ["security", "infrastructure", "productivity", "compliance"] as const;
export type RoadmapCategory = (typeof ROADMAP_CATEGORIES)[number];

export const ROADMAP_PRIORITIES = ["high", "medium", "low"] as const;
export type RoadmapPriority = (typeof ROADMAP_PRIORITIES)[number];

/** proposed → approved | declined (owner); approved → in_progress → done (DE). */
export const ROADMAP_STATUSES = ["proposed", "approved", "in_progress", "done", "declined"] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export const CATEGORY_LABELS: Record<RoadmapCategory, string> = {
  security: "Security",
  infrastructure: "Infrastructure",
  productivity: "Productivity",
  compliance: "Compliance",
};
export const PRIORITY_LABELS: Record<RoadmapPriority, string> = { high: "High", medium: "Medium", low: "Low" };
export const STATUS_LABELS: Record<RoadmapStatus, string> = {
  proposed: "Waiting for your decision",
  approved: "Approved",
  in_progress: "In progress",
  done: "Done",
  declined: "Declined",
};

export type RoadmapComment = { at: string; byName: string; fromDe: boolean; body: string };

export type RoadmapItem = {
  id: string;
  clientId: string;
  title: string;
  rationale: string;
  category: RoadmapCategory;
  priority: RoadmapPriority;
  /** "2027-Q1" */
  targetQuarter: string;
  /** Whole dollars; a range when low < high, a single figure when equal. Null = not estimated. */
  estimateLow: number | null;
  estimateHigh: number | null;
  /** One-off project cost or a recurring yearly cost. */
  costBasis: "one_time" | "yearly";
  status: RoadmapStatus;
  decisionNote: string;
  decidedByName: string | null;
  decidedAt: string | null;
  comments: RoadmapComment[];
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

export const QUARTER_RE = /^20\d{2}-Q[1-4]$/;

export const formatQuarter = (q: string) => (QUARTER_RE.test(q) ? `${q.slice(5)} ${q.slice(0, 4)}` : q);

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
export function formatEstimate(item: Pick<RoadmapItem, "estimateLow" | "estimateHigh" | "costBasis">): string | null {
  const { estimateLow: lo, estimateHigh: hi } = item;
  if (lo == null && hi == null) return null;
  const a = lo ?? hi!;
  const b = hi ?? lo!;
  const span = a === b ? money(a) : `${money(a)} to ${money(b)}`;
  return item.costBasis === "yearly" ? `${span} a year` : span;
}

const dollars = z.number().int().min(0).max(10_000_000).nullable();

export const roadmapItemInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(160),
    rationale: z.string().trim().max(4000).default(""),
    category: z.enum(ROADMAP_CATEGORIES),
    priority: z.enum(ROADMAP_PRIORITIES),
    targetQuarter: z.string().trim().regex(QUARTER_RE, "Use a quarter like 2027-Q1"),
    estimateLow: dollars.default(null),
    estimateHigh: dollars.default(null),
    costBasis: z.enum(["one_time", "yearly"]).default("one_time"),
    status: z.enum(ROADMAP_STATUSES).default("proposed"),
  })
  .refine((v) => v.estimateLow == null || v.estimateHigh == null || v.estimateLow <= v.estimateHigh, {
    message: "The low estimate must not be above the high one",
    path: ["estimateHigh"],
  });
export type RoadmapItemInput = z.infer<typeof roadmapItemInputSchema>;

export const roadmapDecisionSchema = z.object({
  decision: z.enum(["approved", "declined"]),
  note: z.string().trim().max(2000).default(""),
});

export const roadmapCommentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment").max(2000),
});

export type RoadmapSummary = {
  counts: Record<RoadmapStatus, number>;
  /** Sums of the low and high estimates of approved and in-progress items, per cost basis. */
  committed: { oneTimeLow: number; oneTimeHigh: number; yearlyLow: number; yearlyHigh: number };
};

export function summarizeRoadmap(items: RoadmapItem[]): RoadmapSummary {
  const counts = Object.fromEntries(ROADMAP_STATUSES.map((s) => [s, 0])) as Record<RoadmapStatus, number>;
  const committed = { oneTimeLow: 0, oneTimeHigh: 0, yearlyLow: 0, yearlyHigh: 0 };
  for (const i of items) {
    counts[i.status] += 1;
    if (i.status !== "approved" && i.status !== "in_progress") continue;
    const lo = i.estimateLow ?? i.estimateHigh ?? 0;
    const hi = i.estimateHigh ?? i.estimateLow ?? 0;
    if (i.costBasis === "yearly") {
      committed.yearlyLow += lo;
      committed.yearlyHigh += hi;
    } else {
      committed.oneTimeLow += lo;
      committed.oneTimeHigh += hi;
    }
  }
  return { counts, committed };
}

/** Order for the page: by quarter, then priority, then title. */
export function sortRoadmap(items: RoadmapItem[]): RoadmapItem[] {
  const pr: Record<RoadmapPriority, number> = { high: 0, medium: 1, low: 2 };
  return [...items].sort(
    (a, b) => a.targetQuarter.localeCompare(b.targetQuarter) || pr[a.priority] - pr[b.priority] || a.title.localeCompare(b.title),
  );
}

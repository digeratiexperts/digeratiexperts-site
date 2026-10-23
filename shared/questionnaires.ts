import { z } from "zod";

/**
 * DE Questionnaires (migrations/0024_portal_questionnaire_assignments.sql).
 *
 * DE assigns one of the portal surveys (server/portalSurveyStore.ts: the
 * questions and answer validation) to a person at a client company with a due
 * date. The person saves a draft and submits; DE reviews. Answers live on the
 * assignment, so the same questionnaire can be assigned again next year
 * (docs/plans/opencode/lane-c-planning.md: "build on Surveys").
 */

export const ASSIGNMENT_STATUSES = ["assigned", "draft", "submitted", "reviewed"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  assigned: "Not started",
  draft: "Draft saved",
  submitted: "Submitted",
  reviewed: "Reviewed by DE",
};

export type QuestionnaireAssignment = {
  id: string;
  clientId: string;
  surveyId: string;
  assignedToUserId: string;
  /** YYYY-MM-DD */
  dueOn: string;
  status: AssignmentStatus;
  note: string;
  answers: Record<string, unknown>;
  assignedByName: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const day = z
  .string()
  .trim()
  .regex(DAY_RE, "Use a date")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Use a real date");

export const assignInputSchema = z.object({
  clientId: z.string().trim().min(1, "Choose a company").max(80),
  surveyId: z.string().trim().min(1, "Choose a questionnaire").max(80),
  assignedToUserId: z.string().trim().min(1, "Choose who fills it in").max(80),
  dueOn: day,
  note: z.string().trim().max(2000).default(""),
});

export const assignmentEditSchema = z.object({
  dueOn: day.optional(),
  note: z.string().trim().max(2000).optional(),
  /** DE marks a submission reviewed, or sends it back to the person as a draft. */
  status: z.enum(["reviewed", "draft"]).optional(),
});

export const answersSchema = z.object({
  answers: z.record(z.string(), z.unknown()).refine((a) => Object.keys(a).length <= 100, "Too many answers"),
});

/** Overdue = due before today and not yet submitted. */
export function isOverdue(a: Pick<QuestionnaireAssignment, "dueOn" | "status">, today: string): boolean {
  return (a.status === "assigned" || a.status === "draft") && a.dueOn < today;
}

export const todayUtc = (now: Date) => now.toISOString().slice(0, 10);

export const formatDueDay = (dayStr: string) =>
  new Date(`${dayStr}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

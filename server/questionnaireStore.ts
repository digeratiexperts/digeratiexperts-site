import { randomUUID } from "crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { portalQuestionnaireAssignments } from "@shared/schema";
import type { AssignmentStatus, QuestionnaireAssignment } from "@shared/questionnaires";

/**
 * Questionnaire assignments. Postgres when the database is up
 * (migrations/0024_portal_questionnaire_assignments.sql, verified not
 * created); memory otherwise.
 */

const useDb = () => Boolean(dbReady && db);
const mem = new Map<string, QuestionnaireAssignment>();

export function _resetQuestionnaireMemory() {
  mem.clear();
}

let verified = false;
async function ensureSchema() {
  if (verified || !useDb()) return;
  try {
    const result: any = await db.execute(sql`SELECT to_regclass('public.portal_questionnaire_assignments') AS present`);
    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (row && !row.present) {
      console.error("[questionnaires] table portal_questionnaire_assignments is missing; run `npm run db:migrate` (migrations/0024_portal_questionnaire_assignments.sql).");
      return;
    }
    verified = true;
  } catch (error: any) {
    console.warn("[questionnaires] could not verify tables:", error?.message || error);
  }
}

const toIso = (v: unknown): string | null => (v ? new Date(v as string | Date).toISOString() : null);
const toDay = (v: unknown): string => (typeof v === "string" ? v.slice(0, 10) : new Date(v as Date).toISOString().slice(0, 10));

function fromRow(row: any): QuestionnaireAssignment {
  return {
    id: row.id,
    clientId: row.clientId,
    surveyId: row.surveyId,
    assignedToUserId: row.assignedToUserId,
    dueOn: toDay(row.dueOn),
    status: row.status,
    note: row.note ?? "",
    answers: row.answers && typeof row.answers === "object" && !Array.isArray(row.answers) ? row.answers : {},
    assignedByName: row.assignedByName ?? "",
    submittedAt: toIso(row.submittedAt),
    reviewedAt: toIso(row.reviewedAt),
    reviewedByName: row.reviewedByName ?? null,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
  };
}

const byDue = (a: QuestionnaireAssignment, b: QuestionnaireAssignment) => a.dueOn.localeCompare(b.dueOn) || a.createdAt.localeCompare(b.createdAt);

/** A person's own assignments, at their company only. */
export async function listForUser(clientId: string, userId: string): Promise<QuestionnaireAssignment[]> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db
      .select()
      .from(portalQuestionnaireAssignments)
      .where(and(eq(portalQuestionnaireAssignments.clientId, clientId), eq(portalQuestionnaireAssignments.assignedToUserId, userId)))
      .orderBy(asc(portalQuestionnaireAssignments.dueOn));
    return rows.map(fromRow);
  }
  return [...mem.values()].filter((a) => a.clientId === clientId && a.assignedToUserId === userId).sort(byDue);
}

export async function listAll(): Promise<QuestionnaireAssignment[]> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db.select().from(portalQuestionnaireAssignments).orderBy(asc(portalQuestionnaireAssignments.dueOn)).limit(2000);
    return rows.map(fromRow);
  }
  return [...mem.values()].sort(byDue);
}

export async function getAssignment(id: string): Promise<QuestionnaireAssignment | null> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db.select().from(portalQuestionnaireAssignments).where(eq(portalQuestionnaireAssignments.id, id)).limit(1);
    return row ? fromRow(row) : null;
  }
  return mem.get(id) ?? null;
}

export async function createAssignment(
  input: { clientId: string; surveyId: string; assignedToUserId: string; dueOn: string; note: string },
  by: { id: string; name: string },
  now: Date,
): Promise<QuestionnaireAssignment> {
  await ensureSchema();
  const values = {
    ...input,
    status: "assigned" as AssignmentStatus,
    answers: {},
    assignedBy: by.id,
    assignedByName: by.name,
    submittedAt: null,
    reviewedAt: null,
    reviewedByName: null,
    createdAt: now,
    updatedAt: now,
  };
  if (useDb()) {
    const [row] = await db.insert(portalQuestionnaireAssignments).values(values).returning();
    return fromRow(row);
  }
  const a = fromRow({ ...values, id: randomUUID() });
  mem.set(a.id, a);
  return a;
}

export type AssignmentPatch = Partial<Pick<QuestionnaireAssignment, "dueOn" | "note" | "status" | "answers" | "submittedAt" | "reviewedAt" | "reviewedByName">>;

export async function updateAssignment(id: string, patch: AssignmentPatch, now: Date): Promise<QuestionnaireAssignment | null> {
  const current = await getAssignment(id);
  if (!current) return null;
  const next: QuestionnaireAssignment = {
    ...current,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    updatedAt: now.toISOString(),
  } as QuestionnaireAssignment;
  if (useDb()) {
    const [row] = await db
      .update(portalQuestionnaireAssignments)
      .set({
        dueOn: next.dueOn,
        note: next.note,
        status: next.status,
        answers: next.answers,
        submittedAt: next.submittedAt ? new Date(next.submittedAt) : null,
        reviewedAt: next.reviewedAt ? new Date(next.reviewedAt) : null,
        reviewedByName: next.reviewedByName,
        updatedAt: now,
      })
      .where(eq(portalQuestionnaireAssignments.id, id))
      .returning();
    return row ? fromRow(row) : null;
  }
  mem.set(id, next);
  return next;
}

export async function deleteAssignment(id: string): Promise<boolean> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db.delete(portalQuestionnaireAssignments).where(eq(portalQuestionnaireAssignments.id, id)).returning({ id: portalQuestionnaireAssignments.id });
    return rows.length > 0;
  }
  return mem.delete(id);
}

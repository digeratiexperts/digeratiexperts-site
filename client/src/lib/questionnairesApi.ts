import { portalFetch } from "@/lib/portalApi";
import type { AssignmentStatus } from "@shared/questionnaires";

/** Client calls for DE Questionnaires (server/questionnaireRoutes.ts). */

export type Question = { id: string; type: "rating" | "text" | "single" | "multi"; label: string; required: boolean; options?: string[]; helpText?: string };
export type MyQuestionnaire = {
  id: string;
  surveyId: string;
  title: string;
  description: string;
  questionCount: number;
  dueOn: string;
  status: AssignmentStatus;
  overdue: boolean;
  note: string;
  submittedAt: string | null;
  reviewedAt: string | null;
};
export type AdminAssignment = MyQuestionnaire & {
  clientId: string;
  companyName: string;
  assignedToUserId: string;
  assignedToName: string;
  assignedByName: string;
  reviewedByName: string | null;
};

export class QuestionnaireApiError extends Error {
  constructor(message: string, public status: number, public fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}
async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await portalFetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new QuestionnaireApiError(body.error || `Request failed (${res.status})`, res.status, body.fieldErrors || {});
  return body as T;
}
const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });

export const MY_QUESTIONNAIRES_KEY = ["/api/portal/questionnaires/mine"] as const;
export const ADMIN_QUESTIONNAIRES_KEY = ["/api/portal/admin/questionnaires"] as const;

export const questionnairesApi = {
  mine: () => request<{ questionnaires: MyQuestionnaire[]; openCount: number }>("/api/portal/questionnaires/mine"),
  open: (id: string) => request<{ questionnaire: MyQuestionnaire & { questions: Question[]; answers: Record<string, unknown> } }>(`/api/portal/questionnaires/mine/${encodeURIComponent(id)}`),
  saveDraft: (id: string, answers: Record<string, unknown>) => request<{ status: AssignmentStatus }>(`/api/portal/questionnaires/mine/${encodeURIComponent(id)}/draft`, json("POST", { answers })),
  submit: (id: string, answers: Record<string, unknown>) => request<{ status: AssignmentStatus }>(`/api/portal/questionnaires/mine/${encodeURIComponent(id)}/submit`, json("POST", { answers })),
  adminList: () => request<{ today: string; assignments: AdminAssignment[] }>("/api/portal/admin/questionnaires"),
  options: () => request<{ surveys: Array<{ id: string; title: string; category: string; questionCount: number }> }>("/api/portal/admin/questionnaires/options"),
  people: (companyId: string) => request<{ people: Array<{ id: string; name: string; email: string }> }>(`/api/portal/admin/questionnaires/people/${encodeURIComponent(companyId)}`),
  adminGet: (id: string) => request<{ assignment: AdminAssignment & { questions: Question[]; answers: Record<string, unknown> } }>(`/api/portal/admin/questionnaires/${encodeURIComponent(id)}`),
  assign: (input: { clientId: string; surveyId: string; assignedToUserId: string; dueOn: string; note: string }) =>
    request<{ assignment: AdminAssignment }>("/api/portal/admin/questionnaires", json("POST", input)),
  edit: (id: string, patch: { dueOn?: string; note?: string; status?: "reviewed" | "draft" }) =>
    request<{ assignment: AdminAssignment }>(`/api/portal/admin/questionnaires/${encodeURIComponent(id)}`, json("PATCH", patch)),
  remove: (id: string) => request<{ success: true }>(`/api/portal/admin/questionnaires/${encodeURIComponent(id)}`, json("DELETE")),
};

/** Human-readable answer for review screens. */
export const formatAnswer = (value: unknown): string =>
  value === undefined || value === null || value === "" ? "No answer" : Array.isArray(value) ? value.join(", ") : String(value);

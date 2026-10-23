import type { Express, Request, RequestHandler, Response } from "express";
import { isDeStaff } from "@shared/permissions";
import { selectedPortalCompanyId } from "./portalCompanyProfile";
import { createAssignment, deleteAssignment, getAssignment, listAll, listForUser, updateAssignment } from "./questionnaireStore";
import {
  answersSchema,
  assignInputSchema,
  assignmentEditSchema,
  isOverdue,
  todayUtc,
  type QuestionnaireAssignment,
} from "@shared/questionnaires";

/**
 * DE Questionnaires over HTTP.
 *
 * Person side (only the person it is assigned to, at their own company):
 * - GET  /api/portal/questionnaires/mine
 * - GET  /api/portal/questionnaires/mine/:id          questions + saved draft
 * - POST /api/portal/questionnaires/mine/:id/draft    save without validating
 * - POST /api/portal/questionnaires/mine/:id/submit   validated by the survey's rules
 *
 * DE side (questionnaires.manage):
 * - GET    /api/portal/admin/questionnaires           every assignment, for the calendar
 * - GET    /api/portal/admin/questionnaires/options   surveys you can assign
 * - GET    /api/portal/admin/questionnaires/people/:companyId
 * - GET    /api/portal/admin/questionnaires/:id       with answers
 * - POST   /api/portal/admin/questionnaires           assign
 * - PATCH  /api/portal/admin/questionnaires/:id       due date, note, reviewed / send back
 * - DELETE /api/portal/admin/questionnaires/:id
 */

type AuthedRequest = Request & { user?: any };
type Question = { id: string; type: string; label: string; required: boolean; options?: string[]; helpText?: string };
type Survey = { id: string; title: string; description: string; category: string; questions: Question[] };
type Person = { id: string; clientId?: string | null; fullName?: string; email?: string; isActive?: boolean };

export type QuestionnaireRouteDeps = {
  guards: RequestHandler[];
  /** Must enforce questionnaires.manage. */
  adminGuards: RequestHandler[];
  getClient: (id: string) => { id: string; companyName: string } | undefined;
  findUser: (id: string) => Person | undefined;
  listClientUsers: (clientId: string) => Person[];
  getSurvey: (id: string) => Promise<Survey | null>;
  listSurveys: () => Promise<Survey[]>;
  validateAnswers: (survey: Survey, answers: Record<string, unknown>) => { ok: true } | { ok: false; error: string };
  now?: () => Date;
};

export const MY_QUESTIONNAIRES_PATH = "/api/portal/questionnaires/mine";
export const ADMIN_QUESTIONNAIRES_PATH = "/api/portal/admin/questionnaires";

const fieldErrors = (issues: { path: PropertyKey[]; message: string }[]) =>
  Object.fromEntries(issues.map((i) => [i.path.map(String).join(".") || "form", i.message]));

const OPEN = new Set(["assigned", "draft"]);

export function registerQuestionnaireRoutes(app: Express, deps: QuestionnaireRouteDeps): void {
  const now = () => (deps.now ?? (() => new Date()))();
  const nameOf = (id: string | undefined) => {
    const u = id ? deps.findUser(id) : undefined;
    return u?.fullName || u?.email || "";
  };

  const summary = async (a: QuestionnaireAssignment, today: string) => {
    const survey = await deps.getSurvey(a.surveyId);
    return {
      id: a.id,
      surveyId: a.surveyId,
      title: survey?.title ?? "Questionnaire no longer available",
      description: survey?.description ?? "",
      questionCount: survey?.questions.length ?? 0,
      dueOn: a.dueOn,
      status: a.status,
      overdue: isOverdue(a, today),
      note: a.note,
      submittedAt: a.submittedAt,
      reviewedAt: a.reviewedAt,
    };
  };

  /** The person's own assignment, or an answer and null. */
  const mine = async (req: AuthedRequest, res: Response): Promise<QuestionnaireAssignment | null> => {
    const companyId = selectedPortalCompanyId(req.user);
    const a = await getAssignment(req.params.id);
    if (!a || !companyId || a.clientId !== companyId || a.assignedToUserId !== req.user?.id) {
      res.status(404).json({ error: "Questionnaire not found" });
      return null;
    }
    return a;
  };

  app.get(MY_QUESTIONNAIRES_PATH, ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const companyId = selectedPortalCompanyId(req.user);
    if (!companyId || !req.user?.id) return res.json({ success: true, questionnaires: [], openCount: 0 });
    const today = todayUtc(now());
    const list = await Promise.all((await listForUser(companyId, req.user.id)).map((a) => summary(a, today)));
    res.json({ success: true, questionnaires: list, openCount: list.filter((q) => OPEN.has(q.status)).length });
  });

  app.get(`${MY_QUESTIONNAIRES_PATH}/:id`, ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const a = await mine(req, res);
    if (!a) return;
    const survey = await deps.getSurvey(a.surveyId);
    if (!survey) return res.status(410).json({ error: "This questionnaire is no longer available. DE has been told." });
    res.json({ success: true, questionnaire: { ...(await summary(a, todayUtc(now()))), questions: survey.questions, answers: a.answers } });
  });

  const answersFrom = (req: AuthedRequest, res: Response) => {
    const parsed = answersSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error.issues) });
      return null;
    }
    return parsed.data.answers;
  };

  app.post(`${MY_QUESTIONNAIRES_PATH}/:id/draft`, ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const a = await mine(req, res);
    if (!a) return;
    if (!OPEN.has(a.status)) return res.status(409).json({ error: "This questionnaire has already been submitted." });
    const answers = answersFrom(req, res);
    if (!answers) return;
    const updated = await updateAssignment(a.id, { answers, status: "draft" }, now());
    res.json({ success: true, status: updated!.status });
  });

  app.post(`${MY_QUESTIONNAIRES_PATH}/:id/submit`, ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const a = await mine(req, res);
    if (!a) return;
    if (!OPEN.has(a.status)) return res.status(409).json({ error: "This questionnaire has already been submitted." });
    const answers = answersFrom(req, res);
    if (!answers) return;
    const survey = await deps.getSurvey(a.surveyId);
    if (!survey) return res.status(410).json({ error: "This questionnaire is no longer available." });
    const check = deps.validateAnswers(survey, answers);
    if (!check.ok) return res.status(400).json({ error: check.error });
    const at = now();
    const updated = await updateAssignment(a.id, { answers, status: "submitted", submittedAt: at.toISOString() }, at);
    res.json({ success: true, status: updated!.status, submittedAt: updated!.submittedAt });
  });

  // ---- DE side ----
  const adminView = async (a: QuestionnaireAssignment, today: string) => ({
    ...(await summary(a, today)),
    clientId: a.clientId,
    companyName: deps.getClient(a.clientId)?.companyName ?? "Unknown company",
    assignedToUserId: a.assignedToUserId,
    assignedToName: nameOf(a.assignedToUserId) || "Former user",
    assignedByName: a.assignedByName,
    reviewedByName: a.reviewedByName,
  });

  app.get(ADMIN_QUESTIONNAIRES_PATH, ...deps.adminGuards, async (_req: AuthedRequest, res: Response) => {
    const today = todayUtc(now());
    res.json({ success: true, today, assignments: await Promise.all((await listAll()).map((a) => adminView(a, today))) });
  });

  app.get(`${ADMIN_QUESTIONNAIRES_PATH}/options`, ...deps.adminGuards, async (_req: AuthedRequest, res: Response) => {
    const surveys = await deps.listSurveys();
    res.json({ success: true, surveys: surveys.map((s) => ({ id: s.id, title: s.title, category: s.category, questionCount: s.questions.length })) });
  });

  app.get(`${ADMIN_QUESTIONNAIRES_PATH}/people/:companyId`, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    if (!deps.getClient(req.params.companyId)) return res.status(404).json({ error: "Company not found" });
    const people = deps
      .listClientUsers(req.params.companyId)
      .filter((u) => u.isActive !== false)
      .map((u) => ({ id: u.id, name: u.fullName || u.email || u.id, email: u.email ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ success: true, people });
  });

  app.get(`${ADMIN_QUESTIONNAIRES_PATH}/:id`, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const a = await getAssignment(req.params.id);
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    const survey = await deps.getSurvey(a.surveyId);
    res.json({ success: true, assignment: { ...(await adminView(a, todayUtc(now()))), questions: survey?.questions ?? [], answers: a.answers } });
  });

  app.post(ADMIN_QUESTIONNAIRES_PATH, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const parsed = assignInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error.issues) });
    const input = parsed.data;
    if (!deps.getClient(input.clientId)) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: { clientId: "That company doesn't exist" } });
    if (!(await deps.getSurvey(input.surveyId))) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: { surveyId: "That questionnaire doesn't exist" } });
    const person = deps.findUser(input.assignedToUserId);
    if (!person || person.clientId !== input.clientId || person.isActive === false) {
      return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: { assignedToUserId: "Choose an active person at that company" } });
    }
    const a = await createAssignment(input, { id: req.user?.id ?? "", name: nameOf(req.user?.id) || (isDeStaff(req.user) ? "Digerati Experts" : "") }, now());
    res.status(201).json({ success: true, assignment: await adminView(a, todayUtc(now())) });
  });

  app.patch(`${ADMIN_QUESTIONNAIRES_PATH}/:id`, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const a = await getAssignment(req.params.id);
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    const parsed = assignmentEditSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error.issues) });
    const { status, ...rest } = parsed.data;
    const at = now();
    let statusPatch = {};
    if (status === "reviewed") {
      if (a.status !== "submitted" && a.status !== "reviewed") return res.status(409).json({ error: "Only a submitted questionnaire can be marked reviewed." });
      statusPatch = { status: "reviewed", reviewedAt: at.toISOString(), reviewedByName: nameOf(req.user?.id) || "Digerati Experts" };
    } else if (status === "draft") {
      // Send it back: the person can edit and resubmit; their answers stay.
      statusPatch = { status: "draft", submittedAt: null, reviewedAt: null, reviewedByName: null };
    }
    const updated = await updateAssignment(a.id, { ...rest, ...statusPatch }, at);
    res.json({ success: true, assignment: await adminView(updated!, todayUtc(at)) });
  });

  app.delete(`${ADMIN_QUESTIONNAIRES_PATH}/:id`, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    if (!(await deleteAssignment(req.params.id))) return res.status(404).json({ error: "Assignment not found" });
    res.json({ success: true });
  });
}

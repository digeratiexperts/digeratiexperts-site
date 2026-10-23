import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { can } from "@shared/permissions";
import { validateAnswers } from "./portalSurveyStore";

/**
 * DE Questionnaires over HTTP with the memory store and the real survey
 * validator: DE assigns a survey to a person at a company; only that person
 * sees, drafts and submits it; DE reviews or sends it back.
 */

const CLIENTS: Record<string, { id: string; companyName: string }> = {
  acme: { id: "acme", companyName: "Acme Corp" },
  globex: { id: "globex", companyName: "Globex" },
};
const PEOPLE: Record<string, { id: string; clientId: string | null; fullName: string; email: string; isActive: boolean }> = {
  "u-ann": { id: "u-ann", clientId: "acme", fullName: "Ann Acme", email: "ann@acme.test", isActive: true },
  "u-bob": { id: "u-bob", clientId: "acme", fullName: "Bob Acme", email: "bob@acme.test", isActive: true },
  "u-old": { id: "u-old", clientId: "acme", fullName: "Old Acme", email: "old@acme.test", isActive: false },
  "u-gus": { id: "u-gus", clientId: "globex", fullName: "Gus Globex", email: "gus@globex.test", isActive: true },
  "u-staff": { id: "u-staff", clientId: null, fullName: "Sam Staff", email: "sam@de.test", isActive: true },
};
const SURVEY = {
  id: "s-onboard",
  slug: "onboarding",
  title: "Onboarding intake",
  description: "Tell us about your setup",
  category: "onboarding",
  isActive: true,
  sortOrder: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  questions: [
    { id: "q1", type: "single", label: "Do you use Microsoft 365?", required: true, options: ["Yes", "No"] },
    { id: "q2", type: "text", label: "Anything else?", required: false },
  ],
};

const ANN = { id: "u-ann", role: "user", clientId: "acme" };
const BOB = { id: "u-bob", role: "user", clientId: "acme" };
const GUS = { id: "u-gus", role: "user", clientId: "globex" };
const STAFF = { id: "u-staff", role: "staff", clientId: null };

const NOW = new Date("2026-10-23T18:00:00.000Z");

const signedInAs: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return res.status(401).json({ error: "Sign in" });
  next();
};
const manage: express.RequestHandler = (req, res, next) => {
  if (!can((req as any).user, "questionnaires.manage")) return res.status(403).json({ error: "Insufficient permissions" });
  next();
};

let server: Server;
let baseUrl = "";
let reset: () => void;

beforeAll(async () => {
  const mod = await import("./questionnaireRoutes");
  reset = (await import("./questionnaireStore"))._resetQuestionnaireMemory;
  const app = express();
  app.use(express.json());
  mod.registerQuestionnaireRoutes(app, {
    guards: [signedInAs],
    adminGuards: [signedInAs, manage],
    getClient: (id) => CLIENTS[id],
    findUser: (id) => PEOPLE[id],
    listClientUsers: (clientId) => Object.values(PEOPLE).filter((p) => p.clientId === clientId),
    getSurvey: async (id) => (id === SURVEY.id ? SURVEY : null),
    listSurveys: async () => [SURVEY],
    validateAnswers: (survey, answers) => validateAnswers(survey as any, answers),
    now: () => NOW,
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => reset());

async function call(method: string, path: string, user?: object, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}
const assign = (over: Record<string, unknown> = {}, user: object = STAFF) =>
  call("POST", "/api/portal/admin/questionnaires", user, { clientId: "acme", surveyId: "s-onboard", assignedToUserId: "u-ann", dueOn: "2026-11-01", note: "Before kickoff", ...over });

describe("Questionnaires: assigning", () => {
  it("lets DE staff assign to an active person at that company only", async () => {
    const ok = await assign();
    expect(ok.status).toBe(201);
    expect(ok.body.assignment).toMatchObject({ companyName: "Acme Corp", assignedToName: "Ann Acme", title: "Onboarding intake", status: "assigned", overdue: false });
    expect((await assign({ assignedToUserId: "u-gus" })).body.fieldErrors.assignedToUserId).toBeTruthy();
    expect((await assign({ assignedToUserId: "u-old" })).body.fieldErrors.assignedToUserId).toBeTruthy();
    expect((await assign({ surveyId: "nope" })).body.fieldErrors.surveyId).toBeTruthy();
    expect((await assign({ clientId: "nope" })).body.fieldErrors.clientId).toBeTruthy();
    expect((await assign({ dueOn: "next week" })).body.fieldErrors.dueOn).toBeTruthy();
  });

  it("refuses every DE route to client users", async () => {
    expect((await assign({}, ANN)).status).toBe(403);
    expect((await call("GET", "/api/portal/admin/questionnaires", ANN)).status).toBe(403);
    expect((await call("GET", "/api/portal/admin/questionnaires/options", ANN)).status).toBe(403);
    expect((await call("GET", "/api/portal/admin/questionnaires/people/acme", ANN)).status).toBe(403);
  });

  it("lists only active people at the company for the picker", async () => {
    const people = (await call("GET", "/api/portal/admin/questionnaires/people/acme", STAFF)).body.people;
    expect(people.map((p: any) => p.name)).toEqual(["Ann Acme", "Bob Acme"]);
  });
});

describe("Questionnaires: only the assignee", () => {
  it("shows Ann her questionnaire and nobody else", async () => {
    const id = (await assign()).body.assignment.id;
    expect((await call("GET", "/api/portal/questionnaires/mine", ANN)).body).toMatchObject({ openCount: 1 });
    expect((await call("GET", "/api/portal/questionnaires/mine", BOB)).body.questionnaires).toEqual([]);
    expect((await call("GET", "/api/portal/questionnaires/mine", GUS)).body.questionnaires).toEqual([]);
    for (const user of [BOB, GUS]) {
      expect((await call("GET", `/api/portal/questionnaires/mine/${id}`, user)).status).toBe(404);
      expect((await call("POST", `/api/portal/questionnaires/mine/${id}/draft`, user, { answers: {} })).status).toBe(404);
      expect((await call("POST", `/api/portal/questionnaires/mine/${id}/submit`, user, { answers: { q1: "Yes" } })).status).toBe(404);
    }
  });

  it("saves a partial draft, then submits only valid answers, then locks", async () => {
    const id = (await assign()).body.assignment.id;
    expect((await call("POST", `/api/portal/questionnaires/mine/${id}/draft`, ANN, { answers: { q2: "We have a NAS" } })).body.status).toBe("draft");
    const reopened = (await call("GET", `/api/portal/questionnaires/mine/${id}`, ANN)).body.questionnaire;
    expect(reopened.answers).toEqual({ q2: "We have a NAS" });
    expect(reopened.questions).toHaveLength(2);

    const missing = await call("POST", `/api/portal/questionnaires/mine/${id}/submit`, ANN, { answers: { q2: "x" } });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe("Missing answer for: Do you use Microsoft 365?");
    expect((await call("POST", `/api/portal/questionnaires/mine/${id}/submit`, ANN, { answers: { q1: "Maybe" } })).status).toBe(400);

    const done = await call("POST", `/api/portal/questionnaires/mine/${id}/submit`, ANN, { answers: { q1: "Yes", q2: "We have a NAS" } });
    expect(done.body).toMatchObject({ status: "submitted", submittedAt: NOW.toISOString() });
    expect((await call("POST", `/api/portal/questionnaires/mine/${id}/draft`, ANN, { answers: {} })).status).toBe(409);
    expect((await call("GET", "/api/portal/questionnaires/mine", ANN)).body.openCount).toBe(0);
  });
});

describe("Questionnaires: DE review", () => {
  it("shows DE the answers, marks reviewed, or sends back for changes", async () => {
    const id = (await assign()).body.assignment.id;
    expect((await call("PATCH", `/api/portal/admin/questionnaires/${id}`, STAFF, { status: "reviewed" })).status).toBe(409);
    await call("POST", `/api/portal/questionnaires/mine/${id}/submit`, ANN, { answers: { q1: "No" } });
    expect((await call("GET", `/api/portal/admin/questionnaires/${id}`, STAFF)).body.assignment.answers).toEqual({ q1: "No" });

    const back = await call("PATCH", `/api/portal/admin/questionnaires/${id}`, STAFF, { status: "draft", note: "Please confirm Microsoft 365" });
    expect(back.body.assignment).toMatchObject({ status: "draft", note: "Please confirm Microsoft 365", submittedAt: null });
    await call("POST", `/api/portal/questionnaires/mine/${id}/submit`, ANN, { answers: { q1: "Yes" } });
    const reviewed = await call("PATCH", `/api/portal/admin/questionnaires/${id}`, STAFF, { status: "reviewed" });
    expect(reviewed.body.assignment).toMatchObject({ status: "reviewed", reviewedByName: "Sam Staff" });
  });

  it("flags overdue open questionnaires and deletes", async () => {
    const late = (await assign({ dueOn: "2026-10-01" })).body.assignment;
    expect(late.overdue).toBe(true);
    const all = (await call("GET", "/api/portal/admin/questionnaires", STAFF)).body;
    expect(all.today).toBe("2026-10-23");
    expect(all.assignments.map((a: any) => a.id)).toEqual([late.id]);
    expect((await call("DELETE", `/api/portal/admin/questionnaires/${late.id}`, STAFF)).status).toBe(200);
    expect((await call("GET", "/api/portal/questionnaires/mine", ANN)).body.questionnaires).toEqual([]);
  });
});

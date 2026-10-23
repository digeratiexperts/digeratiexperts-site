import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * System Status over HTTP with the memory store: DE admins post notices for one
 * company or every client; a company sees its own plus the all-client ones and
 * never another company's; clients cannot write; validation and the overall
 * line follow shared/statusNotices.ts.
 */

const CLIENTS: Record<string, { id: string; companyName: string }> = {
  acme: { id: "acme", companyName: "Acme Corp" },
  globex: { id: "globex", companyName: "Globex" },
};
const USERS: Record<string, { id: string; fullName: string; email: string }> = {
  "u-admin": { id: "u-admin", fullName: "Dana DE", email: "dana@de.test" },
  "u-ann": { id: "u-ann", fullName: "Ann Acme", email: "ann@acme.test" },
};

const ANN = { id: "u-ann", role: "user", clientId: "acme" };
const GUS = { id: "u-gus", role: "user", clientId: "globex" };
const DE_ADMIN = { id: "u-admin", role: "admin", clientId: null };
const DE_AS_ACME = { ...DE_ADMIN, impersonatingCompanyId: "acme" };

const NOW = new Date("2026-10-23T18:00:00.000Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString();

const signedInAs: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return res.status(401).json({ error: "Sign in" });
  next();
};
const adminOnly: express.RequestHandler = (req, res, next) => {
  if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
};

let server: Server;
let baseUrl = "";
let resetMemory: () => void;

beforeAll(async () => {
  const { registerStatusNoticeRoutes } = await import("./statusNoticeRoutes");
  resetMemory = (await import("./statusNoticeStore"))._resetStatusNoticeMemory;
  const app = express();
  app.use(express.json());
  registerStatusNoticeRoutes(app, {
    guards: [signedInAs],
    adminGuards: [signedInAs, adminOnly],
    getClient: (id) => CLIENTS[id],
    findUser: (id) => USERS[id],
    now: () => NOW,
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => resetMemory());

async function call(method: string, path: string, user?: object, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

const incident = (over: Record<string, unknown> = {}) => ({
  clientId: "acme",
  kind: "incident",
  severity: "degraded",
  title: "Email delivery delayed",
  body: "Outbound mail is queueing.",
  affectedServices: ["Email"],
  startsAt: hoursFromNow(-1),
  endsAt: null,
  ...over,
});

describe("System Status: access", () => {
  it("needs a signed-in user", async () => {
    expect((await call("GET", "/api/portal/status")).status).toBe(401);
  });

  it("refuses every write to a client user", async () => {
    expect((await call("POST", "/api/portal/admin/status-notices", ANN, incident())).status).toBe(403);
    expect((await call("GET", "/api/portal/admin/status-notices", ANN)).status).toBe(403);
    const created = await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident());
    const id = created.body.notice.id;
    expect((await call("PATCH", `/api/portal/admin/status-notices/${id}`, ANN, { title: "x" })).status).toBe(403);
    expect((await call("POST", `/api/portal/admin/status-notices/${id}/updates`, ANN, { body: "x" })).status).toBe(403);
    expect((await call("DELETE", `/api/portal/admin/status-notices/${id}`, ANN)).status).toBe(403);
  });
});

describe("System Status: tenant isolation", () => {
  it("shows a company its own notices and the all-client ones, never another company's", async () => {
    await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ title: "Acme only" }));
    await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ clientId: "globex", title: "Globex only" }));
    await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ clientId: null, title: "Everyone", severity: "info" }));

    const ann = await call("GET", "/api/portal/status", ANN);
    expect(ann.status).toBe(200);
    expect(ann.body.company).toEqual({ id: "acme", name: "Acme Corp" });
    expect(ann.body.active.map((n: any) => n.title).sort()).toEqual(["Acme only", "Everyone"]);
    // The scope never reaches the client, only whether it is for everyone.
    expect(ann.body.active.every((n: any) => !("clientId" in n))).toBe(true);
    expect(ann.body.active.find((n: any) => n.title === "Everyone").forAllClients).toBe(true);

    const gus = await call("GET", "/api/portal/status", GUS);
    expect(gus.body.active.map((n: any) => n.title).sort()).toEqual(["Everyone", "Globex only"]);
  });

  it("gives a DE admin the company they opened, or only the all-client notices", async () => {
    await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ title: "Acme only" }));
    await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ clientId: null, title: "Everyone" }));
    const asAcme = await call("GET", "/api/portal/status", DE_AS_ACME);
    expect(asAcme.body.active.map((n: any) => n.title).sort()).toEqual(["Acme only", "Everyone"]);
    const none = await call("GET", "/api/portal/status", DE_ADMIN);
    expect(none.body.company).toBeNull();
    expect(none.body.active.map((n: any) => n.title)).toEqual(["Everyone"]);
  });

  it("lists every notice with its company for DE admins", async () => {
    await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident());
    await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ clientId: null }));
    const list = await call("GET", "/api/portal/admin/status-notices", DE_ADMIN);
    expect(list.body.notices.map((n: any) => n.companyName).sort((a: any, b: any) => String(a).localeCompare(String(b)))).toEqual(["Acme Corp", null]);
  });
});

describe("System Status: validation", () => {
  it("rejects a missing title, an unknown company, maintenance without an end, and an end before the start", async () => {
    const noTitle = await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ title: "" }));
    expect(noTitle.status).toBe(400);
    expect(noTitle.body.fieldErrors.title).toBe("Title is required");

    const unknown = await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ clientId: "nope" }));
    expect(unknown.status).toBe(400);
    expect(unknown.body.fieldErrors.clientId).toBeTruthy();

    const noEnd = await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ kind: "maintenance", endsAt: null }));
    expect(noEnd.status).toBe(400);
    expect(noEnd.body.fieldErrors.endsAt).toBe("Maintenance needs a planned end");

    const backwards = await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ endsAt: hoursFromNow(-5) }));
    expect(backwards.status).toBe(400);
    expect(backwards.body.fieldErrors.endsAt).toBe("The end must be after the start");

    const badKind = await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ kind: "rumour" }));
    expect(badKind.status).toBe(400);
  });

  it("returns 404 for a notice that doesn't exist", async () => {
    expect((await call("PATCH", "/api/portal/admin/status-notices/missing", DE_ADMIN, { title: "x" })).status).toBe(404);
    expect((await call("POST", "/api/portal/admin/status-notices/missing/updates", DE_ADMIN, { body: "x" })).status).toBe(404);
    expect((await call("DELETE", "/api/portal/admin/status-notices/missing", DE_ADMIN)).status).toBe(404);
  });
});

describe("System Status: lifecycle and the overall line", () => {
  it("reads 'operational' with nothing posted", async () => {
    const view = await call("GET", "/api/portal/status", ANN);
    expect(view.body.overall).toBe("operational");
    expect([view.body.active, view.body.inProgress, view.body.upcoming, view.body.history].every((l: any[]) => l.length === 0)).toBe(true);
  });

  it("posts an update, resolves into history, and can reopen", async () => {
    const created = await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ severity: "outage" }));
    const id = created.body.notice.id;
    expect((await call("GET", "/api/portal/status", ANN)).body.overall).toBe("outage");

    const upd = await call("POST", `/api/portal/admin/status-notices/${id}/updates`, DE_ADMIN, { body: "Fixed at the provider.", resolve: true });
    expect(upd.status).toBe(200);
    expect(upd.body.notice.updates).toEqual([{ at: NOW.toISOString(), byName: "Dana DE", body: "Fixed at the provider." }]);
    expect(upd.body.notice.resolvedAt).toBe(NOW.toISOString());

    const after = await call("GET", "/api/portal/status", ANN);
    expect(after.body.overall).toBe("operational");
    expect(after.body.active).toEqual([]);
    expect(after.body.history.map((n: any) => n.id)).toEqual([id]);

    const reopened = await call("PATCH", `/api/portal/admin/status-notices/${id}`, DE_ADMIN, { reopen: true });
    expect(reopened.body.notice.resolvedAt).toBeNull();
    expect((await call("GET", "/api/portal/status", ANN)).body.active.map((n: any) => n.id)).toEqual([id]);
  });

  it("files maintenance as upcoming, in progress, then history by its window", async () => {
    await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ kind: "maintenance", severity: "info", title: "Later", startsAt: hoursFromNow(24), endsAt: hoursFromNow(26) }));
    await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ kind: "maintenance", severity: "info", title: "Now", startsAt: hoursFromNow(-1), endsAt: hoursFromNow(1) }));
    await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ kind: "maintenance", severity: "info", title: "Done", startsAt: hoursFromNow(-5), endsAt: hoursFromNow(-4) }));
    await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident({ kind: "maintenance", severity: "info", title: "Ancient", startsAt: hoursFromNow(-24 * 120), endsAt: hoursFromNow(-24 * 119) }));
    const view = (await call("GET", "/api/portal/status", ANN)).body;
    expect(view.upcoming.map((n: any) => n.title)).toEqual(["Later"]);
    expect(view.inProgress.map((n: any) => n.title)).toEqual(["Now"]);
    expect(view.history.map((n: any) => n.title)).toEqual(["Done"]);
    expect(view.overall).toBe("maintenance");
  });

  it("edits a notice and deletes it", async () => {
    const id = (await call("POST", "/api/portal/admin/status-notices", DE_ADMIN, incident())).body.notice.id;
    const edited = await call("PATCH", `/api/portal/admin/status-notices/${id}`, DE_ADMIN, { title: "Email delivery restored slowly", clientId: null });
    expect(edited.status).toBe(200);
    expect(edited.body.notice.title).toBe("Email delivery restored slowly");
    expect(edited.body.notice.companyName).toBeNull();
    expect((await call("DELETE", `/api/portal/admin/status-notices/${id}`, DE_ADMIN)).status).toBe(200);
    expect((await call("GET", "/api/portal/status", ANN)).body.active).toEqual([]);
  });
});

import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #254, still in the code on 2026-10-01: a Company IT Contact could
 * rename another company's department by naming that company's clientId in
 * the update body, and either route would attach a user from another company
 * as a department's IT contact. These run the real routes over HTTP with the
 * department table in memory; the in-memory update matches id AND clientId,
 * as the real query does.
 */

type Dept = { id: string; clientId: string; name: string; itContactUserId: string | null };

const mem = vi.hoisted(() => ({
  depts: new Map<string, { id: string; clientId: string; name: string; itContactUserId: string | null }>(),
  users: {
    "u-acme-it": { id: "u-acme-it", clientId: "acme" },
    "u-acme-staff": { id: "u-acme-staff", clientId: "acme" },
    "u-globex-staff": { id: "u-globex-staff", clientId: "globex" },
  } as Record<string, { id: string; clientId: string | null }>,
}));

vi.mock("./portalOrg", () => ({
  findUserById: (id: string) => mem.users[id] ?? null,
  createDepartment: async (clientId: string, name: string, itContactUserId?: string | null) => {
    const row = { id: `d${mem.depts.size + 1}`, clientId, name: name.trim(), itContactUserId: itContactUserId ?? null };
    mem.depts.set(row.id, row);
    return row;
  },
  updateDepartment: async (id: string, clientId: string, patch: { name?: string; itContactUserId?: string | null }) => {
    const row = mem.depts.get(id);
    if (!row || row.clientId !== clientId) return undefined;
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.itContactUserId !== undefined) row.itContactUserId = patch.itContactUserId;
    return row;
  },
}));

const ACME_IT = { id: "u-acme-it", role: "user", clientId: "acme", isCompanyItContact: true };
const DE_ADMIN = { id: "u-admin", role: "admin", clientId: null };

/** Stands in for authMiddleware: the test names the signed-in user in a header. */
const signedInAs: express.RequestHandler = (req, _res, next) => {
  const raw = req.header("x-test-user");
  (req as express.Request & { user?: unknown }).user = raw ? JSON.parse(raw) : undefined;
  next();
};

describe("portal department routes keep each company to its own departments", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const { registerPortalDepartmentRoutes } = await import("./portalDepartmentRoutes");
    const app = express();
    app.use(express.json());
    registerPortalDepartmentRoutes(app, { guards: [signedInAs] });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    mem.depts.clear();
    mem.depts.set("d-acme", { id: "d-acme", clientId: "acme", name: "Finance", itContactUserId: null });
    mem.depts.set("d-globex", { id: "d-globex", clientId: "globex", name: "Legal", itContactUserId: null });
  });

  const send = (method: "POST" | "PATCH", path: string, user: object, body: object) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "x-test-user": JSON.stringify(user) },
      body: JSON.stringify(body),
    });
  const globexDept = (): Dept => mem.depts.get("d-globex")!;

  it("refuses an IT Contact who names another company's clientId on update", async () => {
    const res = await send("PATCH", "/api/portal/org/departments/d-globex", ACME_IT, { clientId: "globex", name: "Taken" });
    expect(res.status).toBe(403);
    expect(globexDept().name).toBe("Legal");
  });

  it("treats another company's department as not found when no clientId is named", async () => {
    const res = await send("PATCH", "/api/portal/org/departments/d-globex", ACME_IT, { name: "Taken" });
    expect(res.status).toBe(404);
    expect(globexDept().name).toBe("Legal");
  });

  it("lets an IT Contact rename their own company's department", async () => {
    const res = await send("PATCH", "/api/portal/org/departments/d-acme", ACME_IT, { name: "Accounts" });
    expect(res.status).toBe(200);
    expect((await res.json()).department).toMatchObject({ id: "d-acme", clientId: "acme", name: "Accounts" });
  });

  it("refuses an IT contact from another company on update, and accepts one from the same company", async () => {
    const foreign = await send("PATCH", "/api/portal/org/departments/d-acme", ACME_IT, { itContactUserId: "u-globex-staff" });
    expect(foreign.status).toBe(400);
    expect(mem.depts.get("d-acme")!.itContactUserId).toBeNull();

    const own = await send("PATCH", "/api/portal/org/departments/d-acme", ACME_IT, { itContactUserId: "u-acme-staff" });
    expect(own.status).toBe(200);
    expect(mem.depts.get("d-acme")!.itContactUserId).toBe("u-acme-staff");

    const cleared = await send("PATCH", "/api/portal/org/departments/d-acme", ACME_IT, { itContactUserId: null });
    expect(cleared.status).toBe(200);
    expect(mem.depts.get("d-acme")!.itContactUserId).toBeNull();
  });

  it("refuses an unknown IT contact id", async () => {
    const res = await send("PATCH", "/api/portal/org/departments/d-acme", ACME_IT, { itContactUserId: "u-nobody" });
    expect(res.status).toBe(400);
  });

  it("refuses to create a department in another company, or with another company's IT contact", async () => {
    const foreignCompany = await send("POST", "/api/portal/org/departments", ACME_IT, { clientId: "globex", name: "Shadow" });
    expect(foreignCompany.status).toBe(403);
    const foreignContact = await send("POST", "/api/portal/org/departments", ACME_IT, { name: "Ops", itContactUserId: "u-globex-staff" });
    expect(foreignContact.status).toBe(400);
    expect([...mem.depts.values()].map((d) => d.name).sort()).toEqual(["Finance", "Legal"]);
  });

  it("creates a department in the IT Contact's own company, as the People page sends it", async () => {
    const res = await send("POST", "/api/portal/org/departments", ACME_IT, { name: "Operations" });
    expect(res.status).toBe(201);
    expect((await res.json()).department).toMatchObject({ clientId: "acme", name: "Operations", itContactUserId: null });
  });

  it("lets a DE admin act on a named company, and asks an admin for one when none is named", async () => {
    const res = await send("PATCH", "/api/portal/org/departments/d-globex", DE_ADMIN, { clientId: "globex", name: "Legal & Risk" });
    expect(res.status).toBe(200);
    expect(globexDept().name).toBe("Legal & Risk");

    const unnamed = await send("POST", "/api/portal/org/departments", DE_ADMIN, { name: "Nowhere" });
    expect(unnamed.status).toBe(400);
  });

  it("refuses a signed-in user with no company", async () => {
    const res = await send("POST", "/api/portal/org/departments", { id: "u-loose", role: "user", clientId: null }, { name: "Ops" });
    expect(res.status).toBe(400);
  });
});

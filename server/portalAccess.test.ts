import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lane A route-guard + break-glass audit-flag tests (lane-a-update-2.md acceptance).
 * The permission helper itself is covered in shared/permissions/permissions.test.ts;
 * these cover the middleware and the DE staff management routes over HTTP.
 */

vi.mock("./db", () => ({ db: null, dbReady: false, initPromise: Promise.resolve() }));

const writeAudit = vi.hoisted(() => vi.fn(async (_entry: unknown) => undefined));
vi.mock("./portalAccessStore", () => ({
  writeAudit,
  getEntitlements: vi.fn(async () => []),
  listEntitlementRecords: vi.fn(async () => []),
  setEntitlement: vi.fn(async () => ({})),
  hasSharedFiles: vi.fn(async () => false),
  recentAudit: vi.fn(async () => []),
  _resetPortalAccessMemory: vi.fn(),
}));

import { actingCompanyId, auditMutation, requirePermission } from "./portalAccess";

const BREAK_GLASS = { id: "u-break", email: "boss@de.test", role: "admin", clientId: null };
const DE_STAFF = { id: "u-staff", email: "staff@de.test", role: "staff", clientId: "msp-digerati" };
const CLIENT_A = { id: "u-a", email: "a@acme.test", role: "user", clientId: "c-a" };

function fakeReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "POST",
    path: "/api/portal/admin/companies/c-a/entitlements",
    originalUrl: "/api/portal/admin/companies/c-a/entitlements",
    url: "/api/portal/admin/companies/c-a/entitlements",
    headers: { "user-agent": "vitest" },
    ip: "127.0.0.1",
    params: { companyId: "c-a" },
    ...overrides,
  } as any;
}

function fakeRes() {
  const res: any = {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

describe("actingCompanyId", () => {
  it("uses the switched company for DE actors and the caller's own otherwise", () => {
    expect(actingCompanyId(fakeReq({ user: DE_STAFF, params: {} }))).toBe("msp-digerati");
    expect(actingCompanyId(fakeReq({ user: { ...DE_STAFF, impersonatingCompanyId: "c-z" }, params: {} }))).toBe("c-z");
    expect(actingCompanyId(fakeReq({ user: CLIENT_A, params: {} }))).toBe("c-a");
  });
});

describe("requirePermission (server route guard)", () => {
  it("allows DE staff and break-glass, denies client roles", () => {
    const guard = requirePermission("company.switch");
    for (const user of [DE_STAFF, BREAK_GLASS]) {
      const res = fakeRes();
      let nexted = false;
      guard(fakeReq({ user }), res, () => {
        nexted = true;
      });
      expect(nexted, user.id).toBe(true);
    }
    const res = fakeRes();
    let nexted = false;
    guard(fakeReq({ user: CLIENT_A }), res, () => {
      nexted = true;
    });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("denies a client principal acting on another company's route", () => {
    const guard = requirePermission("entitlements.read", (req) => req.params?.companyId ?? null);
    const ok = fakeRes();
    let nexted = false;
    guard(fakeReq({ user: CLIENT_A, params: { companyId: "c-a" } }), ok, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);

    const denied = fakeRes();
    let nexted2 = false;
    guard(fakeReq({ user: CLIENT_A, params: { companyId: "c-b" } }), denied, () => {
      nexted2 = true;
    });
    expect(nexted2).toBe(false);
    expect(denied.statusCode).toBe(403);
  });

  it("never blocks the break-glass account (today's access, unchanged)", () => {
    const guard = requirePermission("permission.that.does.not.exist");
    const res = fakeRes();
    let nexted = false;
    guard(fakeReq({ user: BREAK_GLASS, params: { companyId: "c-b" } }), res, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
  });
});

describe("break-glass audit flag", () => {
  beforeEach(() => {
    writeAudit.mockClear();
  });

  it("flags every break-glass mutation and writes it before the action runs", async () => {
    const res = fakeRes();
    const ok = await auditMutation(fakeReq({ user: BREAK_GLASS }), res);
    expect(ok).toBe(true);
    expect(writeAudit).toHaveBeenCalledTimes(1);
    expect(writeAudit.mock.calls[0][0]).toMatchObject({
      actorUserId: "u-break",
      actorEmail: "boss@de.test",
      accountClass: "super_admin",
      breakGlass: true,
      action: "POST /api/portal/admin/companies/c-a/entitlements",
    });
  });

  it("flags DE staff mutations without the break-glass flag", async () => {
    const res = fakeRes();
    await auditMutation(fakeReq({ user: DE_STAFF }), res);
    expect(writeAudit.mock.calls[0][0]).toMatchObject({
      accountClass: "de_staff",
      breakGlass: false,
    });
  });

  it("does not audit client actions or auth endpoints or reads", async () => {
    await auditMutation(fakeReq({ user: CLIENT_A }), fakeRes());
    await auditMutation(fakeReq({ user: BREAK_GLASS, method: "GET", path: "/api/portal/me", originalUrl: "/api/portal/me", url: "/api/portal/me" }), fakeRes());
    await auditMutation(fakeReq({ user: BREAK_GLASS, path: "/api/portal/login", originalUrl: "/api/portal/login", url: "/api/portal/login" }), fakeRes());
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("fails closed for the break-glass account when the audit row cannot be written", async () => {
    writeAudit.mockRejectedValueOnce(new Error("audit table down"));
    const res = fakeRes();
    const ok = await auditMutation(fakeReq({ user: BREAK_GLASS }), res);
    expect(ok).toBe(false);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("AUDIT_UNAVAILABLE");
  });

  it("degrades to console logging for DE staff when the write fails", async () => {
    writeAudit.mockRejectedValueOnce(new Error("audit table down"));
    const res = fakeRes();
    const ok = await auditMutation(fakeReq({ user: DE_STAFF }), res);
    expect(ok).toBe(true);
  });
});

describe("DE staff management routes over HTTP", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const { registerPortalAccessRoutes } = await import("./portalAccessRoutes");
    const app = express();
    app.use(express.json());
    const users: Record<string, any> = {
      "u-a": { id: "u-a", email: "a@acme.test", fullName: "Ann", role: "user", orgRole: "staff", clientId: "c-a", clientRoles: [] },
      "u-b": { id: "u-b", email: "b@globex.test", fullName: "Bob", role: "user", orgRole: "staff", clientId: "c-b", clientRoles: [] },
    };
    const auth: express.RequestHandler = (req, res, next) => {
      const raw = req.header("x-test-user");
      if (!raw) return res.status(401).json({ error: "Authentication required" });
      const user = JSON.parse(raw);
      (req as any).user = user;
      (req as any).userId = user.id;
      next();
    };
    registerPortalAccessRoutes(app, {
      auth,
      validateInput: (_req, _res, next) => next(),
      findUserById: (id) => users[id],
      listClientUsers: (clientId) => Object.values(users).filter((u) => u.clientId === clientId),
      commitUser: async (user) => {
        users[user.id] = user;
      },
    });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const call = (method: string, path: string, user: unknown, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-test-user": JSON.stringify(user),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("lets DE staff manage client hats, and never across the tenant line", async () => {
    const listA = await call("GET", "/api/portal/admin/companies/c-a/client-roles", DE_STAFF);
    expect(listA.status).toBe(200);
    expect((await listA.json()).users.map((u: any) => u.id)).toEqual(["u-a"]);

    // Client A cannot manage anyone's hats.
    expect((await call("GET", "/api/portal/admin/companies/c-a/client-roles", CLIENT_A)).status).toBe(403);

    // A user of another company is not found in this one (client A cannot reach client B).
    const cross = await call("PUT", "/api/portal/admin/companies/c-a/client-roles", DE_STAFF, {
      userId: "u-b",
      clientRoles: ["billing"],
    });
    expect(cross.status).toBe(404);

    const set = await call("PUT", "/api/portal/admin/companies/c-a/client-roles", DE_STAFF, {
      userId: "u-a",
      clientRoles: ["billing", "purchaser", "not-a-role"],
    });
    expect(set.status).toBe(400);

    const good = await call("PUT", "/api/portal/admin/companies/c-a/client-roles", DE_STAFF, {
      userId: "u-a",
      clientRoles: ["billing", "purchaser"],
    });
    expect(good.status).toBe(200);
    const goodBody = await good.json();
    expect(goodBody.user.clientRoles.sort()).toEqual(["billing", "purchaser"]);
    expect(goodBody.user.effectiveClientRoles.sort()).toEqual(["billing", "purchaser", "standard"]);
  });
});

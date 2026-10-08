import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Joe, 2026-10-08: drag a vendor licence from DE's pool onto a company (pool
 * first), open the company, and patch its free seats to departments, then
 * people (or straight to people and devices). These run the real routes on
 * the memory store, behind the real requireAdmin.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-license-board";

const ADMIN = { id: "a1", role: "admin", fullName: "DE Staffer", email: "staff@digeratiexperts.com" };
const CLIENT_ADMIN = { id: "u9", role: "user", fullName: "Client ITC", email: "itc@acme.test", isCompanyItContact: true };

const clients = [
  { id: "c1", companyName: "Acme" },
  { id: "c2", companyName: "Bluebird Dental" },
];
const people = [
  { id: "u1", clientId: "c1", fullName: "Dana Ruiz", email: "dana@acme.test", departmentId: "d1" },
  { id: "u2", clientId: "c1", fullName: "Lee Park", email: "lee@acme.test", departmentId: null },
  { id: "u3", clientId: "c2", fullName: "Sam Ortiz", email: "sam@bluebird.test", departmentId: null },
];

describe("license patch bay routes", () => {
  let server: Server;
  let base = "";

  beforeAll(async () => {
    const { registerLicenseBoardRoutes } = await import("./licenseBoardRoutes");
    const { requireAdmin } = await import("./routes");
    const app = express();
    app.use(express.json());
    const signedInAs: express.RequestHandler = (req, _res, next) => {
      const raw = req.header("x-test-user");
      (req as express.Request & { user?: unknown }).user = raw ? JSON.parse(raw) : undefined;
      next();
    };
    registerLicenseBoardRoutes(app, {
      adminGuards: [signedInAs, requireAdmin],
      listClients: () => clients,
      getClient: (id) => clients.find((c) => c.id === id),
      listClientUsers: (clientId) => people.filter((p) => p.clientId === clientId),
      listDepartments: async (clientId) => (clientId === "c1" ? [{ id: "d1", name: "Sales" }] : []),
      fetchHubCatalog: async () => ({ status: "CONNECTED", skus: [{ sku: "DE-MIT-PRO", name: "Managed IT Pro", category: "Managed IT" }] }),
    });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    base = `http://127.0.0.1:${address.port}/api/portal/admin/license-board`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(async () => {
    (await import("./licenseBoardStore"))._resetLicenseBoardMemory();
  });

  const call = async (method: string, path: string, body?: object, user: object | null = ADMIN) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  it("is DE-admin only", async () => {
    expect((await call("GET", "", undefined, CLIENT_ADMIN)).status).toBe(403);
    expect((await call("GET", "", undefined, null)).status).toBe(401);
    expect((await call("POST", "/allocate", { itemId: "x", clientId: "c1" }, CLIENT_ADMIN)).status).toBe(403);
  });

  it("drops seats on a company from DE's pool first, then records the rest to order", async () => {
    const { body: added } = await call("POST", "/items", { catalogKey: "ms_m365_bp", quantity: 2 });
    expect(added.item).toMatchObject({ vendor: "Microsoft", product: "Microsoft 365 Business Premium", quantity: 2 });
    const itemId = added.item.id;

    const drop = await call("POST", "/allocate", { itemId, clientId: "c1", quantity: 3 });
    expect(drop.body).toMatchObject({ fromPool: 2, toOrder: 1 });

    const board = await call("GET", "");
    expect(board.body.items[0]).toMatchObject({ allocated: 2, toOrder: 1, free: 0 });
    expect(board.body.clients.find((c: any) => c.id === "c1").seats).toEqual([
      { itemId, held: 3, toOrder: 1, assigned: 0, free: 3, unlimited: false },
    ]);

    // The pool cannot shrink below the seats already with companies.
    expect((await call("PUT", `/items/${itemId}`, { quantity: 1 })).status).toBe(409);
    expect((await call("DELETE", `/items/${itemId}`)).status).toBe(409);
  });

  it("patches a company's seats to a department, from there to a person, and back", async () => {
    const itemId = (await call("POST", "/items", { vendor: "Huntress", product: "Managed EDR", quantity: 5 })).body.item.id;
    await call("POST", "/allocate", { itemId, clientId: "c1", quantity: 2 });

    expect((await call("POST", "/clients/c1/assign", { itemId, targetType: "department", targetId: "d1" })).status).toBe(201);
    const toPerson = await call("POST", "/clients/c1/assign", { itemId, targetType: "user", targetId: "u1", fromDepartmentId: "d1" });
    expect(toPerson.status).toBe(201);
    // The department's only seat is gone now.
    expect((await call("POST", "/clients/c1/assign", { itemId, targetType: "user", targetId: "u2", fromDepartmentId: "d1" })).status).toBe(409);

    // Straight to a device from the company pool, then the pool is empty.
    expect((await call("POST", "/clients/c1/assign", { itemId, targetType: "device", label: "FRONT-DESK-01" })).status).toBe(201);
    expect((await call("POST", "/clients/c1/assign", { itemId, targetType: "user", targetId: "u2" })).status).toBe(409);
    // Someone from another company cannot be patched.
    expect((await call("POST", "/clients/c1/assign", { itemId, targetType: "user", targetId: "u3" })).status).toBe(404);

    let company = (await call("GET", "/clients/c1")).body;
    expect(company.pool[0]).toMatchObject({ product: "Managed EDR", held: 2, assigned: 2, free: 0 });
    const dana = company.people.find((p: any) => p.id === "u1");
    expect(dana.licenses).toHaveLength(1);
    const frontDesk = company.devices.find((d: any) => d.label === "FRONT-DESK-01");
    expect(frontDesk.licenses).toHaveLength(1);
    expect((await call("POST", "/release", { itemId, clientId: "c1" })).status).toBe(409);

    // Unassigning Dana's seat returns it to Sales, not the company pool.
    const back = await call("DELETE", `/clients/c1/assignments/${dana.licenses[0].assignmentId}`);
    expect(back.body.returnedTo).toBe("department");
    company = (await call("GET", "/clients/c1")).body;
    expect(company.departments[0].seats).toEqual([{ itemId, count: 1 }]);

    // Free the device seat and give it back to DE's pool.
    const desk = company.devices.find((d: any) => d.label === "FRONT-DESK-01");
    await call("DELETE", `/clients/c1/assignments/${desk.licenses[0].assignmentId}`);
    expect((await call("POST", "/release", { itemId, clientId: "c1" })).body.released).toBe("pool");
    expect((await call("GET", "")).body.items[0]).toMatchObject({ allocated: 1, free: 4 });
  });

  it("serves a parts bin of starter items, the catalog and Hub SKUs", async () => {
    const { body } = await call("GET", "/shelf");
    expect(body.hubConnected).toBe(true);
    const keys = body.entries.map((e: any) => e.key);
    expect(keys).toContain("starter:7zip");
    expect(keys).toContain("catalog:ms_m365_bp");
    expect(body.entries.find((e: any) => e.key === "hub:DE-MIT-PRO")).toMatchObject({ sku: "DE-MIT-PRO", category: "Hub SKUs" });
    expect(body.entries.find((e: any) => e.key === "starter:7zip")).toMatchObject({ kind: "app", chocoPackage: "7zip" });
  });

  it("turns an app on for a company once, then sends it to any number of people and every machine", async () => {
    const add = await call("POST", "/items", { kind: "app", vendor: "Igor Pavlov", product: "7-Zip", category: "Baseline apps", chocoPackage: "7zip" });
    expect(add.body.item).toMatchObject({ kind: "app", quantity: 0, chocoPackage: "7zip" });
    expect((await call("POST", "/items", { kind: "app", vendor: "igor pavlov", product: "7-zip" })).status).toBe(409);
    expect((await call("POST", "/items", { kind: "app", vendor: "X", product: "Bad", chocoPackage: "rm -rf /" })).status).toBe(400);
    const itemId = add.body.item.id;

    // Not on yet: cannot go to a person.
    expect((await call("POST", "/clients/c1/assign", { itemId, targetType: "user", targetId: "u1" })).status).toBe(409);
    expect((await call("POST", "/allocate", { itemId, clientId: "c1" })).body).toMatchObject({ app: true });
    expect((await call("POST", "/allocate", { itemId, clientId: "c1" })).status).toBe(409);

    for (const targetId of ["u1", "u2"]) {
      expect((await call("POST", "/clients/c1/assign", { itemId, targetType: "user", targetId })).status).toBe(201);
    }
    expect((await call("POST", "/clients/c1/assign", { itemId, targetType: "device", targetId: "device:*" })).status).toBe(201);
    expect((await call("POST", "/clients/c1/assign", { itemId, targetType: "department", targetId: "d1" })).status).toBe(400);

    const company = (await call("GET", "/clients/c1")).body;
    expect(company.pool[0]).toMatchObject({ kind: "app", unlimited: true, held: 1, assigned: 3 });
    expect(company.devices[0]).toMatchObject({ id: "device:*", label: "Every machine" });
    expect(company.devices[0].licenses).toHaveLength(1);

    // Still in use: cannot be turned off for the company.
    expect((await call("POST", "/release", { itemId, clientId: "c1" })).status).toBe(409);
  });

  it("keeps counted licences off 'Every machine'", async () => {
    const itemId = (await call("POST", "/items", { vendor: "Huntress", product: "Managed EDR", quantity: 5 })).body.item.id;
    await call("POST", "/allocate", { itemId, clientId: "c1", quantity: 1 });
    expect((await call("POST", "/clients/c1/assign", { itemId, targetType: "device", targetId: "device:*" })).status).toBe(400);
  });
});

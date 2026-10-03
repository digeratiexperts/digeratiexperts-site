import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Memory mode: no database, so the store uses its in-process map.
vi.mock("./db", () => ({ db: null, dbReady: false }));

describe("manual records store", () => {
  beforeEach(async () => {
    const m = await import("./portalManualRecords");
    m._resetManualRecordsMemory();
  });

  it("keeps each company's records to that company and kind", async () => {
    const m = await import("./portalManualRecords");
    await m.createManualRecord({ clientId: "acme", kind: "vpn_device", data: { name: "Laptop" } });
    await m.createManualRecord({ clientId: "acme", kind: "shipment", data: { tracking: "1Z" } });
    await m.createManualRecord({ clientId: "globex", kind: "vpn_device", data: { name: "Desk" } });
    const acmeVpn = await m.listManualRecords("acme", "vpn_device");
    expect(acmeVpn.map((r) => r.data.name)).toEqual(["Laptop"]);
    expect((await m.listManualRecords("globex", "shipment")).length).toBe(0);
  });

  it("will not update or delete another company's record", async () => {
    const m = await import("./portalManualRecords");
    const rec = await m.createManualRecord({ clientId: "acme", kind: "shipment", data: { tracking: "1Z" } });
    expect(await m.updateManualRecord(rec.id, "globex", "shipment", { tracking: "X" })).toBeNull();
    expect(await m.deleteManualRecord(rec.id, "globex", "shipment")).toBe(false);
    expect(await m.updateManualRecord(rec.id, "acme", "vpn_device", { tracking: "X" })).toBeNull();
    const updated = await m.updateManualRecord(rec.id, "acme", "shipment", { tracking: "9400" });
    expect(updated?.data.tracking).toBe("9400");
    expect(await m.deleteManualRecord(rec.id, "acme", "shipment")).toBe(true);
  });

  it("validates the data shape and size", async () => {
    const m = await import("./portalManualRecords");
    expect(m.validateRecordData({ a: 1 })).toBeNull();
    expect(m.validateRecordData(null)).toMatch(/object/);
    expect(m.validateRecordData([1])).toMatch(/object/);
    expect(m.validateRecordData({ big: "x".repeat(9000) })).toMatch(/too large/);
  });
});

describe("manual records admin routes", () => {
  let server: Server;
  let base = "";

  beforeAll(async () => {
    const { registerManualRecordAdminRoutes } = await import("./portalManualRecords");
    const app = express();
    app.use(express.json());
    const asAdmin: express.RequestHandler = (req, _res, next) => {
      (req as any).user = { id: "u-admin", role: "admin" };
      next();
    };
    registerManualRecordAdminRoutes(app, { guards: [asAdmin] });
    server = createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  beforeEach(async () => {
    (await import("./portalManualRecords"))._resetManualRecordsMemory();
  });

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("creates, lists, updates and deletes a record for a named company", async () => {
    const created = await call("POST", "/api/portal/admin/manual-records", {
      clientId: "acme",
      kind: "shipment",
      data: { tracking: "1Z999", carrier: "UPS" },
    });
    expect(created.status).toBe(201);
    const { record } = await created.json();
    expect(record.createdBy).toBe("u-admin");

    const list = await (await call("GET", "/api/portal/admin/manual-records?clientId=acme&kind=shipment")).json();
    expect(list.records).toHaveLength(1);

    const patched = await call("PATCH", `/api/portal/admin/manual-records/${record.id}`, {
      clientId: "acme",
      kind: "shipment",
      data: { tracking: "1Z999", carrier: "UPS", status: "Delivered" },
    });
    expect((await patched.json()).record.data.status).toBe("Delivered");

    const wrongCompany = await call("DELETE", `/api/portal/admin/manual-records/${record.id}?clientId=globex&kind=shipment`);
    expect(wrongCompany.status).toBe(404);
    const deleted = await call("DELETE", `/api/portal/admin/manual-records/${record.id}?clientId=acme&kind=shipment`);
    expect(deleted.status).toBe(200);
  });

  it("refuses a missing company, an unknown kind and bad data", async () => {
    expect((await call("GET", "/api/portal/admin/manual-records?kind=shipment")).status).toBe(400);
    expect((await call("GET", "/api/portal/admin/manual-records?clientId=acme&kind=invoice")).status).toBe(400);
    expect((await call("POST", "/api/portal/admin/manual-records", { clientId: "acme", kind: "vpn_device", data: "x" })).status).toBe(400);
  });
});

describe("manual records bulk import", () => {
  let server: Server;
  let base = "";

  beforeAll(async () => {
    const { registerManualRecordAdminRoutes } = await import("./portalManualRecords");
    const app = express();
    app.use(express.json());
    const asAdmin: express.RequestHandler = (req, _res, next) => {
      (req as any).user = { id: "u-admin", role: "admin" };
      next();
    };
    registerManualRecordAdminRoutes(app, { guards: [asAdmin] });
    server = createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  beforeEach(async () => {
    (await import("./portalManualRecords"))._resetManualRecordsMemory();
  });

  const post = (body: unknown) =>
    fetch(`${base}/api/portal/admin/manual-records/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("imports every row for the named company and kind", async () => {
    const res = await post({
      clientId: "acme",
      kind: "shipment",
      rows: [
        { trackingNumber: "1Z1", carrier: "UPS" },
        { trackingNumber: "9400", carrier: "USPS" },
      ],
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.imported).toBe(2);
    expect(body.records.every((r: any) => r.clientId === "acme" && r.kind === "shipment" && r.createdBy === "u-admin")).toBe(true);
    const m = await import("./portalManualRecords");
    expect((await m.listManualRecords("acme", "shipment")).map((r) => r.data.trackingNumber).sort()).toEqual(["1Z1", "9400"]);
    expect(await m.listManualRecords("acme", "vpn_device")).toEqual([]);
    expect(await m.listManualRecords("globex", "shipment")).toEqual([]);
  });

  it("rejects the whole batch and names the invalid rows", async () => {
    const res = await post({
      clientId: "acme",
      kind: "vpn_device",
      rows: [{ name: "Laptop" }, "not an object", { name: "Desk" }, {}, { notes: "x".repeat(9000) }],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Nothing was imported. Invalid rows: 2, 4, 5");
    expect(body.rows).toEqual([
      { row: 2, error: "data must be an object" },
      { row: 4, error: "row is empty" },
      { row: 5, error: "data is too large" },
    ]);
    const m = await import("./portalManualRecords");
    expect(await m.listManualRecords("acme", "vpn_device")).toEqual([]);
  });

  it("refuses a missing company, an unknown kind, no rows and more than 500 rows", async () => {
    expect((await post({ kind: "shipment", rows: [{ a: "1" }] })).status).toBe(400);
    expect((await post({ clientId: "acme", kind: "invoice", rows: [{ a: "1" }] })).status).toBe(400);
    expect((await post({ clientId: "acme", kind: "shipment", rows: [] })).status).toBe(400);
    expect((await post({ clientId: "acme", kind: "shipment", rows: { a: "1" } })).status).toBe(400);
    const tooMany = await post({ clientId: "acme", kind: "shipment", rows: Array.from({ length: 501 }, (_, i) => ({ trackingNumber: `T${i}` })) });
    expect(tooMany.status).toBe(400);
    expect((await tooMany.json()).error).toMatch(/at most 500/);
    const m = await import("./portalManualRecords");
    expect(await m.listManualRecords("acme", "shipment")).toEqual([]);
  });

  it("accepts exactly 500 rows", async () => {
    const res = await post({ clientId: "acme", kind: "shipment", rows: Array.from({ length: 500 }, (_, i) => ({ trackingNumber: `T${i}` })) });
    expect(res.status).toBe(201);
    expect((await res.json()).imported).toBe(500);
  });
});

describe("manual records bulk import, database mode", () => {
  it("inserts all rows in one statement inside a transaction and passes a failure up", async () => {
    const inserted: unknown[][] = [];
    let fail = false;
    const tx = {
      insert: () => ({
        values: (vals: any[]) => ({
          returning: async () => {
            if (fail) throw new Error("insert or update on table violates foreign key constraint");
            inserted.push(vals);
            return vals.map((v, i) => ({ id: `id${i}`, ...v, createdAt: new Date(), updatedAt: new Date() }));
          },
        }),
      }),
    };
    const fakeDb = {
      execute: vi.fn(async () => undefined),
      transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    vi.resetModules();
    vi.doMock("./db", () => ({ db: fakeDb, dbReady: true }));
    const m = await import("./portalManualRecords");
    const recs = await m.createManualRecords({ clientId: "acme", kind: "shipment", rows: [{ trackingNumber: "A" }, { trackingNumber: "B" }], createdBy: "u1" });
    expect(fakeDb.transaction).toHaveBeenCalledTimes(1);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toEqual([
      { clientId: "acme", kind: "shipment", data: { trackingNumber: "A" }, createdBy: "u1" },
      { clientId: "acme", kind: "shipment", data: { trackingNumber: "B" }, createdBy: "u1" },
    ]);
    expect(recs.map((r) => r.data.trackingNumber)).toEqual(["A", "B"]);

    fail = true;
    await expect(m.createManualRecords({ clientId: "nope", kind: "shipment", rows: [{ trackingNumber: "C" }] })).rejects.toThrow();
    expect(inserted).toHaveLength(1);
    vi.doUnmock("./db");
    vi.resetModules();
  });
});

describe("manual records schema ownership (#253)", () => {
  it("only verifies the migrated table and never issues DDL", async () => {
    const statements: string[] = [];
    const fakeDb = {
      execute: vi.fn(async (q: any) => {
        statements.push(JSON.stringify(q));
        return { rows: [{ present: "portal_manual_records" }] };
      }),
      select: () => ({ from: () => ({ where: async () => [] }) }),
    };
    vi.resetModules();
    vi.doMock("./db", () => ({ db: fakeDb, dbReady: true }));
    const m = await import("./portalManualRecords");
    await m.listManualRecords("acme", "shipment");
    await m.listManualRecords("acme", "shipment");
    expect(fakeDb.execute).toHaveBeenCalledTimes(1);
    expect(statements.join(" ")).toMatch(/to_regclass/);
    expect(statements.join(" ")).not.toMatch(/CREATE|ALTER/i);
    vi.doUnmock("./db");
    vi.resetModules();
  });
});

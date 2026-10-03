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

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { faults, resetFakeDb, statements, tables } from "./tenantFilesFakeDb.testkit";

/**
 * #259: tenant file metadata must be durable in Postgres (portal_tenant_files),
 * tenant-scoped in SQL, and survive a process restart. The pg-proxy fake in
 * tenantFilesFakeDb.testkit.ts runs the real DatabaseStorage code paths.
 */

vi.mock("./db", async () => (await import("./tenantFilesFakeDb.testkit")).fakeDbModule());

async function freshStorage() {
  const { DatabaseStorage } = await import("./storage");
  return new DatabaseStorage();
}

const FILE = {
  fileName: "Onboarding.pdf",
  fileType: "document",
  category: "onboarding",
  description: "Welcome pack",
  fileUrl: "/objects/uploads/abc",
  uploadedBy: "admin-1",
};

describe("DatabaseStorage tenant files are durable (#259)", () => {
  beforeAll(async () => {
    // Resolve the (async) ./db mock before storage.ts first imports it.
    await import("./db");
  });

  beforeEach(() => {
    resetFakeDb();
  });

  it("writes metadata to portal_tenant_files and reads it back after a restart", async () => {
    const before = await freshStorage();
    const created = await before.createTenantFile({ clientId: "client-a", ...FILE });
    expect(created).toMatchObject({ clientId: "client-a", fileName: "Onboarding.pdf", fileUrl: "/objects/uploads/abc" });
    expect(statements.some((s) => s.startsWith('insert into "portal_tenant_files"'))).toBe(true);

    // Simulated restart: a brand-new storage instance with no process memory.
    const after = await freshStorage();
    const files = await after.getTenantFilesByClientId("client-a");
    expect(files.map((f: any) => f.id)).toEqual([created.id]);
  });

  it("listing is tenant-scoped in SQL", async () => {
    const s = await freshStorage();
    await s.createTenantFile({ clientId: "client-a", ...FILE });
    await s.createTenantFile({ clientId: "client-b", ...FILE, fileName: "B.pdf" });
    const a = await s.getTenantFilesByClientId("client-a");
    expect(a).toHaveLength(1);
    expect(a[0].clientId).toBe("client-a");
    const select = statements.find((q) => q.startsWith("select") && q.includes('"portal_tenant_files"'))!;
    expect(select).toContain('"portal_tenant_files"."client_id" = $1');
  });

  it("delete is tenant-scoped: another company's file id is not deleted", async () => {
    const s = await freshStorage();
    const bFile = await s.createTenantFile({ clientId: "client-b", ...FILE });
    expect(await s.deleteTenantFile(bFile.id, "client-a", "admin-1")).toBe(false);
    expect(await s.getTenantFilesByClientId("client-b")).toHaveLength(1);
  });

  it("delete is a soft delete that keeps the object path for deliberate cleanup", async () => {
    const s = await freshStorage();
    const f = await s.createTenantFile({ clientId: "client-a", ...FILE });
    expect(await s.deleteTenantFile(f.id, "client-a", "admin-1")).toBe(true);
    expect(await s.getTenantFilesByClientId("client-a")).toEqual([]);
    const row = tables.portal_tenant_files.find((r) => r.id === f.id)!;
    expect(row.file_url).toBe("/objects/uploads/abc");
    expect(row.deleted_at).toBeTruthy();
    expect(row.deleted_by).toBe("admin-1");
    // Second delete is a no-op, not a false success.
    expect(await s.deleteTenantFile(f.id, "client-a", "admin-1")).toBe(false);
  });

  it("a failed durable write throws instead of returning an in-memory success", async () => {
    const s = await freshStorage();
    faults.writes = true;
    await expect(s.createTenantFile({ clientId: "client-a", ...FILE })).rejects.toThrow();
    faults.writes = false;
    expect(await s.getTenantFilesByClientId("client-a")).toEqual([]);
  });
});

describe("MemStorage tenant file delete is tenant-scoped too", () => {
  it("refuses a cross-tenant delete", async () => {
    const { MemStorage } = await import("./storage");
    const m = new MemStorage();
    const f = await m.createTenantFile({ clientId: "client-b", ...FILE });
    expect(await m.deleteTenantFile(f.id, "client-a")).toBe(false);
    expect(await m.deleteTenantFile(f.id, "client-b")).toBe(true);
  });
});

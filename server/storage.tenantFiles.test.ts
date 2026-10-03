import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #259: tenant file metadata must be durable in Postgres (portal_tenant_files),
 * tenant-scoped in SQL, and survive a process restart. A tiny pg-proxy fake
 * interprets the SQL Drizzle actually generates for this table, so the real
 * DatabaseStorage code paths run; only the network round trip is replaced.
 */

type Row = Record<string, unknown>;
const tables: { portal_tenant_files: Row[] } = { portal_tenant_files: [] };
const statements: string[] = [];
let failWrites = false;

const COLS = [
  "id", "client_id", "file_name", "file_type", "file_url", "file_size", "mime_type", "description",
  "category", "is_public", "uploaded_by", "created_at", "updated_at", "deleted_at", "deleted_by",
];

function quoted(list: string): string[] {
  return [...list.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

function whereMatches(row: Row, where: string, params: unknown[]): boolean {
  for (const m of where.matchAll(/"portal_tenant_files"\."([a-z_]+)" = \$(\d+)/g)) {
    if (row[m[1]] !== params[Number(m[2]) - 1]) return false;
  }
  for (const m of where.matchAll(/"portal_tenant_files"\."([a-z_]+)" is null/g)) {
    if (row[m[1]] !== null && row[m[1]] !== undefined) return false;
  }
  return true;
}

function project(row: Row, returning: string) {
  return quoted(returning).map((c) => row[c] ?? null);
}

async function fakeDriver(sql: string, params: unknown[]) {
  statements.push(sql);
  if (!sql.includes('"portal_tenant_files"')) return { rows: [] }; // demo seeding etc.
  if (sql.startsWith("insert")) {
    if (failWrites) throw new Error("connection terminated");
    const [, cols, vals, returning] = sql.match(/\(([^)]*)\) values \(([^)]*)\) returning (.*)$/)!;
    const names = quoted(cols);
    const tokens = vals.split(",").map((t) => t.trim());
    const row: Row = Object.fromEntries(COLS.map((c) => [c, null]));
    names.forEach((name, i) => {
      const token = tokens[i];
      if (token.startsWith("$")) row[name] = params[Number(token.slice(1)) - 1];
    });
    row.created_at = row.created_at ?? new Date().toISOString();
    row.updated_at = row.updated_at ?? row.created_at;
    row.is_public = row.is_public ?? true;
    tables.portal_tenant_files.push(row);
    return { rows: [project(row, returning)] };
  }
  if (sql.startsWith("select")) {
    const [, cols, where] = sql.match(/^select (.*) from "portal_tenant_files" where (.*?)( order by .*)?$/)!;
    const rows = tables.portal_tenant_files.filter((r) => whereMatches(r, where, params));
    return { rows: rows.map((r) => project(r, cols)) };
  }
  if (sql.startsWith("update")) {
    if (failWrites) throw new Error("connection terminated");
    const [, sets, where, returning] = sql.match(/ set (.*) where (.*) returning (.*)$/)!;
    const hits = tables.portal_tenant_files.filter((r) => whereMatches(r, where, params));
    for (const r of hits) {
      for (const m of sets.matchAll(/"([a-z_]+)" = \$(\d+)/g)) r[m[1]] = params[Number(m[2]) - 1];
    }
    return { rows: hits.map((r) => project(r, returning)) };
  }
  throw new Error(`Unhandled fake SQL: ${sql}`);
}

vi.mock("./db", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const db = drizzle(async (sql, params) => fakeDriver(sql, params));
  return { db, pool: null, dbReady: true, initPromise: Promise.resolve(true), initAttempted: true, dbType: "postgresql" };
});

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
    tables.portal_tenant_files = [];
    statements.length = 0;
    failWrites = false;
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
    failWrites = true;
    await expect(s.createTenantFile({ clientId: "client-a", ...FILE })).rejects.toThrow();
    failWrites = false;
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

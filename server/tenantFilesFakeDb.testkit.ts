/**
 * Test kit (#259): a tiny pg-proxy fake that interprets the SQL Drizzle
 * actually generates for portal_tenant_files, so the real DatabaseStorage
 * code paths run and only the network round trip is replaced. Shared by
 * storage.tenantFiles.test.ts and portalTenantFileRoutes.test.ts; each test
 * file mocks "./db" with `fakeDbModule()`.
 */
type Row = Record<string, unknown>;
export const tables: { portal_tenant_files: Row[] } = { portal_tenant_files: [] };
export const statements: string[] = [];
export const faults = { writes: false, reads: false };

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

export async function fakeDriver(sql: string, params: unknown[]) {
  statements.push(sql);
  if (!sql.includes('"portal_tenant_files"')) return { rows: [] }; // demo seeding etc.
  if (sql.startsWith("insert")) {
    if (faults.writes) throw new Error("connection terminated");
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
    if (faults.reads) throw new Error("connection terminated");
    const [, cols, where] = sql.match(/^select (.*) from "portal_tenant_files" where (.*?)( order by .*)?$/)!;
    const rows = tables.portal_tenant_files.filter((r) => whereMatches(r, where, params));
    return { rows: rows.map((r) => project(r, cols)) };
  }
  if (sql.startsWith("update")) {
    if (faults.writes) throw new Error("connection terminated");
    const [, sets, where, returning] = sql.match(/ set (.*) where (.*) returning (.*)$/)!;
    const hits = tables.portal_tenant_files.filter((r) => whereMatches(r, where, params));
    for (const r of hits) {
      for (const m of sets.matchAll(/"([a-z_]+)" = \$(\d+)/g)) r[m[1]] = params[Number(m[2]) - 1];
    }
    return { rows: hits.map((r) => project(r, returning)) };
  }
  throw new Error(`Unhandled fake SQL: ${sql}`);
}


export async function fakeDbModule() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const db = drizzle(async (sql, params) => fakeDriver(sql, params as unknown[]));
  return { db, pool: null, dbReady: true, initPromise: Promise.resolve(true), initAttempted: true, dbType: "postgresql" };
}

export function resetFakeDb() {
  tables.portal_tenant_files = [];
  statements.length = 0;
  faults.writes = false;
  faults.reads = false;
}

import type { Express, Request, RequestHandler, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { portalManualRecords } from "@shared/schema";

/**
 * Records DE staff enter by hand for a client company, behind the portal's
 * "manual" data sources (server/portalIntegrations.ts):
 *
 *   vpn_device  a WireGuard / OpenVPN device or profile for the VPN Access page
 *   shipment    a staff-entered tracking number for the Ship Center page
 *   site        a client site / Site Location Code (LID) and its address, for
 *               the service request forms: { code, name?, street, city, state, country, zip }
 *   computer_asset  a computer assigned to a client user, for the Return Computer
 *               form: { assetTag, serialNumber?, model?, assignedUserId }
 *   announcement  a Self-Service carousel slide for this client:
 *               { title, body, ctaLabel, ctaHref (a /portal/... path), art?, startsOn?, endsOn? }
 *
 * Postgres when the database is up (table owned by
 * migrations/0003_portal_manual_records.sql, never created at runtime); an in-process map otherwise, so
 * the dev server's memory mode can exercise the same flow.
 */

export const MANUAL_RECORD_KINDS = ["vpn_device", "shipment", "site", "computer_asset", "announcement"] as const;
export type ManualRecordKind = (typeof MANUAL_RECORD_KINDS)[number];

export type ManualRecord = {
  id: string;
  clientId: string;
  kind: ManualRecordKind;
  data: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

const MAX_DATA_BYTES = 8 * 1024;

export function isManualRecordKind(v: unknown): v is ManualRecordKind {
  return typeof v === "string" && (MANUAL_RECORD_KINDS as readonly string[]).includes(v);
}

/** A plain JSON object of at most 8 KB, else an error message. */
export function validateRecordData(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "data must be an object";
  let size = 0;
  try {
    size = Buffer.byteLength(JSON.stringify(data), "utf8");
  } catch {
    return "data must be JSON";
  }
  if (size > MAX_DATA_BYTES) return "data is too large";
  return null;
}

// ---------- storage ----------

const memory = new Map<string, ManualRecord>();
let schemaVerified = false;

/**
 * Verify (never create) the migrated table (#253). The schema is owned by
 * migrations/0003_portal_manual_records.sql, applied by `npm run db:migrate`
 * before a release is activated. A missing table is logged once per attempt
 * with the remedy; the query that follows then fails as it would for any
 * unprovisioned table. Success is cached.
 */
async function ensureSchema() {
  if (schemaVerified || !dbReady || !db) return;
  try {
    const result: any = await db.execute(sql`SELECT to_regclass('public.portal_manual_records') AS present`);
    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (row && !row.present) {
      console.error(
        "[manual-records] required table portal_manual_records is missing; run `npm run db:migrate` (migrations/0003_portal_manual_records.sql).",
      );
      return;
    }
    schemaVerified = true;
  } catch (error: any) {
    console.warn("[manual-records] could not verify portal_manual_records:", error?.message || error);
  }
}

function toRecord(row: any): ManualRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    kind: row.kind,
    data: (row.data ?? {}) as Record<string, unknown>,
    createdBy: row.createdBy ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function listManualRecords(clientId: string, kind: ManualRecordKind): Promise<ManualRecord[]> {
  if (dbReady && db) {
    await ensureSchema();
    const rows = await db
      .select()
      .from(portalManualRecords)
      .where(and(eq(portalManualRecords.clientId, clientId), eq(portalManualRecords.kind, kind)));
    return rows.map(toRecord).sort((a: ManualRecord, b: ManualRecord) => b.createdAt.localeCompare(a.createdAt));
  }
  return [...memory.values()]
    .filter((r) => r.clientId === clientId && r.kind === kind)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createManualRecord(input: {
  clientId: string;
  kind: ManualRecordKind;
  data: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<ManualRecord> {
  if (dbReady && db) {
    await ensureSchema();
    const [row] = await db
      .insert(portalManualRecords)
      .values({ clientId: input.clientId, kind: input.kind, data: input.data, createdBy: input.createdBy ?? null })
      .returning();
    return toRecord(row);
  }
  const now = new Date().toISOString();
  const rec: ManualRecord = {
    id: `mr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
    clientId: input.clientId,
    kind: input.kind,
    data: input.data,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  memory.set(rec.id, rec);
  return rec;
}

export const MAX_IMPORT_ROWS = 500;

/**
 * Inserts every row for one company and kind, or none. Callers validate the
 * rows first (validateImportRows). Postgres: one multi-row INSERT inside a
 * transaction (both drivers in server/db.ts, node-postgres and Neon's
 * WebSocket Pool, support db.transaction), so a failure part-way, such as the
 * company row not existing, leaves nothing behind. Memory mode inserts
 * synchronously after validation, so it is all-or-nothing as well.
 */
export async function createManualRecords(input: {
  clientId: string;
  kind: ManualRecordKind;
  rows: Record<string, unknown>[];
  createdBy?: string | null;
}): Promise<ManualRecord[]> {
  if (input.rows.length === 0) return [];
  const createdBy = input.createdBy ?? null;
  if (dbReady && db) {
    await ensureSchema();
    const values = input.rows.map((data) => ({ clientId: input.clientId, kind: input.kind, data, createdBy }));
    const inserted = await db.transaction(async (tx: any) => tx.insert(portalManualRecords).values(values).returning());
    return (inserted as any[]).map(toRecord);
  }
  const now = new Date().toISOString();
  const recs: ManualRecord[] = input.rows.map((data, i) => ({
    id: `mr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}${i.toString(36)}`,
    clientId: input.clientId,
    kind: input.kind,
    data,
    createdBy,
    createdAt: now,
    updatedAt: now,
  }));
  for (const rec of recs) memory.set(rec.id, rec);
  return recs;
}

export type ImportRowError = { row: number; error: string };

/**
 * Checks an import batch: an array of 1..MAX_IMPORT_ROWS rows, each passing
 * validateRecordData and holding at least one value. Row numbers are 1-based
 * positions in `rows`. Returns the batch-level error or the per-row errors.
 */
export function validateImportRows(rows: unknown): { error: string } | { rowErrors: ImportRowError[] } | null {
  if (!Array.isArray(rows)) return { error: "rows must be an array" };
  if (rows.length === 0) return { error: "rows is empty" };
  if (rows.length > MAX_IMPORT_ROWS) return { error: `at most ${MAX_IMPORT_ROWS} rows per import` };
  const rowErrors: ImportRowError[] = [];
  rows.forEach((row, i) => {
    const bad = validateRecordData(row);
    if (bad) rowErrors.push({ row: i + 1, error: bad });
    else if (!Object.values(row as Record<string, unknown>).some((v) => v !== null && v !== undefined && String(v).trim() !== "")) {
      rowErrors.push({ row: i + 1, error: "row is empty" });
    }
  });
  return rowErrors.length ? { rowErrors } : null;
}

/** Updates only a record of that company and kind; null when there is none. */
export async function updateManualRecord(
  id: string,
  clientId: string,
  kind: ManualRecordKind,
  data: Record<string, unknown>,
): Promise<ManualRecord | null> {
  if (dbReady && db) {
    await ensureSchema();
    const [row] = await db
      .update(portalManualRecords)
      .set({ data, updatedAt: new Date() })
      .where(
        and(eq(portalManualRecords.id, id), eq(portalManualRecords.clientId, clientId), eq(portalManualRecords.kind, kind)),
      )
      .returning();
    return row ? toRecord(row) : null;
  }
  const rec = memory.get(id);
  if (!rec || rec.clientId !== clientId || rec.kind !== kind) return null;
  const next = { ...rec, data, updatedAt: new Date().toISOString() };
  memory.set(id, next);
  return next;
}

export async function deleteManualRecord(id: string, clientId: string, kind: ManualRecordKind): Promise<boolean> {
  if (dbReady && db) {
    await ensureSchema();
    const rows = await db
      .delete(portalManualRecords)
      .where(
        and(eq(portalManualRecords.id, id), eq(portalManualRecords.clientId, clientId), eq(portalManualRecords.kind, kind)),
      )
      .returning({ id: portalManualRecords.id });
    return rows.length > 0;
  }
  const rec = memory.get(id);
  if (!rec || rec.clientId !== clientId || rec.kind !== kind) return false;
  memory.delete(id);
  return true;
}

/** Test seam: empty the in-memory store. */
export function _resetManualRecordsMemory() {
  memory.clear();
}

// ---------- admin routes ----------

export const MANUAL_RECORDS_PATH = "/api/portal/admin/manual-records";
export const MANUAL_RECORDS_IMPORT_PATH = `${MANUAL_RECORDS_PATH}/import`;

type AdminRequest = Request & { user?: { id?: string; role?: string | null } };

function readTarget(req: Request): { clientId: string; kind: ManualRecordKind } | { error: string } {
  const src = { ...(req.query as Record<string, unknown>), ...((req.body as Record<string, unknown>) || {}) };
  const clientId = typeof src.clientId === "string" ? src.clientId.trim() : "";
  if (!clientId) return { error: "clientId required" };
  if (!isManualRecordKind(src.kind)) return { error: "kind must be one of: " + MANUAL_RECORD_KINDS.join(", ") };
  return { clientId, kind: src.kind };
}

/**
 * DE-admin only (the caller passes authMiddleware + requireAdmin): staff enter
 * records for a named client company. Clients read them through each page's
 * own endpoint, scoped to their company.
 */
export function registerManualRecordAdminRoutes(app: Express, opts: { guards: RequestHandler[] }) {
  app.get(MANUAL_RECORDS_PATH, ...opts.guards, async (req: Request, res: Response) => {
    const t = readTarget(req);
    if ("error" in t) return res.status(400).json({ error: t.error });
    res.json({ success: true, records: await listManualRecords(t.clientId, t.kind) });
  });

  app.post(MANUAL_RECORDS_PATH, ...opts.guards, async (req: AdminRequest, res: Response) => {
    const t = readTarget(req);
    if ("error" in t) return res.status(400).json({ error: t.error });
    const bad = validateRecordData(req.body?.data);
    if (bad) return res.status(400).json({ error: bad });
    const record = await createManualRecord({ ...t, data: req.body.data, createdBy: req.user?.id ?? null });
    res.status(201).json({ success: true, record });
  });

  // Bulk import (CSV pasted on the VPN / Ship Center page, parsed in the
  // browser): body { clientId, kind, rows: object[] }, at most 500 rows.
  // All or nothing: one invalid row rejects the batch with its row number.
  // Note: the app-wide express.json() keeps its default 100 kB body limit, so
  // a larger batch is refused with 413 before it reaches this handler.
  app.post(MANUAL_RECORDS_IMPORT_PATH, ...opts.guards, async (req: AdminRequest, res: Response) => {
    const t = readTarget(req);
    if ("error" in t) return res.status(400).json({ error: t.error });
    const checked = validateImportRows(req.body?.rows);
    if (checked && "error" in checked) return res.status(400).json({ error: checked.error });
    if (checked) {
      const rows = checked.rowErrors.map((e) => e.row);
      return res.status(400).json({
        error: `Nothing was imported. Invalid row${rows.length === 1 ? "" : "s"}: ${rows.slice(0, 20).join(", ")}${rows.length > 20 ? ` and ${rows.length - 20} more` : ""}`,
        rows: checked.rowErrors.slice(0, 50),
      });
    }
    try {
      const records = await createManualRecords({ ...t, rows: req.body.rows, createdBy: req.user?.id ?? null });
      res.status(201).json({ success: true, imported: records.length, records });
    } catch (err) {
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
      console.warn(`[manual-records] import failed for client ${t.clientId} (${t.kind}): ${reason}`);
      res.status(500).json({ error: "Nothing was imported. Try again." });
    }
  });

  app.patch(`${MANUAL_RECORDS_PATH}/:id`, ...opts.guards, async (req: Request, res: Response) => {
    const t = readTarget(req);
    if ("error" in t) return res.status(400).json({ error: t.error });
    const bad = validateRecordData(req.body?.data);
    if (bad) return res.status(400).json({ error: bad });
    const record = await updateManualRecord(req.params.id, t.clientId, t.kind, req.body.data);
    if (!record) return res.status(404).json({ error: "Record not found" });
    res.json({ success: true, record });
  });

  app.delete(`${MANUAL_RECORDS_PATH}/:id`, ...opts.guards, async (req: Request, res: Response) => {
    const t = readTarget(req);
    if ("error" in t) return res.status(400).json({ error: t.error });
    const ok = await deleteManualRecord(req.params.id, t.clientId, t.kind);
    if (!ok) return res.status(404).json({ error: "Record not found" });
    res.json({ success: true });
  });
}

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
 *
 * Postgres when the database is up (table created on first use, mirrored by
 * migrations/0003_portal_manual_records.sql); an in-process map otherwise, so
 * the dev server's memory mode can exercise the same flow.
 */

export const MANUAL_RECORD_KINDS = ["vpn_device", "shipment"] as const;
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
let schemaReady = false;

async function ensureSchema() {
  if (schemaReady || !dbReady || !db) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS portal_manual_records (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      client_id varchar NOT NULL REFERENCES portal_clients(id) ON DELETE CASCADE,
      kind text NOT NULL,
      data jsonb NOT NULL,
      created_by varchar,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS portal_manual_records_client_kind_idx
      ON portal_manual_records (client_id, kind)
  `);
  schemaReady = true;
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

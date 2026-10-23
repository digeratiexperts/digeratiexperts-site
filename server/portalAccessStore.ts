import { and, desc, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, dbReady } from "./db";
import { portalAuditLog, portalClientEntitlements, portalTenantFiles } from "@shared/schema";
import type { AccountClass, EntitlementKey } from "@shared/permissions";
import { ENTITLEMENT_KEYS } from "@shared/permissions";

/**
 * Lane A (Wave 1): purchased-service entitlements and the break-glass / DE staff
 * action audit (migrations/0020_portal_roles_nav_foundation.sql). Postgres when the
 * database is up, memory otherwise — the dev server and route tests follow the
 * same pattern as groupRequestStore.
 *
 * Entitlement default is OFF: a company with no row holds no entitlement, so the
 * matching menu item stays hidden (lane-a-update-2.md §3).
 */

const useDb = () => Boolean(dbReady && db);

export type EntitlementRecord = {
  id: string;
  clientId: string;
  entitlement: EntitlementKey;
  status: "active" | "ended";
  source: string;
  grantedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditEntry = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  accountClass?: AccountClass | string | null;
  breakGlass?: boolean;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  clientId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown> | null;
};

const memEntitlements = new Map<string, EntitlementRecord>();
const memAudit: Array<AuditEntry & { id: string; at: string }> = [];

export function _resetPortalAccessMemory(): void {
  memEntitlements.clear();
  memAudit.length = 0;
}

function isEntitlementKey(value: unknown): value is EntitlementKey {
  return typeof value === "string" && (ENTITLEMENT_KEYS as readonly string[]).includes(value);
}

function toRecord(row: any): EntitlementRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    entitlement: row.entitlement,
    status: row.status === "ended" ? "ended" : "active",
    source: row.source || "de_manual",
    grantedBy: row.grantedBy ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/** Every entitlement record for a company (including ended ones). */
export async function listEntitlementRecords(clientId: string): Promise<EntitlementRecord[]> {
  if (!clientId) return [];
  if (useDb()) {
    const rows = await db!
      .select()
      .from(portalClientEntitlements)
      .where(eq(portalClientEntitlements.clientId, clientId))
      .orderBy(portalClientEntitlements.entitlement);
    return rows.map(toRecord);
  }
  return [...memEntitlements.values()]
    .filter((r) => r.clientId === clientId)
    .sort((a, b) => a.entitlement.localeCompare(b.entitlement));
}

/** The entitlements a company currently holds. Absent or ended = not held. */
export async function getEntitlements(clientId: string | null | undefined): Promise<EntitlementKey[]> {
  if (!clientId) return [];
  const records = await listEntitlementRecords(clientId);
  return records.filter((r) => r.status === "active").map((r) => r.entitlement);
}

/** Grant (status "active") or end (status "ended") one entitlement. Upsert per company+key. */
export async function setEntitlement(input: {
  clientId: string;
  entitlement: EntitlementKey;
  status: "active" | "ended";
  grantedBy?: string | null;
}): Promise<EntitlementRecord> {
  if (!isEntitlementKey(input.entitlement)) throw new Error("Unknown entitlement");
  const status = input.status === "ended" ? "ended" : "active";
  const grantedBy = input.grantedBy ?? null;
  const now = new Date();
  if (useDb()) {
    const [row] = await db!
      .insert(portalClientEntitlements)
      .values({
        clientId: input.clientId,
        entitlement: input.entitlement,
        status,
        source: "de_manual",
        grantedBy,
      })
      .onConflictDoUpdate({
        target: [portalClientEntitlements.clientId, portalClientEntitlements.entitlement],
        set: { status, grantedBy, updatedAt: now },
      })
      .returning();
    return toRecord(row);
  }
  const key = `${input.clientId}:${input.entitlement}`;
  const existing = memEntitlements.get(key);
  const record: EntitlementRecord = {
    id: existing?.id || randomUUID(),
    clientId: input.clientId,
    entitlement: input.entitlement,
    status,
    source: existing?.source || "de_manual",
    grantedBy,
    createdAt: existing?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };
  memEntitlements.set(key, record);
  return record;
}

/**
 * Nav datum `sharedFiles`: at least one live file DE has shared with the company.
 * Without a database there are no durable files, so it reports false (hidden).
 * Lane B refines this to per-user sharing when per-user shares exist.
 */
export async function hasSharedFiles(clientId: string | null | undefined): Promise<boolean> {
  if (!clientId || !useDb()) return false;
  const rows = await db!
    .select({ id: portalTenantFiles.id })
    .from(portalTenantFiles)
    .where(and(eq(portalTenantFiles.clientId, clientId), isNull(portalTenantFiles.deletedAt)))
    .limit(200);
  return rows.some((r: { id: string }) => Boolean(r.id));
}

/** Write one audit row. Throws when a durable write fails — callers that guard
 * break-glass actions fail closed ("no audit row, no action").
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const row = {
    actorUserId: entry.actorUserId ?? null,
    actorEmail: entry.actorEmail ?? null,
    accountClass: entry.accountClass ?? null,
    breakGlass: entry.breakGlass ?? false,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    clientId: entry.clientId ?? null,
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ?? null,
    meta: entry.meta ?? null,
  };
  if (useDb()) {
    await db!.insert(portalAuditLog).values(row);
    return;
  }
  memAudit.push({ ...row, id: randomUUID(), at: new Date().toISOString() });
}

/** Newest first. Used by tests and the break-glass review surface. */
export async function recentAudit(limit = 50): Promise<Array<AuditEntry & { id: string; at: string }>> {
  if (useDb()) {
    const rows = await db!
      .select()
      .from(portalAuditLog)
      .orderBy(desc(portalAuditLog.at))
      .limit(limit);
    return rows.map((r: any) => ({
      id: r.id,
      at: new Date(r.at).toISOString(),
      actorUserId: r.actorUserId ?? null,
      actorEmail: r.actorEmail ?? null,
      accountClass: r.accountClass ?? null,
      breakGlass: !!r.breakGlass,
      action: r.action,
      targetType: r.targetType ?? null,
      targetId: r.targetId ?? null,
      clientId: r.clientId ?? null,
      ip: r.ip ?? null,
      userAgent: r.userAgent ?? null,
      meta: r.meta ?? null,
    }));
  }
  return [...memAudit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Count audit rows written in the current process's memory (tests only). */
export function _auditMemorySize(): number {
  return memAudit.length;
}

export async function auditRowsFor(actorUserId: string, limit = 50): Promise<Array<AuditEntry & { id: string; at: string }>> {
  const rows = await recentAudit(1000);
  return rows.filter((r) => r.actorUserId === actorUserId).slice(0, limit);
}

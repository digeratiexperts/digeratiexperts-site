import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import type {
  LicenseAllocation,
  LicenseAssignment,
  LicensePoolItem,
  SeatSource,
  AssignmentTarget,
} from "@shared/licenseBoard";

/**
 * License patch bay storage. Postgres when the database is up
 * (migrations/0015_license_patch_bay.sql); memory otherwise, for the dev
 * server and tests. One row per seat (shared/licenseBoard.ts).
 */

const useDb = () => Boolean(dbReady && db);
const mem = {
  items: new Map<string, LicensePoolItem>(),
  allocations: new Map<string, LicenseAllocation>(),
  assignments: new Map<string, LicenseAssignment>(),
};

export function _resetLicenseBoardMemory() {
  mem.items.clear();
  mem.allocations.clear();
  mem.assignments.clear();
}

let verified = false;
async function ensureSchema(): Promise<boolean> {
  if (!useDb()) return false;
  if (verified) return true;
  try {
    const result: any = await db.execute(sql`SELECT to_regclass('public.license_pool_items') AS present`);
    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (row && !row.present) {
      console.error("[license-board] table license_pool_items is missing; run `npm run db:migrate` (migrations/0015_license_patch_bay.sql).");
      return false;
    }
    verified = true;
    return true;
  } catch (error: any) {
    console.warn("[license-board] could not verify tables:", error?.message || error);
    return false;
  }
}

const rows = (result: any): any[] => (Array.isArray(result) ? result : result?.rows ?? []);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

const toItem = (r: any): LicensePoolItem => ({
  id: String(r.id),
  vendor: String(r.vendor),
  product: String(r.product),
  catalogKey: r.catalog_key ? String(r.catalog_key) : null,
  quantity: Number(r.quantity) || 0,
  createdAt: iso(r.created_at),
});
const toAllocation = (r: any): LicenseAllocation => ({
  id: String(r.id),
  itemId: String(r.item_id),
  clientId: String(r.client_id),
  source: r.source === "order" ? "order" : "pool",
  createdAt: iso(r.created_at),
});
const toAssignment = (r: any): LicenseAssignment => ({
  id: String(r.id),
  clientId: String(r.client_id),
  itemId: String(r.item_id),
  targetType: r.target_type as AssignmentTarget,
  targetId: String(r.target_id),
  targetLabel: String(r.target_label),
  viaDepartmentId: r.via_department_id ? String(r.via_department_id) : null,
  createdAt: iso(r.created_at),
});

export async function listPoolItems(): Promise<LicensePoolItem[]> {
  if (await ensureSchema()) {
    return rows(await db.execute(sql`SELECT * FROM license_pool_items ORDER BY vendor, product`)).map(toItem);
  }
  return Array.from(mem.items.values()).sort((a, b) => `${a.vendor} ${a.product}`.localeCompare(`${b.vendor} ${b.product}`));
}

export async function getPoolItem(id: string): Promise<LicensePoolItem | null> {
  if (await ensureSchema()) {
    const [r] = rows(await db.execute(sql`SELECT * FROM license_pool_items WHERE id = ${id} LIMIT 1`));
    return r ? toItem(r) : null;
  }
  return mem.items.get(id) ?? null;
}

export async function createPoolItem(input: Omit<LicensePoolItem, "id" | "createdAt">): Promise<LicensePoolItem> {
  const item: LicensePoolItem = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  if (await ensureSchema()) {
    await db.execute(sql`
      INSERT INTO license_pool_items (id, vendor, product, catalog_key, quantity, created_at)
      VALUES (${item.id}, ${item.vendor}, ${item.product}, ${item.catalogKey}, ${item.quantity}, ${new Date(item.createdAt)})
    `);
  } else {
    mem.items.set(item.id, item);
  }
  return item;
}

export async function updatePoolItem(id: string, patch: Partial<Pick<LicensePoolItem, "vendor" | "product" | "quantity">>): Promise<LicensePoolItem | null> {
  const current = await getPoolItem(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  if (await ensureSchema()) {
    await db.execute(sql`
      UPDATE license_pool_items SET vendor = ${next.vendor}, product = ${next.product}, quantity = ${next.quantity}
      WHERE id = ${id}
    `);
  } else {
    mem.items.set(id, next);
  }
  return next;
}

export async function deletePoolItem(id: string): Promise<void> {
  if (await ensureSchema()) {
    await db.execute(sql`DELETE FROM license_pool_items WHERE id = ${id}`);
  } else {
    mem.items.delete(id);
  }
}

export async function listAllocations(clientId?: string): Promise<LicenseAllocation[]> {
  if (await ensureSchema()) {
    const r = clientId
      ? await db.execute(sql`SELECT * FROM license_allocations WHERE client_id = ${clientId}`)
      : await db.execute(sql`SELECT * FROM license_allocations`);
    return rows(r).map(toAllocation);
  }
  const all = Array.from(mem.allocations.values());
  return clientId ? all.filter((a) => a.clientId === clientId) : all;
}

export async function addAllocations(
  input: { itemId: string; clientId: string; source: SeatSource; count: number },
  createdBy: string | null,
): Promise<LicenseAllocation[]> {
  const out: LicenseAllocation[] = [];
  for (let i = 0; i < input.count; i++) {
    const a: LicenseAllocation = {
      id: randomUUID(),
      itemId: input.itemId,
      clientId: input.clientId,
      source: input.source,
      createdAt: new Date().toISOString(),
    };
    if (await ensureSchema()) {
      await db.execute(sql`
        INSERT INTO license_allocations (id, item_id, client_id, source, created_by, created_at)
        VALUES (${a.id}, ${a.itemId}, ${a.clientId}, ${a.source}, ${createdBy}, ${new Date(a.createdAt)})
      `);
    } else {
      mem.allocations.set(a.id, a);
    }
    out.push(a);
  }
  return out;
}

export async function deleteAllocation(id: string): Promise<void> {
  if (await ensureSchema()) {
    await db.execute(sql`DELETE FROM license_allocations WHERE id = ${id}`);
  } else {
    mem.allocations.delete(id);
  }
}

export async function listAssignments(clientId?: string): Promise<LicenseAssignment[]> {
  if (await ensureSchema()) {
    const r = clientId
      ? await db.execute(sql`SELECT * FROM license_assignments WHERE client_id = ${clientId} ORDER BY created_at`)
      : await db.execute(sql`SELECT * FROM license_assignments ORDER BY created_at`);
    return rows(r).map(toAssignment);
  }
  const all = Array.from(mem.assignments.values());
  return clientId ? all.filter((a) => a.clientId === clientId) : all;
}

export async function addAssignment(
  input: Omit<LicenseAssignment, "id" | "createdAt">,
  createdBy: string | null,
): Promise<LicenseAssignment> {
  const a: LicenseAssignment = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  if (await ensureSchema()) {
    await db.execute(sql`
      INSERT INTO license_assignments
        (id, client_id, item_id, target_type, target_id, target_label, via_department_id, created_by, created_at)
      VALUES (${a.id}, ${a.clientId}, ${a.itemId}, ${a.targetType}, ${a.targetId}, ${a.targetLabel},
              ${a.viaDepartmentId}, ${createdBy}, ${new Date(a.createdAt)})
    `);
  } else {
    mem.assignments.set(a.id, a);
  }
  return a;
}

export async function deleteAssignment(id: string): Promise<void> {
  if (await ensureSchema()) {
    await db.execute(sql`DELETE FROM license_assignments WHERE id = ${id}`);
  } else {
    mem.assignments.delete(id);
  }
}

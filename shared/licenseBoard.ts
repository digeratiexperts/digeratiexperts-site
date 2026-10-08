/**
 * License patch bay (DE admin): DE's pool of vendor licences, the seats each
 * client company holds, and who or what inside the company uses them.
 *
 *   DE pool item ──allocation──▶ company ──assignment──▶ department ──▶ person
 *                                                    └──────────────▶ person / device
 *
 * One row per seat throughout, so a count is a count of rows and releasing a
 * seat is deleting one row. A seat dropped on a company comes from the DE
 * pool while the pool has free seats; the rest are recorded "to order" from
 * the vendor. Nothing here provisions anything at the vendor: it is DE's
 * record of what is held and where it is meant to go.
 */

/**
 * "license": counted seats DE buys from a vendor.
 * "app": software a company is allowed to run (LOB apps, a PDF reader, an
 * agent). No seat count: dropping it on a company turns it on there, and it
 * can then go to any number of people and machines.
 */
export type PoolItemKind = "license" | "app";

export type LicensePoolItem = {
  id: string;
  kind: PoolItemKind;
  vendor: string;
  product: string;
  /** Shelf category, e.g. "Productivity", "Security", "Baseline apps". */
  category: string;
  /** shared/licensing LICENSE_CATALOG key when the product is in the catalog. */
  catalogKey: string | null;
  /** The vendor or Hub SKU code, when there is one. */
  sku: string | null;
  /** Chocolatey package id (apps): what JumpCloud Software Management installs on Windows. */
  chocoPackage: string | null;
  /** Seats DE holds with the vendor (licences only; 0 for apps). */
  quantity: number;
  createdAt: string;
};

/** A machine target that stands for every machine in the company (apps only). */
export const EVERY_MACHINE_ID = "device:*";
export const EVERY_MACHINE_LABEL = "Every machine";

export type SeatSource = "pool" | "order";

export type LicenseAllocation = {
  id: string;
  itemId: string;
  clientId: string;
  source: SeatSource;
  createdAt: string;
};

export type AssignmentTarget = "department" | "user" | "device";

export type LicenseAssignment = {
  id: string;
  clientId: string;
  itemId: string;
  targetType: AssignmentTarget;
  targetId: string;
  /** Display name kept with the row (devices have no directory record). */
  targetLabel: string;
  /** Set when a person's seat came from a department's seats; unassigning returns it there. */
  viaDepartmentId: string | null;
  createdAt: string;
};

export type PoolItemSummary = LicensePoolItem & {
  /** Seats handed to companies out of DE's pool. */
  allocated: number;
  /** Seats companies hold that DE still has to buy. */
  toOrder: number;
  /** DE pool seats nobody holds yet. */
  free: number;
};

export function summarizePool(items: LicensePoolItem[], allocations: LicenseAllocation[]): PoolItemSummary[] {
  return items.map((item) => {
    if (item.kind === "app") {
      const companies = allocations.filter((a) => a.itemId === item.id).length;
      return { ...item, allocated: companies, toOrder: 0, free: 0 };
    }
    let allocated = 0;
    let toOrder = 0;
    for (const a of allocations) {
      if (a.itemId !== item.id) continue;
      if (a.source === "pool") allocated++;
      else toOrder++;
    }
    return { ...item, allocated, toOrder, free: Math.max(0, item.quantity - allocated) };
  });
}

/** How many of `wanted` seats come out of DE's pool, and how many must be ordered. */
export function planAllocation(poolFree: number, wanted: number): { fromPool: number; toOrder: number } {
  const n = Math.max(0, Math.floor(wanted));
  const fromPool = Math.min(Math.max(0, poolFree), n);
  return { fromPool, toOrder: n - fromPool };
}

export type CompanySeatSummary = {
  itemId: string;
  /** Seats the company holds (from the pool and to order). */
  held: number;
  toOrder: number;
  /** Seats given to departments, people or devices. */
  assigned: number;
  /** Seats the company holds that nobody uses yet: its own free pool. */
  free: number;
  /** An app: turned on for the company, with no seat limit. */
  unlimited: boolean;
};

export function summarizeCompany(
  clientId: string,
  allocations: LicenseAllocation[],
  assignments: LicenseAssignment[],
  /** Item ids that are apps (no seat count). */
  appIds: ReadonlySet<string> = new Set(),
): CompanySeatSummary[] {
  const byItem = new Map<string, CompanySeatSummary>();
  const row = (itemId: string) => {
    let r = byItem.get(itemId);
    if (!r) {
      r = { itemId, held: 0, toOrder: 0, assigned: 0, free: 0, unlimited: appIds.has(itemId) };
      byItem.set(itemId, r);
    }
    return r;
  };
  for (const a of allocations) {
    if (a.clientId !== clientId) continue;
    const r = row(a.itemId);
    r.held++;
    if (a.source === "order") r.toOrder++;
  }
  for (const a of assignments) {
    if (a.clientId !== clientId) continue;
    row(a.itemId).assigned++;
  }
  for (const r of Array.from(byItem.values())) {
    if (r.unlimited) r.held = Math.min(r.held, 1);
    r.free = r.unlimited ? 0 : Math.max(0, r.held - r.assigned);
  }
  return Array.from(byItem.values()).filter((r) => r.held > 0 || r.assigned > 0);
}

/** Seats parked in a department that no person holds yet, per item. */
export function departmentSeats(
  clientId: string,
  departmentId: string,
  assignments: LicenseAssignment[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of assignments) {
    if (a.clientId === clientId && a.targetType === "department" && a.targetId === departmentId) {
      out.set(a.itemId, (out.get(a.itemId) || 0) + 1);
    }
  }
  return out;
}

/** Which allocation row to give back first when a company releases a seat: un-bought seats before pool seats. */
export function releaseOrder(allocations: LicenseAllocation[]): LicenseAllocation[] {
  return [...allocations].sort((a, b) => {
    if (a.source !== b.source) return a.source === "order" ? -1 : 1;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export function deviceTargetId(label: string): string {
  return `device:${label.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80)}`;
}

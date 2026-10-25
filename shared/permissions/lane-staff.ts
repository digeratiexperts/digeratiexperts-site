/**
 * DE staff tool permissions: the DE Admin pages that `deOnly` menu items open
 * (Joe 2026-10-24). Each one was `requireAdmin` (break-glass only), so a DE
 * staff login saw the page and got 403 on every call. Registered in index.ts
 * per docs/lanes/registry.md. Break-glass-only actions stay in lane-a.ts.
 */
import type { AccessRule } from "./types";

export const laneStaffPermissions: Record<string, AccessRule> = {
  /** License Patch Bay: vendor licence pool, company seats, assignments. */
  "licenses.manage": { deOnly: true },
  /** Knowledge Authoring: write, edit and publish KB articles. */
  "kb.manage": { deOnly: true },
  /** Order Change Requests: decide client cancellations and changes to Store orders. */
  "orders.manage": { deOnly: true },
  /** Manual records DE enters for a company (Ship Center shipments, VPN and phone records). */
  "manualRecords.manage": { deOnly: true },
  /** Digital Warehouse, the full /health map and the internal planning tools. */
  "warehouse.access": { deOnly: true },
};

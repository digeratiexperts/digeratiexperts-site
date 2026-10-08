import type { Express, Request, RequestHandler, Response } from "express";
import {
  EVERY_MACHINE_ID,
  EVERY_MACHINE_LABEL,
  deviceTargetId,
  departmentSeats,
  planAllocation,
  releaseOrder,
  summarizeCompany,
  summarizePool,
  type AssignmentTarget,
} from "@shared/licenseBoard";
import { LICENSE_CATALOG, catalogLicense } from "@shared/licensing";
import { SHELF_CATEGORIES, catalogShelf, hubShelf, starterShelf } from "@shared/licenseShelf";
import * as store from "./licenseBoardStore";

/**
 * License patch bay (DE admin only).
 *
 *   GET    /api/portal/admin/license-board                      DE pool + every company's seats
 *   GET    /api/portal/admin/license-board/shelf                the parts bin: starter shelf, catalog, Hub SKUs
 *   POST   /api/portal/admin/license-board/items                add a vendor licence to DE's pool
 *   PUT    /api/portal/admin/license-board/items/:id            change seats held (never below seats handed out)
 *   DELETE /api/portal/admin/license-board/items/:id            only while no company holds a seat
 *   POST   /api/portal/admin/license-board/allocate             { itemId, clientId, quantity }: pool first, rest to order
 *   POST   /api/portal/admin/license-board/release              { itemId, clientId }: one unused seat back
 *   GET    /api/portal/admin/license-board/clients/:clientId    the company's free pool, departments, people, devices
 *   POST   /api/portal/admin/license-board/clients/:clientId/assign
 *   DELETE /api/portal/admin/license-board/clients/:clientId/assignments/:id
 *
 * These are DE's records of where seats are meant to go. Nothing here
 * provisions a licence in Microsoft, Google or any vendor console.
 */

type AdminRequest = Request & { user?: { id?: string | null; role?: string | null } };

type Client = { id: string; companyName: string };
type Person = { id: string; clientId: string | null; fullName: string; email: string; isActive?: boolean; departmentId?: string | null };

export type LicenseBoardRouteDeps = {
  adminGuards: RequestHandler[];
  listClients: () => Client[];
  getClient: (id: string) => Client | undefined;
  listClientUsers: (clientId: string) => Person[];
  listDepartments: (clientId: string) => Promise<{ id: string; name: string }[]>;
  /** Hub staff catalog ({ status, skus }) or null when the feed is not reachable. */
  fetchHubCatalog?: () => Promise<Record<string, unknown> | null>;
};

const SHELF_CATEGORY_KEYS = new Set<string>(SHELF_CATEGORIES.map((c) => c.key));
const CHOCO_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const appIdsOf = (items: { id: string; kind: string }[]) => new Set(items.filter((i) => i.kind === "app").map((i) => i.id));

const BASE = "/api/portal/admin/license-board";
const MAX_SEATS = 10_000;
const text = (v: unknown, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const whole = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= MAX_SEATS ? n : null;
};

function catalogVendor(platform: string): string {
  if (platform.startsWith("microsoft")) return "Microsoft";
  if (platform.startsWith("google")) return "Google";
  return "Zoho";
}

export function registerLicenseBoardRoutes(app: Express, deps: LicenseBoardRouteDeps): void {
  const guard = deps.adminGuards;
  const fail = (res: Response, error: unknown, what: string) =>
    res.status(500).json({ error: (error as Error)?.message || `Failed to ${what}` });

  app.get(BASE, ...guard, async (_req: AdminRequest, res: Response) => {
    try {
      const [items, allocations, assignments] = await Promise.all([
        store.listPoolItems(),
        store.listAllocations(),
        store.listAssignments(),
      ]);
      const clients = deps
        .listClients()
        .map((c) => ({ id: c.id, name: c.companyName, seats: summarizeCompany(c.id, allocations, assignments, appIdsOf(items)) }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      res.json({ success: true, items: summarizePool(items, allocations), clients, catalog: LICENSE_CATALOG });
    } catch (error) {
      fail(res, error, "load the license board");
    }
  });

  app.get(`${BASE}/shelf`, ...guard, async (_req: AdminRequest, res: Response) => {
    try {
      const hub = deps.fetchHubCatalog ? await deps.fetchHubCatalog().catch(() => null) : null;
      res.json({
        success: true,
        categories: SHELF_CATEGORIES,
        hubConnected: Boolean(hub && Array.isArray((hub as { skus?: unknown }).skus)),
        entries: [...starterShelf(), ...catalogShelf(), ...hubShelf((hub as { skus?: unknown } | null)?.skus)],
      });
    } catch (error) {
      fail(res, error, "load the parts bin");
    }
  });

  app.post(`${BASE}/items`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const catalogKey = text(req.body?.catalogKey, 80) || null;
      const fromCatalog = catalogKey ? catalogLicense(catalogKey) : undefined;
      if (catalogKey && !fromCatalog) return res.status(400).json({ error: "Unknown catalog licence" });
      const kind = req.body?.kind === "app" ? "app" : "license";
      const vendor = text(req.body?.vendor) || (fromCatalog ? catalogVendor(fromCatalog.platform) : "");
      const product = text(req.body?.product) || fromCatalog?.name || "";
      const quantity = kind === "app" ? 0 : whole(req.body?.quantity ?? 0);
      const categoryRaw = text(req.body?.category, 60);
      const category = SHELF_CATEGORY_KEYS.has(categoryRaw) ? categoryRaw : kind === "app" ? "Line-of-business" : "Productivity";
      const sku = text(req.body?.sku, 80) || null;
      const chocoPackage = kind === "app" ? text(req.body?.chocoPackage, 100) || null : null;
      if (!vendor || !product) return res.status(400).json({ error: "Vendor and product are required" });
      if (quantity === null) return res.status(400).json({ error: `Seats must be a whole number from 0 to ${MAX_SEATS}` });
      if (chocoPackage && !CHOCO_ID.test(chocoPackage)) return res.status(400).json({ error: "That is not a Chocolatey package id" });
      const existing = await store.listPoolItems();
      if (existing.some((i) => i.vendor.toLowerCase() === vendor.toLowerCase() && i.product.toLowerCase() === product.toLowerCase())) {
        return res.status(409).json({ error: `${product} is already in DE's pool` });
      }
      const item = await store.createPoolItem({ kind, vendor, product, category, catalogKey, sku, chocoPackage, quantity });
      res.status(201).json({ success: true, item });
    } catch (error) {
      fail(res, error, "add the licence");
    }
  });

  app.put(`${BASE}/items/:id`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const item = await store.getPoolItem(req.params.id);
      if (!item) return res.status(404).json({ error: "Licence not found" });
      const patch: { vendor?: string; product?: string; quantity?: number; chocoPackage?: string | null } = {};
      if (req.body?.vendor !== undefined) patch.vendor = text(req.body.vendor) || item.vendor;
      if (req.body?.product !== undefined) patch.product = text(req.body.product) || item.product;
      if (req.body?.chocoPackage !== undefined && item.kind === "app") {
        const id = text(req.body.chocoPackage, 100);
        if (id && !CHOCO_ID.test(id)) return res.status(400).json({ error: "That is not a Chocolatey package id" });
        patch.chocoPackage = id || null;
      }
      if (req.body?.quantity !== undefined && item.kind === "license") {
        const quantity = whole(req.body.quantity);
        if (quantity === null) return res.status(400).json({ error: `Seats must be a whole number from 0 to ${MAX_SEATS}` });
        const [summary] = summarizePool([item], await store.listAllocations());
        if (quantity < summary.allocated) {
          return res.status(409).json({
            error: `${summary.allocated} seats are already with companies. Release seats before going below that.`,
          });
        }
        patch.quantity = quantity;
      }
      res.json({ success: true, item: await store.updatePoolItem(item.id, patch) });
    } catch (error) {
      fail(res, error, "update the licence");
    }
  });

  app.delete(`${BASE}/items/:id`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const item = await store.getPoolItem(req.params.id);
      if (!item) return res.status(404).json({ error: "Licence not found" });
      if ((await store.listAllocations()).some((a) => a.itemId === item.id)) {
        return res.status(409).json({ error: "Companies still hold seats of this licence. Release them first." });
      }
      await store.deletePoolItem(item.id);
      res.json({ success: true });
    } catch (error) {
      fail(res, error, "remove the licence");
    }
  });

  app.post(`${BASE}/allocate`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const item = await store.getPoolItem(text(req.body?.itemId, 80));
      if (!item) return res.status(404).json({ error: "Licence not found" });
      const client = deps.getClient(text(req.body?.clientId, 80));
      if (!client) return res.status(404).json({ error: "Company not found" });
      if (item.kind === "app") {
        const held = (await store.listAllocations(client.id)).some((a) => a.itemId === item.id);
        if (held) return res.status(409).json({ error: `${item.product} is already on for ${client.companyName}` });
        await store.addAllocations({ itemId: item.id, clientId: client.id, source: "pool", count: 1 }, req.user?.id ?? null);
        return res.json({ success: true, fromPool: 1, toOrder: 0, app: true, company: client.companyName, product: item.product });
      }
      const quantity = whole(req.body?.quantity ?? 1);
      if (!quantity) return res.status(400).json({ error: "Drop at least one seat" });
      const [summary] = summarizePool([item], await store.listAllocations());
      const plan = planAllocation(summary.free, quantity);
      const by = req.user?.id ?? null;
      if (plan.fromPool) await store.addAllocations({ itemId: item.id, clientId: client.id, source: "pool", count: plan.fromPool }, by);
      if (plan.toOrder) await store.addAllocations({ itemId: item.id, clientId: client.id, source: "order", count: plan.toOrder }, by);
      res.json({ success: true, ...plan, company: client.companyName, product: item.product });
    } catch (error) {
      fail(res, error, "give the seat");
    }
  });

  app.post(`${BASE}/release`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const itemId = text(req.body?.itemId, 80);
      const clientId = text(req.body?.clientId, 80);
      const [allocations, assignments, item] = await Promise.all([
        store.listAllocations(clientId),
        store.listAssignments(clientId),
        store.getPoolItem(itemId),
      ]);
      if (item?.kind === "app") {
        const row = allocations.find((a) => a.itemId === itemId);
        if (!row) return res.status(404).json({ error: "That app is not on for this company" });
        if (assignments.some((a) => a.itemId === itemId)) {
          return res.status(409).json({ error: "People or machines still have this app. Unassign them inside the company first." });
        }
        await store.deleteAllocation(row.id);
        return res.json({ success: true, released: "app" });
      }
      const seat = summarizeCompany(clientId, allocations, assignments).find((s) => s.itemId === itemId);
      if (!seat || seat.held === 0) return res.status(404).json({ error: "That company holds no seat of this licence" });
      if (seat.free === 0) return res.status(409).json({ error: "Every seat is in use. Unassign one inside the company first." });
      const [first] = releaseOrder(allocations.filter((a) => a.itemId === itemId));
      await store.deleteAllocation(first.id);
      res.json({ success: true, released: first.source });
    } catch (error) {
      fail(res, error, "release the seat");
    }
  });

  app.get(`${BASE}/clients/:clientId`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const client = deps.getClient(req.params.clientId);
      if (!client) return res.status(404).json({ error: "Company not found" });
      const [items, allocations, assignments, departments] = await Promise.all([
        store.listPoolItems(),
        store.listAllocations(client.id),
        store.listAssignments(client.id),
        deps.listDepartments(client.id).catch(() => []),
      ]);
      const seats = summarizeCompany(client.id, allocations, assignments, appIdsOf(items));
      const byId = new Map(items.map((i) => [i.id, i]));
      const people = deps
        .listClientUsers(client.id)
        .filter((u) => u.clientId === client.id && u.isActive !== false)
        .map((u) => ({ id: u.id, name: u.fullName, email: u.email, departmentId: u.departmentId ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const holding = (type: AssignmentTarget, id: string) =>
        assignments
          .filter((a) => a.targetType === type && a.targetId === id)
          .map((a) => ({ assignmentId: a.id, itemId: a.itemId, viaDepartmentId: a.viaDepartmentId }));
      const devices = new Map<string, string>([[EVERY_MACHINE_ID, EVERY_MACHINE_LABEL]]);
      for (const a of assignments) if (a.targetType === "device") devices.set(a.targetId, a.targetLabel);
      res.json({
        success: true,
        company: { id: client.id, name: client.companyName },
        pool: seats
          .filter((s) => byId.has(s.itemId))
          .map((s) => {
            const i = byId.get(s.itemId)!;
            return { ...s, kind: i.kind, vendor: i.vendor, product: i.product, category: i.category, chocoPackage: i.chocoPackage };
          }),
        departments: departments.map((d) => ({
          id: d.id,
          name: d.name,
          seats: Array.from(departmentSeats(client.id, d.id, assignments).entries()).map(([itemId, count]) => ({ itemId, count })),
        })),
        people: people.map((p) => ({ ...p, licenses: holding("user", p.id) })),
        devices: Array.from(devices.entries()).map(([id, label]) => ({ id, label, licenses: holding("device", id) })),
      });
    } catch (error) {
      fail(res, error, "load the company");
    }
  });

  app.post(`${BASE}/clients/:clientId/assign`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const client = deps.getClient(req.params.clientId);
      if (!client) return res.status(404).json({ error: "Company not found" });
      const itemId = text(req.body?.itemId, 80);
      const targetType = text(req.body?.targetType, 20) as AssignmentTarget;
      const fromDepartmentId = text(req.body?.fromDepartmentId, 80) || null;
      if (!["department", "user", "device"].includes(targetType)) return res.status(400).json({ error: "Unknown target" });

      const [allocations, assignments, departments, item] = await Promise.all([
        store.listAllocations(client.id),
        store.listAssignments(client.id),
        deps.listDepartments(client.id).catch(() => []),
        store.getPoolItem(itemId),
      ]);
      if (!item) return res.status(404).json({ error: "Licence not found" });
      const isApp = item.kind === "app";

      let targetId = text(req.body?.targetId, 80);
      let targetLabel = "";
      if (targetType === "department") {
        const dept = departments.find((d) => d.id === targetId);
        if (!dept) return res.status(404).json({ error: "Department not found" });
        targetLabel = dept.name;
      } else if (targetType === "user") {
        const person = deps.listClientUsers(client.id).find((u) => u.id === targetId && u.clientId === client.id);
        if (!person) return res.status(404).json({ error: "Person not found" });
        targetLabel = person.fullName;
      } else {
        if (targetId === EVERY_MACHINE_ID) {
          if (!isApp) return res.status(400).json({ error: "Only apps go to every machine; licences are counted per machine" });
          targetLabel = EVERY_MACHINE_LABEL;
        } else {
          targetLabel = text(req.body?.label ?? req.body?.targetLabel, 80);
          if (!targetLabel) return res.status(400).json({ error: "Name the device" });
          targetId = deviceTargetId(targetLabel);
        }
      }
      if (isApp && targetType === "department") {
        return res.status(400).json({ error: "Apps go straight to people or machines" });
      }
      if (targetType !== "department" && assignments.some((a) => a.itemId === itemId && a.targetType === targetType && a.targetId === targetId)) {
        return res.status(409).json({ error: `${targetLabel} already has this licence` });
      }

      if (isApp) {
        if (!allocations.some((a) => a.itemId === itemId)) {
          return res.status(409).json({ error: `${item.product} is not on for ${client.companyName} yet` });
        }
      } else if (fromDepartmentId) {
        // A seat parked in a department moves to one of its people or devices.
        if (targetType === "department") return res.status(400).json({ error: "Patch a department seat to a person or device" });
        const parked = assignments.find(
          (a) => a.itemId === itemId && a.targetType === "department" && a.targetId === fromDepartmentId,
        );
        if (!parked) return res.status(409).json({ error: "That department has no free seat of this licence" });
        await store.deleteAssignment(parked.id);
      } else {
        const seat = summarizeCompany(client.id, allocations, assignments).find((s) => s.itemId === itemId);
        if (!seat || seat.free === 0) return res.status(409).json({ error: `${client.companyName} has no free seat of this licence` });
      }

      const assignment = await store.addAssignment(
        { clientId: client.id, itemId, targetType, targetId, targetLabel, viaDepartmentId: fromDepartmentId },
        req.user?.id ?? null,
      );
      res.status(201).json({ success: true, assignment });
    } catch (error) {
      fail(res, error, "assign the seat");
    }
  });

  app.delete(`${BASE}/clients/:clientId/assignments/:id`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const assignment = (await store.listAssignments(req.params.clientId)).find((a) => a.id === req.params.id);
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      await store.deleteAssignment(assignment.id);
      // A person's seat that came from a department goes back to that department.
      if (assignment.viaDepartmentId) {
        const depts = await deps.listDepartments(assignment.clientId).catch(() => []);
        const dept = depts.find((d) => d.id === assignment.viaDepartmentId);
        if (dept) {
          await store.addAssignment(
            {
              clientId: assignment.clientId,
              itemId: assignment.itemId,
              targetType: "department",
              targetId: dept.id,
              targetLabel: dept.name,
              viaDepartmentId: null,
            },
            req.user?.id ?? null,
          );
        }
      }
      res.json({ success: true, returnedTo: assignment.viaDepartmentId ? "department" : "company" });
    } catch (error) {
      fail(res, error, "unassign the seat");
    }
  });
}

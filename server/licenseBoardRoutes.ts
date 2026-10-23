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
import { JC_ID, planJumpCloudInstalls } from "@shared/jumpcloudPlan";
import { STARTER_KITS, shelfEntry, starterKit } from "@shared/starterKits";
import { requirementStatus } from "@shared/clientVault";
import {
  EMAIL,
  MICROSOFT_CLOUDS,
  MS_TENANT,
  VENDOR_SKU_DEFAULTS,
  planVendorPush,
  splitGoogleSku,
  type MicrosoftCloud,
  type PushVendor,
  type VendorLink,
} from "@shared/vendorPush";

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
 *   GET    /api/portal/admin/license-board/clients/:clientId/vendors              Microsoft / Google links, plans, logs
 *   PUT    /api/portal/admin/license-board/clients/:clientId/vendors/:vendor      link the tenant / Google admin
 *   POST   /api/portal/admin/license-board/clients/:clientId/vendors/:vendor/push assign the ready licences (on request)
 *   GET    /api/portal/admin/license-board/kits                  the starter kits
 *   POST   /api/portal/admin/license-board/clients/:clientId/kit records the kit, its apps and its vault checklist
 *
 * These are DE's records of where seats are meant to go. Licences reach a
 * vendor console only through the vendors push, when an admin presses Send.
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
  /** JumpCloud Software Management (server/integrations/jumpcloud.ts); tests pass a fake. */
  jumpcloud: JumpCloudClient;
  /** Microsoft Graph and Google licensing (server/integrations/msGraph.ts, googleLicensing.ts); tests pass fakes. */
  vendors?: VendorClients;
  /** Kinds and titles of the client's vault items, to tick off kit documents. Absent or null: on-file status unknown. */
  vaultTitles?: (clientId: string) => Promise<Array<{ kind: string; title: string }> | null>;
};

export type JumpCloudClient = {
  configured: () => boolean;
  ensureChocoApp: (displayName: string, packageId: string, orgId: string | null) => Promise<{ ok: boolean; id?: string; error?: string }>;
  associate: (appId: string, target: { type: "system_group" | "system"; id: string }, orgId: string | null) => Promise<{ ok: boolean; error?: string }>;
  findSystem: (name: string, orgId: string | null) => Promise<{ ok: boolean; id?: string; error?: string }>;
};

export type VendorClients = {
  microsoft: {
    configured: (cloud: MicrosoftCloud) => boolean;
    subscribedSkus: (tenant: string, cloud: MicrosoftCloud) => Promise<{ ok: boolean; skus?: Array<{ skuId: string; skuPartNumber: string; enabled: number; consumed: number }>; error?: string }>;
    assign: (tenant: string, cloud: MicrosoftCloud, upn: string, skuId: string) => Promise<{ ok: boolean; error?: string }>;
  };
  google: {
    configured: () => boolean;
    assign: (adminEmail: string, productId: string, skuId: string, userEmail: string) => Promise<{ ok: boolean; error?: string }>;
  };
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
      const [items, allocations, assignments, kits] = await Promise.all([
        store.listPoolItems(),
        store.listAllocations(),
        store.listAssignments(),
        store.listCompanyKits(),
      ]);
      const kitOf = new Map(kits.map((k) => [k.clientId, starterKit(k.kitKey)?.name ?? null]));
      const clients = deps
        .listClients()
        .map((c) => ({
          id: c.id,
          name: c.companyName,
          kit: kitOf.get(c.id) ?? null,
          seats: summarizeCompany(c.id, allocations, assignments, appIdsOf(items)),
        }))
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
      const patch: { vendor?: string; product?: string; quantity?: number; chocoPackage?: string | null; sku?: string | null } = {};
      if (req.body?.sku !== undefined) patch.sku = text(req.body.sku, 80) || null;
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

  /** One company's free pool, departments, people and devices (the page's level 2). */
  const companyView = async (client: Client) => {
    const [items, allocations, assignments, departments, kitRow, requirements, vaultItems] = await Promise.all([
      store.listPoolItems(),
      store.listAllocations(client.id),
      store.listAssignments(client.id),
      deps.listDepartments(client.id).catch(() => []),
      store.getCompanyKit(client.id),
      store.listVaultRequirements(client.id),
      deps.vaultTitles ? deps.vaultTitles(client.id).catch(() => null) : Promise.resolve(null),
    ]);
    const kit = kitRow ? starterKit(kitRow.kitKey) : undefined;
    const vaultStatus = vaultItems ? requirementStatus(requirements, vaultItems as any) : null;
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
    return {
      company: { id: client.id, name: client.companyName },
      kit: kit && kitRow ? { key: kit.key, name: kit.name, appliedAt: kitRow.appliedAt } : null,
      vaultDocs: {
        needed: requirements.length,
        /** null when the vault could not be read (not configured or down). */
        onFile: vaultStatus ? vaultStatus.filter((r) => r.onFile).length : null,
      },
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
    };
  };

  app.get(`${BASE}/clients/:clientId`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const client = deps.getClient(req.params.clientId);
      if (!client) return res.status(404).json({ error: "Company not found" });
      res.json({ success: true, ...(await companyView(client)) });
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

  /* ------------------------------------------- Microsoft 365 / Google */

  const PUSH_VENDORS: PushVendor[] = ["microsoft", "google"];
  const vendorParam = (v: unknown): PushVendor | null => (PUSH_VENDORS.includes(v as PushVendor) ? (v as PushVendor) : null);
  const vendorConfigured = (vendor: PushVendor, link: VendorLink | null) =>
    !deps.vendors
      ? false
      : vendor === "microsoft"
        ? deps.vendors.microsoft.configured(link?.vendor === "microsoft" ? link.cloud : "commercial")
        : deps.vendors.google.configured();

  /** The push plan for one vendor: person-held licences, with each one's SKU (its own, else DE's default). */
  const vendorPlan = async (client: Client, vendor: PushVendor, link: VendorLink | null) => {
    const view = await companyView(client);
    const items = await store.listPoolItems();
    const byId = new Map(items.map((i) => [i.id, i]));
    const pool = view.pool
      .filter((p) => byId.has(p.itemId))
      .map((p) => {
        const i = byId.get(p.itemId)!;
        return {
          itemId: p.itemId,
          kind: i.kind,
          vendor: i.vendor,
          product: i.product,
          catalogKey: i.catalogKey,
          sku: i.sku || (i.catalogKey ? VENDOR_SKU_DEFAULTS[`catalog:${i.catalogKey}`] ?? null : null),
        };
      });
    return planVendorPush({ pool, people: view.people, departments: view.departments }, vendor, Boolean(link));
  };

  app.get(`${BASE}/clients/:clientId/vendors`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const client = deps.getClient(req.params.clientId);
      if (!client) return res.status(404).json({ error: "Company not found" });
      const out: Record<string, unknown> = {};
      for (const vendor of PUSH_VENDORS) {
        const link = await store.getVendorLink(client.id, vendor);
        out[vendor] = {
          configured: vendorConfigured(vendor, link),
          link,
          ...(await vendorPlan(client, vendor, link)),
          pushes: await store.listVendorPushes(client.id, vendor),
        };
      }
      res.json({ success: true, ...out });
    } catch (error) {
      fail(res, error, "load the vendor consoles");
    }
  });

  app.put(`${BASE}/clients/:clientId/vendors/:vendor`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const client = deps.getClient(req.params.clientId);
      if (!client) return res.status(404).json({ error: "Company not found" });
      const vendor = vendorParam(req.params.vendor);
      if (!vendor) return res.status(404).json({ error: "Unknown vendor" });
      let link: VendorLink;
      if (vendor === "microsoft") {
        const tenant = text(req.body?.tenant, 120);
        const cloud = text(req.body?.cloud, 20) as MicrosoftCloud;
        if (!MS_TENANT.test(tenant)) return res.status(400).json({ error: "Enter the tenant ID (a GUID) or its domain, e.g. contoso.onmicrosoft.com" });
        if (!MICROSOFT_CLOUDS.some((c) => c.key === cloud)) return res.status(400).json({ error: "Pick Commercial, GCC or GCC High" });
        link = { vendor, tenant, cloud };
      } else {
        const adminEmail = text(req.body?.adminEmail, 160);
        if (!EMAIL.test(adminEmail)) return res.status(400).json({ error: "Enter the client's Google super admin email" });
        link = { vendor, adminEmail };
      }
      await store.setVendorLink(client.id, link, req.user?.id ?? null);
      res.json({ success: true, link });
    } catch (error) {
      fail(res, error, "save the link");
    }
  });

  /** Sends every ready step for one vendor. Only on an admin's press; each result is logged. */
  app.post(`${BASE}/clients/:clientId/vendors/:vendor/push`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const client = deps.getClient(req.params.clientId);
      if (!client) return res.status(404).json({ error: "Company not found" });
      const vendor = vendorParam(req.params.vendor);
      if (!vendor || !deps.vendors) return res.status(404).json({ error: "Unknown vendor" });
      const link = await store.getVendorLink(client.id, vendor);
      if (!link) return res.status(409).json({ error: "Link the company first" });
      if (!vendorConfigured(vendor, link)) {
        return res.status(409).json({
          error:
            vendor === "microsoft"
              ? "Microsoft Graph is not connected on this server (MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET, or the _GOV_ pair for GCC High)"
              : "Google licensing is not connected on this server (GOOGLE_LICENSING_SERVICE_ACCOUNT)",
        });
      }
      const ready = (await vendorPlan(client, vendor, link)).steps.filter((s) => s.status === "ready");
      if (!ready.length) return res.status(409).json({ error: "Nothing is ready to send" });
      const by = req.user?.id ?? null;
      let sent = 0;
      let failed = 0;
      const log = async (step: (typeof ready)[number], ok: boolean, detail: string | null) => {
        ok ? sent++ : failed++;
        await store.recordVendorPush(
          { clientId: client.id, vendor, itemId: step.itemId, product: step.product, sku: step.sku!, userEmail: step.email, ok, detail },
          by,
        );
      };
      if (link.vendor === "microsoft") {
        const subs = await deps.vendors.microsoft.subscribedSkus(link.tenant, link.cloud);
        if (!subs.ok) return res.status(502).json({ error: `Microsoft: ${subs.error}` });
        for (const step of ready) {
          const sub = subs.skus!.find((s) => s.skuPartNumber.toLowerCase() === step.sku!.toLowerCase());
          if (!sub) {
            await log(step, false, `The tenant has no ${step.sku} subscription`);
            continue;
          }
          const r = await deps.vendors.microsoft.assign(link.tenant, link.cloud, step.email, sub.skuId);
          await log(step, r.ok, r.ok ? "Assigned" : r.error || "Failed");
        }
      } else if (link.vendor === "google") {
        for (const step of ready) {
          const ids = splitGoogleSku(step.sku!)!;
          const r = await deps.vendors.google.assign(link.adminEmail, ids.productId, ids.skuId, step.email);
          await log(step, r.ok, r.ok ? "Assigned" : r.error || "Failed");
        }
      }
      res.json({ success: true, sent, failed });
    } catch (error) {
      fail(res, error, "send to the vendor console");
    }
  });

  /* ---------------------------------------------------------- JumpCloud */

  app.get(`${BASE}/clients/:clientId/jumpcloud`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const client = deps.getClient(req.params.clientId);
      if (!client) return res.status(404).json({ error: "Company not found" });
      const [view, link, pushes] = await Promise.all([
        companyView(client),
        store.getJumpCloudLink(client.id),
        store.listJumpCloudPushes(client.id),
      ]);
      res.json({ success: true, configured: deps.jumpcloud.configured(), link, plan: planJumpCloudInstalls(view, link), pushes });
    } catch (error) {
      fail(res, error, "load the JumpCloud plan");
    }
  });

  app.put(`${BASE}/clients/:clientId/jumpcloud`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const client = deps.getClient(req.params.clientId);
      if (!client) return res.status(404).json({ error: "Company not found" });
      const orgId = text(req.body?.orgId, 40) || null;
      const systemGroupId = text(req.body?.systemGroupId, 40) || null;
      for (const [label, value] of [["Organization id", orgId], ["Device group id", systemGroupId]] as const) {
        if (value && !JC_ID.test(value)) return res.status(400).json({ error: `${label} should be the id from the JumpCloud admin console` });
      }
      await store.setJumpCloudLink(client.id, { orgId, systemGroupId }, req.user?.id ?? null);
      res.json({ success: true, link: { orgId, systemGroupId } });
    } catch (error) {
      fail(res, error, "save the JumpCloud link");
    }
  });

  /** Send the ready installs to JumpCloud. Only on an admin's press; never on a schedule. */
  app.post(`${BASE}/clients/:clientId/jumpcloud/push`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const client = deps.getClient(req.params.clientId);
      if (!client) return res.status(404).json({ error: "Company not found" });
      if (!deps.jumpcloud.configured()) {
        return res.status(409).json({ error: "JumpCloud is not connected on this server (JUMPCLOUD_API_KEY is not set)" });
      }
      const link = await store.getJumpCloudLink(client.id);
      const steps = planJumpCloudInstalls(await companyView(client), link).filter((st) => st.status === "ready");
      if (!steps.length) return res.status(409).json({ error: "Nothing is ready to send" });
      const orgId = link?.orgId ?? null;
      const by = req.user?.id ?? null;
      const results = [];
      for (const step of steps) {
        let detail: string | null = null;
        let ok = false;
        const app = await deps.jumpcloud.ensureChocoApp(step.product, step.chocoPackage!, orgId);
        if (!app.ok || !app.id) {
          detail = app.error || "Could not create the software app";
        } else {
          let target: { type: "system_group" | "system"; id: string } | null = null;
          if (step.target.kind === "group" && step.target.id) target = { type: "system_group", id: step.target.id };
          else if (step.target.kind === "machine") {
            const sys = await deps.jumpcloud.findSystem(step.target.label, orgId);
            if (sys.ok && sys.id) target = { type: "system", id: sys.id };
            else detail = sys.error || `No JumpCloud machine named ${step.target.label}`;
          }
          if (target) {
            const bound = await deps.jumpcloud.associate(app.id, target, orgId);
            ok = bound.ok;
            detail = bound.ok ? "Sent: JumpCloud installs it at the machine's next check-in" : bound.error || "JumpCloud refused the binding";
          }
        }
        results.push(
          await store.recordJumpCloudPush(
            {
              clientId: client.id,
              itemId: step.itemId,
              product: step.product,
              chocoPackage: step.chocoPackage!,
              targetKind: step.target.kind === "group" ? "group" : "machine",
              targetLabel: step.target.label,
              ok,
              detail,
            },
            by,
          ),
        );
      }
      res.json({ success: true, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results });
    } catch (error) {
      fail(res, error, "send to JumpCloud");
    }
  });

  /* ------------------------------------------------------- starter kits */

  app.get(`${BASE}/kits`, ...guard, (_req: AdminRequest, res: Response) => {
    res.json({
      success: true,
      kits: STARTER_KITS.map((k) => ({
        ...k,
        apps: k.apps.map((key) => shelfEntry(key)).filter(Boolean),
        licenses: k.licenses.map((key) => shelfEntry(key)).filter(Boolean),
      })),
    });
  });

  /**
   * Apply a kit: missing parts go into DE's pool (licences with 0 seats), the
   * kit's apps are turned on for the company and sent to Every machine.
   * Licences are recommended, never allocated. Safe to apply twice.
   */
  app.post(`${BASE}/clients/:clientId/kit`, ...guard, async (req: AdminRequest, res: Response) => {
    try {
      const client = deps.getClient(req.params.clientId);
      if (!client) return res.status(404).json({ error: "Company not found" });
      const kit = starterKit(text(req.body?.kit, 20));
      if (!kit) return res.status(400).json({ error: "Unknown starter kit" });
      const by = req.user?.id ?? null;
      const items = await store.listPoolItems();
      const ensure = async (key: string) => {
        const entry = shelfEntry(key)!;
        const hit = items.find(
          (i) => i.vendor.toLowerCase() === entry.vendor.toLowerCase() && i.product.toLowerCase() === entry.product.toLowerCase(),
        );
        if (hit) return { item: hit, added: false };
        const item = await store.createPoolItem({
          kind: entry.kind,
          vendor: entry.vendor,
          product: entry.product,
          category: entry.category,
          catalogKey: entry.catalogKey ?? null,
          sku: entry.sku ?? null,
          chocoPackage: entry.chocoPackage ?? null,
          quantity: 0,
        });
        items.push(item);
        return { item, added: true };
      };
      let addedToPool = 0;
      let appsOn = 0;
      let onEveryMachine = 0;
      for (const key of kit.apps) {
        const { item, added } = await ensure(key);
        if (added) addedToPool++;
        const allocations = await store.listAllocations(client.id);
        if (!allocations.some((a) => a.itemId === item.id)) {
          await store.addAllocations({ itemId: item.id, clientId: client.id, source: "pool", count: 1 }, by);
          appsOn++;
        }
        const assignments = await store.listAssignments(client.id);
        if (!assignments.some((a) => a.itemId === item.id && a.targetType === "device" && a.targetId === EVERY_MACHINE_ID)) {
          await store.addAssignment(
            {
              clientId: client.id,
              itemId: item.id,
              targetType: "device",
              targetId: EVERY_MACHINE_ID,
              targetLabel: EVERY_MACHINE_LABEL,
              viaDepartmentId: null,
            },
            by,
          );
          onEveryMachine++;
        }
      }
      const recommended = [];
      for (const key of kit.licenses) {
        const { item, added } = await ensure(key);
        if (added) addedToPool++;
        recommended.push({ itemId: item.id, product: item.product });
      }
      await store.setCompanyKit(client.id, kit.key, by);
      const vaultDocsAdded = await store.addVaultRequirements(
        client.id,
        kit.vaultDocs.map((d) => ({ kind: d.kind, title: d.title, hint: d.hint })),
        `kit:${kit.key}`,
        by,
      );
      res.json({
        success: true,
        kit: kit.name,
        kitKey: kit.key,
        addedToPool,
        appsOn,
        onEveryMachine,
        recommended,
        vaultDocsAdded,
        note: kit.note ?? null,
      });
    } catch (error) {
      fail(res, error, "apply the starter kit");
    }
  });
}

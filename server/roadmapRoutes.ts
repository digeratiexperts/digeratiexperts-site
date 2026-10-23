import type { Express, Request, RequestHandler, Response } from "express";
import { can, isDeStaff } from "@shared/permissions";
import { selectedPortalCompanyId } from "./portalCompanyProfile";
import { countRoadmap, createRoadmapItem, deleteRoadmapItem, getRoadmapItem, listRoadmap, updateRoadmapItem } from "./roadmapStore";
import {
  roadmapCommentSchema,
  roadmapDecisionSchema,
  roadmapItemInputSchema,
  sortRoadmap,
  summarizeRoadmap,
  type RoadmapItem,
} from "@shared/roadmap";

/**
 * IT Roadmap over HTTP.
 *
 * Client side (the company in the session; owners only, via roadmap.read /
 * roadmap.decide in shared/permissions/lane-c.ts):
 * - GET  /api/portal/roadmap
 * - POST /api/portal/roadmap/:id/decision   approve or decline a proposed item
 * - POST /api/portal/roadmap/:id/comments
 *
 * DE side (company in the path; roadmap.manage):
 * - GET|POST /api/portal/admin/companies/:companyId/roadmap
 * - PATCH|DELETE /api/portal/admin/companies/:companyId/roadmap/:id
 * - POST /api/portal/admin/companies/:companyId/roadmap/:id/comments
 */

type AuthedRequest = Request & { user?: any };

export type RoadmapRouteDeps = {
  guards: RequestHandler[];
  /** Must enforce roadmap.manage for the :companyId in the path. */
  adminGuards: RequestHandler[];
  getClient: (id: string) => { id: string; companyName: string } | undefined;
  findUser: (id: string) => { id: string; fullName?: string; email?: string } | undefined;
  now?: () => Date;
};

export const ROADMAP_PATH = "/api/portal/roadmap";
export const ADMIN_ROADMAP_PATH = "/api/portal/admin/companies/:companyId/roadmap";

const fieldErrors = (issues: { path: PropertyKey[]; message: string }[]) =>
  Object.fromEntries(issues.map((i) => [i.path.map(String).join(".") || "form", i.message]));

/** Owners may decide while the item is still a proposal or after a decision, not once DE has started it. */
const DECIDABLE = new Set(["proposed", "approved", "declined"]);

/** Whether this company has any roadmap rows (feeds navContext.data.itPlan). */
export const companyHasRoadmap = async (clientId: string) => (await countRoadmap(clientId)) > 0;

export function registerRoadmapRoutes(app: Express, deps: RoadmapRouteDeps): void {
  const now = () => (deps.now ?? (() => new Date()))();
  const nameOf = (req: AuthedRequest) => {
    const u = req.user?.id ? deps.findUser(req.user.id) : undefined;
    return u?.fullName || u?.email || (isDeStaff(req.user) ? "Digerati Experts" : "Your team");
  };

  /** The session company, if the user may read its roadmap; otherwise answers and returns null. */
  const company = (req: AuthedRequest, res: Response, permission: "roadmap.read" | "roadmap.decide"): { id: string; name: string } | null => {
    const id = selectedPortalCompanyId(req.user);
    const client = id ? deps.getClient(id) : undefined;
    if (!client) {
      res.status(400).json({
        code: id ? "COMPANY_NOT_FOUND" : "COMPANY_CONTEXT_REQUIRED",
        error: id ? "That company record is no longer available." : "Choose a company to see its roadmap.",
      });
      return null;
    }
    if (!can(req.user, permission, client.id)) {
      res.status(403).json({ error: "Only your company's owners can see and approve the IT roadmap." });
      return null;
    }
    return { id: client.id, name: client.companyName };
  };

  const view = async (clientId: string) => {
    const items = sortRoadmap(await listRoadmap(clientId));
    return { items, summary: summarizeRoadmap(items) };
  };

  app.get(ROADMAP_PATH, ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const c = company(req, res, "roadmap.read");
    if (!c) return;
    res.json({ success: true, company: c, canDecide: can(req.user, "roadmap.decide", c.id), ...(await view(c.id)) });
  });

  app.post(`${ROADMAP_PATH}/:id/decision`, ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const c = company(req, res, "roadmap.decide");
    if (!c) return;
    const item = await getRoadmapItem(c.id, req.params.id);
    if (!item) return res.status(404).json({ error: "Roadmap item not found" });
    if (!DECIDABLE.has(item.status)) return res.status(409).json({ error: "DE has already started this item, so it can't be approved or declined now." });
    const parsed = roadmapDecisionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error.issues) });
    const at = now();
    const updated = await updateRoadmapItem(
      c.id,
      item.id,
      { status: parsed.data.decision, decisionNote: parsed.data.note, decidedByName: nameOf(req), decidedAt: at.toISOString() },
      at,
    );
    res.json({ success: true, item: updated });
  });

  const addComment = async (clientId: string, item: RoadmapItem, req: AuthedRequest, res: Response, fromDe: boolean) => {
    const parsed = roadmapCommentSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error.issues) });
    const at = now();
    const comments = [...item.comments, { at: at.toISOString(), byName: nameOf(req), fromDe, body: parsed.data.body }];
    res.json({ success: true, item: await updateRoadmapItem(clientId, item.id, { comments }, at) });
  };

  app.post(`${ROADMAP_PATH}/:id/comments`, ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const c = company(req, res, "roadmap.read");
    if (!c) return;
    const item = await getRoadmapItem(c.id, req.params.id);
    if (!item) return res.status(404).json({ error: "Roadmap item not found" });
    await addComment(c.id, item, req, res, isDeStaff(req.user));
  });

  // ---- DE side ----
  const adminCompany = (req: AuthedRequest, res: Response) => {
    const client = deps.getClient(req.params.companyId);
    if (!client) {
      res.status(404).json({ error: "Company not found" });
      return null;
    }
    return client;
  };

  app.get(ADMIN_ROADMAP_PATH, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const client = adminCompany(req, res);
    if (!client) return;
    res.json({ success: true, company: { id: client.id, name: client.companyName }, ...(await view(client.id)) });
  });

  app.post(ADMIN_ROADMAP_PATH, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const client = adminCompany(req, res);
    if (!client) return;
    const parsed = roadmapItemInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error.issues) });
    const item = await createRoadmapItem(client.id, parsed.data, { id: req.user?.id ?? "", name: nameOf(req) }, now());
    res.status(201).json({ success: true, item });
  });

  app.patch(`${ADMIN_ROADMAP_PATH}/:id`, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const client = adminCompany(req, res);
    if (!client) return;
    const current = await getRoadmapItem(client.id, req.params.id);
    if (!current) return res.status(404).json({ error: "Roadmap item not found" });
    const merged = { ...current, ...(req.body ?? {}) };
    const parsed = roadmapItemInputSchema.safeParse({
      title: merged.title,
      rationale: merged.rationale,
      category: merged.category,
      priority: merged.priority,
      targetQuarter: merged.targetQuarter,
      estimateLow: merged.estimateLow ?? null,
      estimateHigh: merged.estimateHigh ?? null,
      costBasis: merged.costBasis,
      status: merged.status,
    });
    if (!parsed.success) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error.issues) });
    // Setting an item back to proposed clears the old decision so owners decide afresh.
    const reset = parsed.data.status === "proposed" && current.status !== "proposed" ? { decisionNote: "", decidedByName: null, decidedAt: null } : {};
    res.json({ success: true, item: await updateRoadmapItem(client.id, current.id, { ...parsed.data, ...reset }, now()) });
  });

  app.delete(`${ADMIN_ROADMAP_PATH}/:id`, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const client = adminCompany(req, res);
    if (!client) return;
    if (!(await deleteRoadmapItem(client.id, req.params.id))) return res.status(404).json({ error: "Roadmap item not found" });
    res.json({ success: true });
  });

  app.post(`${ADMIN_ROADMAP_PATH}/:id/comments`, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const client = adminCompany(req, res);
    if (!client) return;
    const item = await getRoadmapItem(client.id, req.params.id);
    if (!item) return res.status(404).json({ error: "Roadmap item not found" });
    await addComment(client.id, item, req, res, true);
  });
}

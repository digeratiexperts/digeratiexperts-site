import type { Express, Request, RequestHandler, Response } from "express";
import { selectedPortalCompanyId } from "./portalCompanyProfile";
import { createNotice, deleteNotice, getNotice, listAllNotices, listNoticesForCompany, updateNotice } from "./statusNoticeStore";
import { buildStatusView, noticeInputSchema, noticeUpdateSchema, type StatusNotice } from "@shared/statusNotices";

/**
 * System Status over HTTP.
 *
 * - GET  /api/portal/status: what the signed-in company sees (its own notices
 *   plus the ones for every client), grouped, with the overall line. A DE admin
 *   with no company open sees the all-client notices only.
 * - /api/portal/admin/status-notices: DE admin list, create, edit, post an
 *   update (optionally resolving), delete. Writes are audited by authMiddleware.
 */

type AuthedRequest = Request & { user?: { id: string; role?: string; clientId?: string | null; impersonatingCompanyId?: string | null } };

export type StatusNoticeRouteDeps = {
  guards: RequestHandler[];
  adminGuards: RequestHandler[];
  getClient: (id: string) => { id: string; companyName: string } | undefined;
  findUser: (id: string) => { id: string; fullName?: string; email?: string } | undefined;
  now?: () => Date;
};

export const STATUS_PATH = "/api/portal/status";
export const ADMIN_STATUS_PATH = "/api/portal/admin/status-notices";

const fieldErrors = (issues: { path: PropertyKey[]; message: string }[]) =>
  Object.fromEntries(issues.map((i) => [i.path.map(String).join(".") || "form", i.message]));

export function registerStatusNoticeRoutes(app: Express, deps: StatusNoticeRouteDeps): void {
  const now = () => (deps.now ?? (() => new Date()))();
  const actor = (req: AuthedRequest) => {
    const u = req.user?.id ? deps.findUser(req.user.id) : undefined;
    return { id: req.user?.id ?? "", name: u?.fullName || u?.email || "Digerati Experts" };
  };
  const withCompany = (n: StatusNotice) => ({
    ...n,
    companyName: n.clientId ? deps.getClient(n.clientId)?.companyName ?? "Unknown company" : null,
  });
  /** A notice is for every client (null) or for a company that exists. */
  const badClient = (clientId: string | null | undefined) => clientId != null && !deps.getClient(clientId);

  app.get(STATUS_PATH, ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const selected = selectedPortalCompanyId(req.user as any);
    const client = selected ? deps.getClient(selected) : undefined;
    const notices = await listNoticesForCompany(client ? client.id : null);
    const view = buildStatusView(notices, now(), client ? { id: client.id, name: client.companyName } : null);
    // Clients never see which company a notice was scoped to or who else it covers.
    const strip = (list: StatusNotice[]) => list.map(({ clientId: _c, ...rest }) => ({ ...rest, forAllClients: _c === null }));
    res.json({
      success: true,
      ...view,
      active: strip(view.active),
      inProgress: strip(view.inProgress),
      upcoming: strip(view.upcoming),
      history: strip(view.history),
    });
  });

  app.get(ADMIN_STATUS_PATH, ...deps.adminGuards, async (_req: AuthedRequest, res: Response) => {
    const notices = await listAllNotices();
    res.json({ success: true, notices: notices.map(withCompany) });
  });

  app.post(ADMIN_STATUS_PATH, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const parsed = noticeInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error.issues) });
    if (badClient(parsed.data.clientId)) return res.status(400).json({ error: "That company doesn't exist", fieldErrors: { clientId: "Choose a company or All clients" } });
    const notice = await createNotice(parsed.data, actor(req), now());
    res.status(201).json({ success: true, notice: withCompany(notice) });
  });

  app.patch(`${ADMIN_STATUS_PATH}/:id`, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const current = await getNotice(req.params.id);
    if (!current) return res.status(404).json({ error: "Notice not found" });
    // Edits send the whole notice; reuse the create rules on the merged result.
    const merged = { ...current, ...(req.body ?? {}) };
    const parsed = noticeInputSchema.safeParse({
      clientId: merged.clientId ?? null,
      kind: merged.kind,
      severity: merged.severity,
      title: merged.title,
      body: merged.body,
      affectedServices: merged.affectedServices,
      startsAt: merged.startsAt,
      endsAt: merged.endsAt ?? null,
    });
    if (!parsed.success) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error.issues) });
    if (badClient(parsed.data.clientId)) return res.status(400).json({ error: "That company doesn't exist", fieldErrors: { clientId: "Choose a company or All clients" } });
    const reopen = req.body?.reopen === true;
    const updated = await updateNotice(current.id, { ...parsed.data, ...(reopen ? { resolvedAt: null } : {}) }, now());
    res.json({ success: true, notice: withCompany(updated!) });
  });

  app.post(`${ADMIN_STATUS_PATH}/:id/updates`, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const current = await getNotice(req.params.id);
    if (!current) return res.status(404).json({ error: "Notice not found" });
    const parsed = noticeUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error.issues) });
    const at = now();
    const updates = [...current.updates, { at: at.toISOString(), byName: actor(req).name, body: parsed.data.body }];
    const resolvedAt = parsed.data.resolve ? current.resolvedAt ?? at.toISOString() : current.resolvedAt;
    const updated = await updateNotice(current.id, { updates, resolvedAt }, at);
    res.json({ success: true, notice: withCompany(updated!) });
  });

  app.delete(`${ADMIN_STATUS_PATH}/:id`, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const ok = await deleteNotice(req.params.id);
    if (!ok) return res.status(404).json({ error: "Notice not found" });
    res.json({ success: true });
  });
}

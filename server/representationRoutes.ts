import type { Express, RequestHandler, Response } from "express";
import {
  GROUP_REQUEST_KINDS,
  groupRequestInputSchema,
  groupsRepresentedBy,
  publicGroupView,
  scopeForKind,
  type RepresentationProjection,
} from "@shared/representation";
import { createGroupRequest, listGroupRequests, setGroupRequestDeskTicket, type GroupRequest } from "./groupRequestStore";
import { effectiveClientId } from "./serviceRequestRoutes";

/**
 * Client Portal: what a Hub-defined representative can see and do.
 *
 * GET  /api/portal/representation/me        the groups I represent
 * GET  /api/portal/representation/requests  requests for those groups
 * POST /api/portal/representation/requests  file a request for one of them
 *
 * Authorization happens here, on the server, against the Hub projection
 * (fetched signed, validated, cached briefly) for the session's company only.
 * A representative sees only the groups they represent and the group-level
 * requests filed for them — no employee records, other departments,
 * confidential tickets, money or admin settings. Representation is not
 * approval: these routes never approve anything.
 */

export type RepresentationRouteDeps = {
  guards: RequestHandler[];
  getClient: (id: string) => { id?: string; companyName?: string; hubAccountId?: string | null } | undefined;
  findUser: (id: string) => { id: string; email: string; fullName: string; isActive?: boolean | null } | undefined;
  fetchProjection: (hubAccountId: string, portalClientId: string) => Promise<RepresentationProjection | null>;
  /** Optional Zoho Desk ticket; returns its id or null. Must not throw. */
  createDeskTicket?: (input: { subject: string; description: string; email: string }) => Promise<string | null>;
  now?: () => Date;
};

export const REPRESENTATION_PATH = "/api/portal/representation";

type SessionUser = { id: string; role?: string; clientId?: string | null; impersonatingCompanyId?: string | null; email?: string };

function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function publicRequest(r: GroupRequest) {
  return {
    id: r.id,
    number: r.number,
    scopeKey: r.scopeKey,
    groupName: r.groupName,
    kind: r.kind,
    subject: r.subject,
    description: r.description,
    status: r.status,
    submittedByMe: false,
    hasDeskTicket: Boolean(r.deskTicketId),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function registerRepresentationRoutes(app: Express, deps: RepresentationRouteDeps): void {
  const now = () => (deps.now ? deps.now() : new Date());

  /** Session company, its Hub account, and the groups this user currently represents. */
  async function context(req: any, res: Response) {
    const user = req.user as SessionUser | undefined;
    const clientId = effectiveClientId(user as any);
    if (!user || !clientId) {
      res.status(400).json({ error: "No company is selected" });
      return null;
    }
    const client = deps.getClient(clientId);
    const live = deps.findUser(user.id);
    if (!client) {
      res.status(404).json({ error: "Company not found" });
      return null;
    }
    const hubAccountId = (client.hubAccountId || "").trim();
    if (!hubAccountId) return { user, clientId, hubAccountId: null as string | null, groups: [] as ReturnType<typeof groupsRepresentedBy>, linked: false, available: true };
    const projection = await deps.fetchProjection(hubAccountId, clientId);
    // A DE admin viewing a company is not one of its people; they represent nothing.
    const groups =
      user.role === "admin" || !live || live.isActive === false
        ? []
        : groupsRepresentedBy(projection, { id: live.id, email: live.email }, today(now()));
    return { user, clientId, hubAccountId, groups, linked: true, available: projection != null };
  }

  app.get(`${REPRESENTATION_PATH}/me`, ...deps.guards, async (req: any, res: Response) => {
    const ctx = await context(req, res);
    if (!ctx) return;
    res.setHeader("Cache-Control", "no-store");
    res.json({
      success: true,
      linked: ctx.linked,
      available: ctx.available,
      groups: ctx.groups.map(publicGroupView),
      kinds: GROUP_REQUEST_KINDS,
    });
  });

  app.get(`${REPRESENTATION_PATH}/requests`, ...deps.guards, async (req: any, res: Response) => {
    const ctx = await context(req, res);
    if (!ctx) return;
    const rows = await listGroupRequests(ctx.clientId, ctx.groups.map((g) => g.scopeKey));
    res.setHeader("Cache-Control", "no-store");
    res.json({
      success: true,
      requests: rows.map((r) => ({ ...publicRequest(r), submittedByMe: r.submittedByUserId === ctx.user.id })),
    });
  });

  app.post(`${REPRESENTATION_PATH}/requests`, ...deps.guards, async (req: any, res: Response) => {
    const parsed = groupRequestInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
      return;
    }
    const ctx = await context(req, res);
    if (!ctx) return;
    if (!ctx.linked) {
      res.status(409).json({ error: "This company is not linked to Digerati Experts' records yet" });
      return;
    }
    if (!ctx.available) {
      res.status(503).json({ error: "Your representation details can't be checked right now. Try again shortly." });
      return;
    }
    const group = ctx.groups.find((g) => g.scopeKey === parsed.data.scopeKey);
    if (!group) {
      res.status(403).json({ error: "You don't represent this group" });
      return;
    }
    if (!group.myScopes.includes(scopeForKind(parsed.data.kind))) {
      res.status(403).json({ error: "Your representation for this group doesn't cover this kind of request" });
      return;
    }
    const created = await createGroupRequest(
      {
        clientId: ctx.clientId,
        hubAccountId: ctx.hubAccountId!,
        scopeKey: group.scopeKey,
        groupName: group.name,
        kind: parsed.data.kind,
        subject: parsed.data.subject,
        description: parsed.data.description,
        submittedByUserId: ctx.user.id,
        submittedByRole: group.myRole,
      },
      now(),
    );
    const live = deps.findUser(ctx.user.id);
    if (deps.createDeskTicket && live) {
      const kindLabel = GROUP_REQUEST_KINDS.find((k) => k.key === parsed.data.kind)!.label;
      const ticketId = await deps.createDeskTicket({
        subject: `[${group.name}] ${kindLabel}: ${parsed.data.subject}`,
        description: [
          parsed.data.description,
          "",
          `Filed by ${live.fullName} as ${group.myRole} representative for ${group.name} (${group.scopeKey}).`,
          `Portal group request ${created.number}. Hub account ${ctx.hubAccountId}.`,
          "Representation is coordination only; it is not approval authority.",
        ].join("\n"),
        email: live.email,
      });
      if (ticketId) {
        await setGroupRequestDeskTicket(created.id, ticketId);
        created.deskTicketId = ticketId;
      }
    }
    res.status(201).json({ success: true, request: { ...publicRequest(created), submittedByMe: true } });
  });
}

import type { Express, Request, RequestHandler, Response } from "express";
import { listServiceRequestsForUser } from "./serviceRequestStore";
import { effectiveClientId, type DirectoryClient, type DirectoryUser, type ServiceRequestUser } from "./serviceRequestRoutes";
import { BASKET_STATUS, todayIso } from "@shared/serviceRequests";

/**
 * Ask DE in the Client Portal (bottom-right help chat). Signed-in only; the
 * Desk session is derived from the session user, so a person can read and
 * write only their own thread. Request status context comes from the same
 * scoped query My Requests uses.
 */

type AuthedRequest = Request & { user?: ServiceRequestUser };

export function registerPortalAssistRoutes(
  app: Express,
  deps: {
    guards: RequestHandler[];
    getClient: (id: string) => DirectoryClient | undefined;
    findUser: (id: string) => DirectoryUser | undefined;
  },
): void {
  app.post("/api/portal/assist/chat", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const message = typeof req.body?.message === "string" ? req.body.message : "";
    if (!message.trim()) return res.status(400).json({ error: "Message is required" });
    const advisor = await import("./services/msp-advisor");
    const user = req.user!;
    const clientId = effectiveClientId(user);
    const client = clientId ? deps.getClient(clientId) : undefined;
    const me = deps.findUser(user.id);
    const rows = clientId ? await listServiceRequestsForUser(clientId, user.id) : [];
    const myRequests = rows
      .filter((r) => r.status !== BASKET_STATUS)
      .map((r) => ({
        number: r.number,
        type: r.type,
        status: r.status,
        requestedFor: deps.findUser(r.requestedForUserId)?.fullName || "someone",
        updatedAt: r.updatedAt,
      }));
    const formRaw = req.body?.form;
    const form =
      formRaw && typeof formRaw === "object"
        ? {
            values: typeof formRaw.values === "object" && formRaw.values ? (formRaw.values as Record<string, unknown>) : {},
            missing: Array.isArray(formRaw.missing) ? formRaw.missing.filter((m: unknown) => typeof m === "string").slice(0, 20) : [],
          }
        : null;
    try {
      const out = await advisor.handlePortalAssistChat(
        {
          user: {
            id: user.id,
            name: me?.fullName || user.fullName || "there",
            email: me?.email || user.email || "",
            companyName: client?.companyName || "",
          },
          message,
          page: advisor.sanitizePageInput(req.body?.page),
          form,
          myRequests,
        },
        todayIso(),
      );
      res.json({ success: true, ...out });
    } catch (error: any) {
      res.status(error?.status === 400 ? 400 : 500).json({ error: error?.status === 400 ? error.message : "Ask DE is unavailable right now" });
    }
  });

  app.get("/api/portal/assist/messages", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const advisor = await import("./services/msp-advisor");
    const since = typeof req.query.since === "string" ? req.query.since : null;
    const sessionId = advisor.portalAssistSessionId(req.user!.id);
    try {
      const out = await advisor.getDeskMessagesSince(sessionId, since);
      res.json({
        success: true,
        agentLive: out.agentLive,
        messages: out.messages.slice(-50).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          senderName: m.senderName ?? null,
          createdAt: m.createdAt,
        })),
      });
    } catch {
      res.json({ success: true, agentLive: false, messages: [] });
    }
  });
}

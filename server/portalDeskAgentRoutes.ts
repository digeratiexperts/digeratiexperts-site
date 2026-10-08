import type { Express, Request, RequestHandler, Response } from "express";

/**
 * DE Desk live-handoff actions: a DE agent replying into the public website
 * chat widget, and claiming or releasing a visitor's session.
 *
 * Lifted out of routes.ts so the authorization can be tested over real HTTP
 * (issue #249). These are DE-staff actions, so they are admin-only. Before
 * this module they ran on authMiddleware alone, gated only by
 * `session.email === req.user.email`: any signed-in portal user whose email
 * matched a Desk session (their own public-site chat, say) could reply to the
 * public widget *as a DE agent*, and claim or release the session — stopping
 * the AI and showing "a specialist joined" to the visitor. The agent's
 * display name also came from a caller-supplied `senderName`. The reply,
 * claim and release are now admin-only, and the agent name is the signed-in
 * agent's own, never a value from the request body.
 *
 * Archive and delete are the same DE-staff tier: archive files a chat (or
 * every live chat from the same company) into that company's folder; delete
 * removes the chat and its messages for good.
 *
 * The read routes (list, and a single conversation) stay in routes.ts: a
 * client may see their own linked Desk thread, scoped to their email.
 */

const DESK_CHATS_BASE = "/api/portal/desk-chats";
const MAX_REPLY_LENGTH = 8000;

type DeskAgentRequest = Request & {
  user?: { role?: string | null; fullName?: string | null; email?: string | null };
};

/** The signed-in agent's own name — never a caller-supplied senderName. */
export function agentDisplayName(req: DeskAgentRequest): string {
  const name = String(req.user?.fullName || req.user?.email || "DE Agent").trim().slice(0, 120);
  return name || "DE Agent";
}

export interface DeskAgentRouteOptions {
  /** [authMiddleware, requireAdmin] in production; tests pass stand-ins. */
  actionGuards: RequestHandler[];
  /** actionGuards plus validateInput for the reply body. */
  replyGuards: RequestHandler[];
}

export function registerPortalDeskAgentRoutes(
  app: Express,
  { actionGuards, replyGuards }: DeskAgentRouteOptions,
): void {
  // Agent reply → appears in the public website DE Desk widget.
  app.post(`${DESK_CHATS_BASE}/:sessionId/reply`, replyGuards, async (req: DeskAgentRequest, res: Response) => {
    try {
      const { getDeskSessionMessages, appendDeskMessage, claimDeskSession } = await import("./services/msp-advisor");
      const sessionId = req.params.sessionId;
      const content = String(req.body?.content || "").trim();
      if (!content) return res.status(400).json({ error: "content is required" });
      if (content.length > MAX_REPLY_LENGTH) return res.status(400).json({ error: "Message too long" });

      const { session } = await getDeskSessionMessages(sessionId);
      if (!session) return res.status(404).json({ error: "Conversation not found" });

      const agentName = agentDisplayName(req);
      await claimDeskSession(sessionId, agentName);
      const message = await appendDeskMessage({ sessionId, role: "agent", content, senderName: agentName });
      res.json({ success: true, message, agentLive: true, agentName });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send reply" });
    }
  });

  app.post(`${DESK_CHATS_BASE}/:sessionId/claim`, actionGuards, async (req: DeskAgentRequest, res: Response) => {
    try {
      const { getDeskSessionMessages, claimDeskSession } = await import("./services/msp-advisor");
      const { session } = await getDeskSessionMessages(req.params.sessionId);
      if (!session) return res.status(404).json({ error: "Conversation not found" });
      const updated = await claimDeskSession(req.params.sessionId, agentDisplayName(req));
      res.json({ success: true, session: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to claim conversation" });
    }
  });

  app.post(`${DESK_CHATS_BASE}/:sessionId/release`, actionGuards, async (req: DeskAgentRequest, res: Response) => {
    try {
      const { getDeskSessionMessages, releaseDeskSession } = await import("./services/msp-advisor");
      const { session } = await getDeskSessionMessages(req.params.sessionId);
      if (!session) return res.status(404).json({ error: "Conversation not found" });
      const updated = await releaseDeskSession(req.params.sessionId);
      res.json({ success: true, session: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to release conversation" });
    }
  });

  // Archive one chat, or with { company: true } every live chat from the same
  // company, into that company's folder.
  app.post(`${DESK_CHATS_BASE}/:sessionId/archive`, actionGuards, async (req: DeskAgentRequest, res: Response) => {
    try {
      const { getDeskSessionMessages, archiveDeskSessions, sessionIdsInSameCompany } = await import(
        "./services/msp-advisor/persist"
      );
      const sessionId = req.params.sessionId;
      const { session } = await getDeskSessionMessages(sessionId);
      if (!session) return res.status(404).json({ error: "Conversation not found" });
      const ids = req.body?.company === true ? await sessionIdsInSameCompany(sessionId) : [sessionId];
      const sessions = await archiveDeskSessions(ids);
      res.json({ success: true, sessions, folder: sessions[0]?.archiveFolder ?? null });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to archive conversation" });
    }
  });

  app.post(`${DESK_CHATS_BASE}/:sessionId/unarchive`, actionGuards, async (req: DeskAgentRequest, res: Response) => {
    try {
      const { getDeskSessionMessages, unarchiveDeskSession } = await import("./services/msp-advisor/persist");
      const { session } = await getDeskSessionMessages(req.params.sessionId);
      if (!session) return res.status(404).json({ error: "Conversation not found" });
      const updated = await unarchiveDeskSession(req.params.sessionId);
      res.json({ success: true, session: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to restore conversation" });
    }
  });

  app.delete(`${DESK_CHATS_BASE}/:sessionId`, actionGuards, async (req: DeskAgentRequest, res: Response) => {
    try {
      const { deleteDeskSession } = await import("./services/msp-advisor/persist");
      const deleted = await deleteDeskSession(req.params.sessionId);
      if (!deleted) return res.status(404).json({ error: "Conversation not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete conversation" });
    }
  });
}

import type { Express, NextFunction, Request, Response } from "express";
import { requireDeSyncAuth } from "./deSyncAuth";
import { handleHubEvents } from "./hubEvents";
import {
  enqueueOutbox,
  getCatalogSnapshot,
  getOldestPendingAgeMs,
  listConflicts,
  listFailures,
  listOutbox,
  retryFailed,
  saveCatalogSnapshot,
} from "./deSyncStore";
import { fetchPublicCatalog, pingHub } from "./techSalesClient";
import { addPortalSseClient } from "./portalSse";
import type { DeSyncEventType } from "./deSyncContract";
import { getClient, listUniqueUsers } from "../portalAuthStore";
import { ensureDeSyncSchema } from "./ensureDeSyncSchema";
import { logger } from "../logger";
import { assertPortalCommandAllowed } from "./tenantIdentity";
import { toPublicCatalog } from "./clientProjection";
import { buildPortalProfileCommand } from "./profileSync";

type AuthedRequest = Request & {
  user?: { role?: string; clientId?: string | null };
  userId?: string;
};

type AuthMiddleware = (req: AuthedRequest, res: Response, next: NextFunction) => void;

const PORTAL_COMMANDS: DeSyncEventType[] = [
  "account.profile_update_requested",
  "quote.requested",
  "quote.response_submitted",
  "approval.submitted",
  "assessment.response_submitted",
  "onboarding.response_submitted",
  "document.acknowledged",
  "service.change_requested",
];

function healthStatus(opts: { configured: boolean; reachable: boolean; oldestPendingMs: number | null }): "healthy" | "degraded" | "failed" | "not_configured" {
  if (!opts.configured) return "not_configured";
  if (!opts.reachable) return "failed";
  if (opts.oldestPendingMs !== null && opts.oldestPendingMs > 15 * 60 * 1000) return "degraded";
  return "healthy";
}

async function requireDeSyncSchema(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureDeSyncSchema();
    next();
  } catch (error) {
    logger.error("DE integration schema bootstrap unavailable", error);
    res.status(503).json({ error: "DE integration storage unavailable" });
  }
}

export function registerDeSyncRoutes(app: Express, authMiddleware: AuthMiddleware): void {
  app.post(
    "/api/integrations/v1/hub/events",
    requireDeSyncAuth("hub_to_website"),
    requireDeSyncSchema,
    handleHubEvents,
  );

  app.get("/api/integrations/health", requireDeSyncSchema, async (_req: Request, res: Response) => {
    const hubUrl = (process.env.TECHSALES_HUB_URL || process.env.TECHSALES_SYNC_URL || "").trim();
    const ping = hubUrl ? await pingHub() : { ok: false, latencyMs: 0 };
    const oldestPendingMs = await getOldestPendingAgeMs();
    const pending = (await listOutbox("pending")).length;
    const failed = (await listOutbox("failed")).length;
    const status = healthStatus({
      configured: Boolean(hubUrl),
      reachable: ping.ok,
      oldestPendingMs,
    });
    res.status(status === "failed" ? 503 : 200).json({
      status,
      hub: {
        configured: Boolean(hubUrl),
        reachable: ping.ok,
        latencyMs: ping.latencyMs,
        httpStatus: ping.status,
      },
      outbox: { pending, failed, oldestPendingMs },
    });
  });

  app.get("/api/integrations/v1/public-catalog", requireDeSyncSchema, async (_req: Request, res: Response) => {
    const cached = await getCatalogSnapshot();
    if (cached) {
      return res.json({
        source: "last_known_good",
        publishedAt: cached.publishedAt,
        ...toPublicCatalog(cached.snapshot),
      });
    }
    const live = await fetchPublicCatalog();
    if (live) {
      const safe = toPublicCatalog(live);
      await saveCatalogSnapshot(safe);
      return res.json({ source: "hub", ...safe });
    }
    return res.json({
      source: "none",
      message: "Hub catalog snapshot is not available. Storefront continues to use the local published catalog.",
      tiers: [],
    });
  });

  app.post(
    "/api/integrations/v1/reconcile/account/:accountId",
    requireDeSyncAuth("hub_to_website"),
    requireDeSyncSchema,
    async (req: Request, res: Response) => {
      const accountId = String(req.params.accountId || "").trim();
      if (!accountId) return res.status(400).json({ error: "accountId required" });
      res.json({ ok: true, accountId, projectionsRefreshed: false, message: "Site stores Hub projections only; no command echo." });
    },
  );

  app.get("/api/integrations/conflicts", [authMiddleware, requireDeSyncSchema], async (req: AuthedRequest, res: Response) => {
    if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
    res.json({ conflicts: await listConflicts(), failures: await listFailures() });
  });

  app.post("/api/integrations/retry", [authMiddleware, requireDeSyncSchema], async (req: AuthedRequest, res: Response) => {
    if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const eventId = typeof req.body?.eventId === "string" ? req.body.eventId : undefined;
    const count = await retryFailed(eventId);
    res.json({ ok: true, retried: count });
  });

  app.get("/api/portal/events/stream", [authMiddleware], (req: AuthedRequest, res: Response) => {
    req.headers["x-no-compression"] = "1";
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ eventType: "stream.ready", entityId: req.userId || "anon" })}\n\n`);
    const clientRecord = req.user?.clientId ? getClient(req.user.clientId) : undefined;
    addPortalSseClient(res, {
      role: req.user?.role || "user",
      clientId: req.user?.clientId || null,
      hubAccountId: clientRecord?.hubAccountId || null,
    });
  });

  app.post(
    "/api/portal/integrations/commands",
    [authMiddleware, requireDeSyncSchema],
    async (req: AuthedRequest, res: Response) => {
      const eventType = req.body?.eventType as DeSyncEventType;
      if (!PORTAL_COMMANDS.includes(eventType)) {
        return res.status(400).json({ error: "Unsupported portal command" });
      }
      const client = req.user?.clientId ? getClient(req.user.clientId) : undefined;
      const actor = listUniqueUsers().find((user) => user.id === req.userId);
      const commandGate = assertPortalCommandAllowed({
        actor: {
          id: req.userId,
          role: req.user?.role || actor?.role,
          storeRole: actor?.storeRole,
          clientId: req.user?.clientId || actor?.clientId,
          isActive: actor?.isActive,
        },
        client: client
          ? {
              id: client.id,
              companyName: client.companyName,
              serviceType: client.serviceType,
              status: client.status,
              hubAccountId: client.hubAccountId,
            }
          : null,
        eventType,
        payload: req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : {},
      });
      if (!commandGate.ok) {
        return res.status(commandGate.status).json({ error: commandGate.error, code: commandGate.code });
      }
      const rawPayload =
        req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : {};
      let canonicalAccountId = client?.hubAccountId || null;
      let payload: Record<string, unknown> = {
        ...rawPayload,
        portalClientId: req.user?.clientId || null,
        actorUserId: req.userId || null,
      };
      delete payload.canonicalAccountId;
      delete payload.hubAccountId;
      if (eventType === "account.profile_update_requested") {
        const command = buildPortalProfileCommand({
          hubAccountId: client?.hubAccountId,
          portalClientId: req.user?.clientId || "",
          actorUserId: req.userId || null,
          payload: rawPayload,
        });
        if (!command.ok) {
          return res.status(command.status).json({ error: command.error, code: command.code });
        }
        canonicalAccountId = command.canonicalAccountId;
        payload = command.payload;
      }
      const envelope = await enqueueOutbox({
        eventType,
        source: "portal",
        destination: "hub",
        entityType: typeof req.body?.entityType === "string" ? req.body.entityType : "command",
        entityId: typeof req.body?.entityId === "string" ? req.body.entityId : undefined,
        canonicalAccountId,
        payload,
      });
      res.status(202).json({ ok: true, eventId: envelope.eventId });
    },
  );
}

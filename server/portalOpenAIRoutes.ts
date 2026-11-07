import type { Express, RequestHandler, Request, Response } from "express";
import type { OpenAIControlResponse } from "@shared/openaiControl";
import { openaiConfig } from "./services/openai-config";

/** No CORS opt-in: browser writes require JSON, a non-simple header, and same origin. */
const requireControlRequest: RequestHandler = (req, res, next) => {
  const origin = req.get("origin");
  const expectedOrigin = `${req.protocol}://${req.get("host")}`;
  if (req.get("X-DE-OpenAI-Control") !== "1"
    || !req.is("application/json")
    || req.get("sec-fetch-site") === "cross-site"
    || (origin !== undefined && origin !== expectedOrigin)) {
    res.status(403).json({ error: "OpenAI control request could not be verified." });
    return;
  }
  next();
};

export function registerPortalOpenAIRoutes(app: Express, deps: {
  guards: RequestHandler[];
  audit: (req: Parameters<RequestHandler>[0], enabled: boolean) => void;
}): void {
  const response = (): OpenAIControlResponse => ({
    success: true,
    status: openaiConfig.getStatus(),
    message: "Runtime state applies to this server process only; restart restores the startup environment setting.",
  });
  const noStore: RequestHandler = (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); };
  app.get("/api/portal/admin/openai/status", noStore, deps.guards, (_req: Request, res: Response) => {
    res.json(response());
  });
  for (const enabled of [true, false]) {
    app.post(`/api/portal/admin/openai/${enabled ? "enable" : "disable"}`, noStore, deps.guards, requireControlRequest, (req: Request, res: Response) => {
      if (enabled) openaiConfig.enable(); else openaiConfig.disable();
      // Audit failure must not undo a disable or falsely report that it failed.
      try { deps.audit(req, enabled); } catch { console.warn("[OpenAI] Runtime control audit unavailable"); }
      res.json(response());
    });
  }
  app.post("/api/portal/admin/openai/toggle", noStore, deps.guards, requireControlRequest, (_req: Request, res: Response) => {
    res.status(410).json({ error: "Choose the explicit enable or disable operation." });
  });
}

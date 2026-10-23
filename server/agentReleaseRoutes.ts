import type { Express, RequestHandler, Response } from "express";
import { readReleaseStatus, type ReleaseSource } from "./agentRelease";

/**
 * DE endpoint agent release over HTTP (server/agentRelease.ts).
 *
 * - GET /api/portal/agent/release: what a signed-in user may download. Only a
 *   verified release is offered; otherwise { available: false } and nothing
 *   about why (that is for DE staff).
 * - GET /api/portal/agent/download?target=windows/amd64: sign-in required;
 *   re-verifies, then redirects to that build's https URL.
 * - GET /api/portal/admin/agent-release: DE admin view with the reason a
 *   release is not offered and which settings are missing.
 */

export type AgentReleaseRouteDeps = {
  guards: RequestHandler[];
  adminGuards: RequestHandler[];
  source: ReleaseSource;
};

export const AGENT_RELEASE_PATH = "/api/portal/agent/release";
export const AGENT_DOWNLOAD_PATH = "/api/portal/agent/download";
export const ADMIN_AGENT_RELEASE_PATH = "/api/portal/admin/agent-release";

export function registerAgentReleaseRoutes(app: Express, deps: AgentReleaseRouteDeps): void {
  app.get(AGENT_RELEASE_PATH, ...deps.guards, async (_req, res: Response) => {
    const status = await readReleaseStatus(deps.source);
    if (status.state !== "ready") return res.json({ success: true, available: false });
    const { version, issuedAt, artifacts } = status.release;
    res.json({
      success: true,
      available: true,
      version,
      issuedAt,
      artifacts: artifacts.map(({ target, sha256, size }) => ({
        target,
        sha256,
        size,
        downloadPath: `${AGENT_DOWNLOAD_PATH}?target=${encodeURIComponent(target)}`,
      })),
    });
  });

  app.get(AGENT_DOWNLOAD_PATH, ...deps.guards, async (req, res: Response) => {
    const target = typeof req.query.target === "string" ? req.query.target : "";
    const status = await readReleaseStatus(deps.source);
    if (status.state !== "ready") return res.status(404).json({ error: "No agent release is published yet." });
    const artifact = status.release.artifacts.find((a) => a.target === target);
    if (!artifact) return res.status(404).json({ error: "That build is not in the current release." });
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, artifact.url);
  });

  app.get(ADMIN_AGENT_RELEASE_PATH, ...deps.adminGuards, async (_req, res: Response) => {
    res.json({ success: true, status: await readReleaseStatus(deps.source) });
  });
}

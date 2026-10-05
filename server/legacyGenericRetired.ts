import type { Express, NextFunction, Request, Response } from "express";

/**
 * The legacy generic data and chat APIs are retired (#232).
 *
 * Workspaces, projects, boards, tasks, labels and comments were a generic
 * project-board model from the original scaffold, and `/api/chat` posted
 * messages against a portal ticket id. Nothing in `client/`, `shared/` or
 * `scripts/` calls any of them: the portal's chats use `/api/portal/chat/*`
 * and `/api/portal/desk-chats`, and Ask DE uses `/api/public/advisor/chat`.
 *
 * Every method on these paths, and on anything below them, now answers
 * 410 Gone, so a caller outside this repository fails loudly instead of
 * reaching a handler.
 */
export const LEGACY_GENERIC_RETIRED_PREFIXES = [
  "/api/workspaces",
  "/api/projects",
  "/api/boards",
  "/api/tasks",
  "/api/labels",
  "/api/comments",
  "/api/chat",
] as const;

export function isRetiredLegacyGenericPath(path: string): boolean {
  return LEGACY_GENERIC_RETIRED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function registerRetiredLegacyGenericRoutes(app: Express): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isRetiredLegacyGenericPath(req.path)) return next();
    res.status(410).json({ error: "This endpoint has been retired." });
  });
}

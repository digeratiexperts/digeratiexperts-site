import type { Express, Request, Response } from "express";

/**
 * The legacy generic `/api/auth/register` and `/api/auth/login` routes are
 * retired (#236).
 *
 * They wrote to and authenticated against the generic `users` table and minted
 * a JWT with a caller-chosen email. The shared `authMiddleware` resolves the
 * live **portal** identity, so those tokens could never authenticate a real
 * request (they 401 as "Account not found"), and before the identity binding
 * in `authMiddleware` a token whose email named a portal account resolved to
 * that account, admin included. Nothing in `client/` calls either route.
 *
 * Portal sign-in is `/api/portal/login` and registration is
 * `/api/portal/register`. Both legacy paths now answer 410 Gone and mint
 * nothing, so no second identity model can issue tokens.
 */
export const LEGACY_AUTH_RETIRED_PATHS = ["/api/auth/register", "/api/auth/login"] as const;

export function registerRetiredLegacyAuthRoutes(app: Express): void {
  const gone = (_req: Request, res: Response) => {
    res.status(410).json({
      error: "This sign-in endpoint has been retired. Use the client portal at /portal/login.",
    });
  };
  for (const path of LEGACY_AUTH_RETIRED_PATHS) {
    app.post(path, gone);
  }
}

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { findUserById } from "./portalOrg";
import { getUser as portalAuthGetUser } from "./portalAuthStore";
import { getJwtSecretOrNull } from "./config/authSecrets";

export const PORTAL_AUTH_COOKIE = "portalAuth";
export const GENERIC_NOT_FOUND_JSON = { error: "Not found" } as const;

const GENERIC_NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Not found</title>
  <meta name="robots" content="noindex, nofollow">
</head>
<body>
  <p>Not found</p>
</body>
</html>
`;

type JwtClaims = {
  userId?: string;
  email?: string;
  role?: string;
};

function jwtSecret(): string | null {
  return getJwtSecretOrNull();
}

function readSessionToken(req: Request): string {
  const authHeader = req.headers.authorization;
  const bearer =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";
  const cookieToken =
    typeof req.cookies?.[PORTAL_AUTH_COOKIE] === "string"
      ? req.cookies[PORTAL_AUTH_COOKIE]
      : "";
  return bearer || cookieToken;
}

function isDisabled(live: object): boolean {
  const record = live as { disabled?: unknown; status?: unknown; isActive?: unknown };
  return (
    Boolean(record.disabled) ||
    record.status === "disabled" ||
    record.status === "revoked" ||
    record.isActive === false
  );
}

/** Live portal record only. JWT role claims are not authorization. */
export function resolveWarehouseStaff(req: Request): { id: string; email: string } | null {
  const token = readSessionToken(req);
  const secret = jwtSecret();
  if (!token || !secret) return null;

  try {
    const decoded = jwt.verify(token, secret) as JwtClaims;
    const live =
      (decoded.email ? portalAuthGetUser(decoded.email) : undefined) ||
      (decoded.userId ? findUserById(decoded.userId) : null);
    if (!live || isDisabled(live)) return null;
    if ((live.role || "user") !== "admin") return null;
    return { id: live.id, email: live.email };
  } catch {
    return null;
  }
}

export function isWarehouseHtmlPath(path: string): boolean {
  return path === "/internal/warehouse" || path.startsWith("/internal/warehouse/");
}

export function isWarehouseCatalogApiPath(path: string): boolean {
  return (
    path === "/api/store/solutions" ||
    path.startsWith("/api/store/solutions/") ||
    path === "/api/store/cart" ||
    path.startsWith("/api/store/cart/")
  );
}

export function applyPrivateCacheHeaders(res: Response): void {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store");
  res.removeHeader("Location");
}

export function sendGenericNotFound(req: Request, res: Response): void {
  applyPrivateCacheHeaders(res);
  const wantsJson =
    req.path.startsWith("/api") ||
    (typeof req.headers.accept === "string" && req.headers.accept.includes("application/json"));
  if (wantsJson) {
    res.status(404).json(GENERIC_NOT_FOUND_JSON);
    return;
  }
  res.status(404).type("html").send(GENERIC_NOT_FOUND_HTML);
}

export function requireWarehouseStaffApi(req: Request, res: Response, next: NextFunction): void {
  if (resolveWarehouseStaff(req)) {
    next();
    return;
  }
  sendGenericNotFound(req, res);
}

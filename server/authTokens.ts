import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

export const PORTAL_JWT_AUDIENCE = "digeratiexperts-portal";
export const WORKSPACE_JWT_AUDIENCE = "digeratiexperts-workspace";

export type PortalAuthClaims = {
  userId: string;
  email: string;
  role: string;
  portalSessionId: string;
  [key: string]: unknown;
};

export type WorkspaceAuthClaims = {
  userId: string;
  email: string;
  role: string;
  [key: string]: unknown;
};

export type VerifiedPortalAuthToken = JwtPayload &
  PortalAuthClaims & { tokenType: "portal" };

export type VerifiedWorkspaceAuthToken = JwtPayload &
  WorkspaceAuthClaims & { tokenType: "workspace" };

function requirePayload(value: string | JwtPayload): JwtPayload {
  if (typeof value === "string") throw new Error("JWT payload must be an object");
  return value;
}

export function signPortalAuthToken(
  claims: PortalAuthClaims,
  secret: string,
  expiresIn: SignOptions["expiresIn"] = "24h",
): string {
  return jwt.sign(
    { ...claims, tokenType: "portal" },
    secret,
    { audience: PORTAL_JWT_AUDIENCE, expiresIn },
  );
}

export function verifyPortalAuthToken(token: string, secret: string): VerifiedPortalAuthToken {
  const payload = requirePayload(
    jwt.verify(token, secret, { audience: PORTAL_JWT_AUDIENCE }),
  );
  if (
    payload.tokenType !== "portal" ||
    typeof payload.userId !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.role !== "string" ||
    typeof payload.portalSessionId !== "string"
  ) {
    throw new Error("Invalid portal token type or claims");
  }
  return payload as VerifiedPortalAuthToken;
}

export function signWorkspaceAuthToken(
  claims: WorkspaceAuthClaims,
  secret: string,
  expiresIn: SignOptions["expiresIn"] = "24h",
): string {
  return jwt.sign(
    { ...claims, tokenType: "workspace" },
    secret,
    { audience: WORKSPACE_JWT_AUDIENCE, expiresIn },
  );
}

export function verifyWorkspaceAuthToken(token: string, secret: string): VerifiedWorkspaceAuthToken {
  const payload = requirePayload(
    jwt.verify(token, secret, { audience: WORKSPACE_JWT_AUDIENCE }),
  );
  if (
    payload.tokenType !== "workspace" ||
    typeof payload.userId !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.role !== "string"
  ) {
    throw new Error("Invalid workspace token type or claims");
  }
  return payload as VerifiedWorkspaceAuthToken;
}

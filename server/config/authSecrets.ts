import { randomBytes } from "crypto";

/**
 * Canonical JWT secret resolution. Every module that signs or verifies portal
 * JWTs must resolve the secret through here so tokens verify consistently
 * across routes, gates, and middleware.
 *
 * Production fails closed: a missing or placeholder JWT_SECRET aborts instead
 * of silently generating a per-process secret (which invalidated all sessions
 * on restart and broke multi-module verification).
 */

const PLACEHOLDER_SECRETS = new Set([
  "CHANGE_THIS_IN_PRODUCTION",
  "dev-secret-key-change-in-production",
]);

let devFallbackSecret: string | null = null;
let warnedShortSecret = false;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET;

  if (configured && !PLACEHOLDER_SECRETS.has(configured)) {
    if (isProduction() && configured.length < 32 && !warnedShortSecret) {
      warnedShortSecret = true;
      console.warn(
        "[auth] JWT_SECRET is shorter than 32 characters; rotate to a longer random value.",
      );
    }
    return configured;
  }

  if (isProduction()) {
    throw new Error(
      "JWT_SECRET must be set to a secure non-placeholder value in production. Refusing to start auth with an insecure secret.",
    );
  }

  // Development/test only: one stable per-process secret, never a hardcoded string.
  if (!devFallbackSecret) {
    devFallbackSecret = randomBytes(32).toString("hex");
    console.warn(
      "[auth] JWT_SECRET not set — using an ephemeral development secret; sessions will not survive restarts.",
    );
  }
  return devFallbackSecret;
}

/** For gates that deny (rather than crash) when no secret is available. */
export function getJwtSecretOrNull(): string | null {
  try {
    return resolveJwtSecret();
  } catch {
    return null;
  }
}

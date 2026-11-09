import { createHmac, createHash, randomUUID, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import type { DeSyncSource } from "./deSyncContract";
import { logger } from "../logger";

export type SyncDirection =
  | "website_to_hub"
  | "portal_to_hub"
  | "hub_to_website"
  | "hub_to_portal";

const TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

export function requestPath(req: Request): string {
  const raw = String(req.originalUrl || req.url || req.path || "").split("?")[0];
  if (raw.startsWith("/api/")) return raw;
  if (req.baseUrl === "/api") return `/api${req.path}`;
  return raw || req.path;
}

/** The scoped secret's env name for each direction (names only, never values). */
export const SCOPED_SECRET_ENV: Readonly<Record<SyncDirection, string>> = {
  website_to_hub: "WEBSITE_TO_HUB_SECRET",
  portal_to_hub: "PORTAL_TO_HUB_SECRET",
  hub_to_website: "HUB_TO_WEBSITE_SECRET",
  hub_to_portal: "HUB_TO_PORTAL_SECRET",
};

/**
 * The migration-era shared secrets (names only). No DE-Sync direction accepts
 * or signs with them any more; the health endpoint still reports whether they
 * are set. Do not delete the env vars yet: the Hub's /api/webhooks/website-lead
 * route checks WEBSITE_LEAD_WEBHOOK_SECRET on its own and is retired separately.
 */
export const LEGACY_SECRET_ENV = ["TECHSALES_SYNC_TOKEN", "WEBSITE_LEAD_WEBHOOK_SECRET"] as const;

export const DE_SYNC_DIRECTIONS: readonly SyncDirection[] = [
  "website_to_hub",
  "portal_to_hub",
  "hub_to_website",
  "hub_to_portal",
];

const MISSING_SECRET_LOG_INTERVAL_MS = 60 * 60 * 1000;
const lastMissingSecretLogAt = new Map<SyncDirection, number>();

/** Test seam: forget when each direction last logged a missing secret. */
export function resetMissingSecretLogs(): void {
  lastMissingSecretLogAt.clear();
}

/**
 * Fail closed with a clear operator message: the direction's scoped secret is
 * not set, so every request on it is refused (inbound 503) or not sent
 * (outbound). Logged once per direction per hour; names the env variable,
 * never a value. The HTTP answer stays a bare "Integration not configured".
 */
export function logMissingScopedSecret(direction: SyncDirection, now: number = Date.now()): void {
  const last = lastMissingSecretLogAt.get(direction);
  if (last != null && now - last < MISSING_SECRET_LOG_INTERVAL_MS) return;
  lastMissingSecretLogAt.set(direction, now);
  const scopedEnv = SCOPED_SECRET_ENV[direction];
  logger.error(
    `DE-Sync ${direction} is refused: ${scopedEnv} is not set (the legacy shared-secret fallback was removed). Set it on both sides.`,
    undefined,
    { event: "de_sync.scoped_secret_missing", direction, scopedSecretEnv: scopedEnv },
  );
}

/** The direction's scoped secret, or "" when it is not set. There is no fallback. */
export function resolveScopedSecret(direction: SyncDirection): { secret: string } {
  return { secret: (process.env[SCOPED_SECRET_ENV[direction]] || "").trim() };
}

/**
 * The secret to SIGN an outbound request with: the scoped secret, or "" when
 * it is not set. On "" the caller does not send, and the missing variable is
 * logged (once per direction per hour).
 */
export function outboundSecret(direction: SyncDirection, _route: string): string {
  const { secret } = resolveScopedSecret(direction);
  if (!secret) logMissingScopedSecret(direction);
  return secret;
}

function expectedSource(direction: SyncDirection): DeSyncSource {
  switch (direction) {
    case "website_to_hub":
      return "website";
    case "portal_to_hub":
      return "portal";
    case "hub_to_website":
    case "hub_to_portal":
      return "techsales";
  }
}

export function hashBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function signDeSyncRequest(input: {
  method: string;
  path: string;
  timestamp: string;
  eventId: string;
  body: string;
  secret: string;
}): string {
  const canonical = [
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.eventId,
    hashBody(input.body),
  ].join("\n");
  return createHmac("sha256", input.secret).update(canonical, "utf8").digest("hex");
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function buildSignedHeaders(input: {
  method: string;
  path: string;
  eventId: string;
  source: DeSyncSource;
  body: string;
  secret: string;
}): Record<string, string> {
  const timestamp = new Date().toISOString();
  const signature = signDeSyncRequest({
    method: input.method,
    path: input.path,
    timestamp,
    eventId: input.eventId,
    body: input.body,
    secret: input.secret,
  });
  return {
    "Content-Type": "application/json",
    "X-DE-Event-ID": input.eventId,
    "X-DE-Timestamp": timestamp,
    "X-DE-Source": input.source,
    "X-DE-Signature": signature,
    // No raw-secret copy (Authorization / x-de-sync-token): the Hub verifies
    // the HMAC whenever it is present, and the raw secret beside it let anyone
    // who saw one request skip the HMAC entirely.
  };
}

export function verifySignedRequest(
  req: Request,
  direction: SyncDirection,
): { ok: true; eventId: string; source: string; eventIdBound: boolean } | { ok: false; status: number; error: string } {
  const { secret } = resolveScopedSecret(direction);
  if (!secret) {
    logMissingScopedSecret(direction);
    return { ok: false, status: 503, error: "Integration not configured" };
  }

  const rawEventId = String(req.get("x-de-event-id") || "").trim();
  const timestamp = String(req.get("x-de-timestamp") || "").trim();
  const source = String(req.get("x-de-source") || "").trim();
  const signature = String(req.get("x-de-signature") || "").trim();

  if (signature || timestamp) {
    if (!signature || !timestamp || !rawEventId) {
      return { ok: false, status: 401, error: "Incomplete integration signature headers" };
    }
    if (source !== expectedSource(direction)) {
      return { ok: false, status: 401, error: "Invalid integration source" };
    }

    const ts = Date.parse(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > TIMESTAMP_SKEW_MS) {
      return { ok: false, status: 401, error: "Stale integration timestamp" };
    }

    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    const path = requestPath(req);

    const expected = signDeSyncRequest({
      method: req.method,
      path,
      timestamp,
      eventId: rawEventId,
      body,
      secret,
    });
    if (timingSafeStringEqual(expected, signature)) {
      return { ok: true, eventId: rawEventId, source, eventIdBound: true };
    }

    return { ok: false, status: 401, error: "Invalid integration signature" };
  }

  // Legacy static-token fallback (no HMAC, no replay window, no body binding).
  // Set DE_SYNC_REQUIRE_SIGNED=1 to refuse it and require the signed path once
  // the Hub sends signatures — this closes the "token leaked in a log forges
  // events" gap. Default-off preserves the live integration until the Hub is
  // cut over, at which point flipping the flag is the whole remediation.
  if (process.env.DE_SYNC_REQUIRE_SIGNED === "1") {
    return { ok: false, status: 401, error: "Signed integration request required" };
  }

  const eventId = rawEventId || randomUUID();
  const provided =
    String(req.get("x-de-sync-token") || "").trim() ||
    (String(req.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || "").trim();

  if (!provided) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (timingSafeStringEqual(provided, secret)) {
    return { ok: true, eventId, source, eventIdBound: false };
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}

export function requireDeSyncAuth(direction: SyncDirection) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = verifySignedRequest(req, direction);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    (req as Request & { deSync?: { eventId: string; source: string; eventIdBound: boolean } }).deSync = {
      eventId: result.eventId,
      source: result.source,
      eventIdBound: result.eventIdBound,
    };
    return next();
  };
}

export function newEventId(): string {
  return randomUUID();
}

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

/** The migration-era shared secrets being retired (names only). */
export const LEGACY_SECRET_ENV = ["TECHSALES_SYNC_TOKEN", "WEBSITE_LEAD_WEBHOOK_SECRET"] as const;

export const DE_SYNC_DIRECTIONS: readonly SyncDirection[] = [
  "website_to_hub",
  "portal_to_hub",
  "hub_to_website",
  "hub_to_portal",
];

const LEGACY_WARN_INTERVAL_MS = 60 * 60 * 1000;
const lastLegacyWarnAt = new Map<SyncDirection, number>();
let recorderModule: Promise<typeof import("./deSyncLegacyCredential")> | null = null;

/** Test seam: forget when each direction last warned. */
export function resetLegacyCredentialWarnings(): void {
  lastLegacyWarnAt.clear();
}

/**
 * A request was verified with (inbound), or signed with (outbound), the
 * legacy shared secret instead of the direction's scoped one. Logs ONE
 * structured warning per direction per hour (never a secret value) and counts
 * EVERY use in `de_sync_legacy_credential_uses` for the health endpoint.
 * Never throws and never waits on the database.
 */
export function noteLegacyCredentialUse(input: {
  direction: SyncDirection;
  route: string;
  source: string;
  now?: number;
}): void {
  try {
    const now = input.now ?? Date.now();
    const route = String(input.route || "").split("?")[0].slice(0, 200);
    const scopedEnv = SCOPED_SECRET_ENV[input.direction];
    const last = lastLegacyWarnAt.get(input.direction);
    if (last == null || now - last >= LEGACY_WARN_INTERVAL_MS) {
      lastLegacyWarnAt.set(input.direction, now);
      logger.warn(
        "DE-Sync used the legacy shared secret instead of the scoped secret (logged once per direction per hour; every use is counted)",
        {
          event: "de_sync.legacy_credential_used",
          direction: input.direction,
          route,
          source: String(input.source || "").slice(0, 40) || null,
          scopedSecretEnv: scopedEnv,
          scopedSecretConfigured: Boolean((process.env[scopedEnv] || "").trim()),
        },
      );
    }
    // Lazy import: this module stays free of the database client so callers
    // and tests that only verify signatures do not load it.
    recorderModule ??= import("./deSyncLegacyCredential");
    void recorderModule
      .then((m) => m.recordLegacyCredentialUse({ direction: input.direction, route, source: input.source, at: new Date(now) }))
      .catch(() => undefined);
  } catch {
    /* observation must never break a request */
  }
}

/**
 * The secret to SIGN an outbound request with: exactly one, the scoped secret
 * when it is set. While it is missing the legacy fallback is still used (PR 1
 * observes only) and the use is noted for `route` (path only).
 */
export function outboundSecret(direction: SyncDirection, route: string): string {
  const { secret, legacy } = resolveScopedSecret(direction);
  if (secret && legacy) {
    noteLegacyCredentialUse({ direction, route, source: expectedSource(direction) });
  }
  return secret;
}

function legacySecret(): string {
  return (
    process.env.TECHSALES_SYNC_TOKEN ||
    process.env.WEBSITE_LEAD_WEBHOOK_SECRET ||
    ""
  ).trim();
}

export function resolveScopedSecret(direction: SyncDirection): { secret: string; legacy: boolean } {
  const next = (process.env[SCOPED_SECRET_ENV[direction]] || "").trim();
  if (next) return { secret: next, legacy: false };

  const legacy = legacySecret();
  return { secret: legacy, legacy: !!legacy };
}

function acceptedSecrets(direction: SyncDirection): Array<{ secret: string; legacy: boolean }> {
  const primary = resolveScopedSecret(direction);
  const legacy = legacySecret();
  const candidates: Array<{ secret: string; legacy: boolean }> = [];

  if (primary.secret) candidates.push(primary);
  if (legacy && legacy !== primary.secret) candidates.push({ secret: legacy, legacy: true });

  return candidates;
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
): { ok: true; eventId: string; source: string; legacy: boolean; eventIdBound: boolean } | { ok: false; status: number; error: string } {
  const candidates = acceptedSecrets(direction);
  if (candidates.length === 0) {
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

    for (const candidate of candidates) {
      const expected = signDeSyncRequest({
        method: req.method,
        path,
        timestamp,
        eventId: rawEventId,
        body,
        secret: candidate.secret,
      });
      if (!timingSafeStringEqual(expected, signature)) continue;

      if (candidate.legacy) noteLegacyCredentialUse({ direction, route: path, source });
      return { ok: true, eventId: rawEventId, source, legacy: candidate.legacy, eventIdBound: true };
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

  for (const candidate of candidates) {
    if (!timingSafeStringEqual(provided, candidate.secret)) continue;
    if (candidate.legacy) noteLegacyCredentialUse({ direction, route: requestPath(req), source });
    return { ok: true, eventId, source, legacy: candidate.legacy, eventIdBound: false };
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

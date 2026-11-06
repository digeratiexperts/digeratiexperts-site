/**
 * Legacy shared-secret use on DE-Sync directions (retiring
 * TECHSALES_SYNC_TOKEN / WEBSITE_LEAD_WEBHOOK_SECRET as a fallback).
 * Website mirror of Intelligence-Hub `de-sync-legacy-credential.ts` (#841).
 *
 * Each time a request is verified with the legacy secret instead of the
 * direction's scoped secret (inbound), or the site signs with it because the
 * scoped secret is missing (outbound), `deSyncAuth.ts` calls
 * `recordLegacyCredentialUse()`. That adds one to the direction's row for the
 * current UTC hour in `de_sync_legacy_credential_uses`, so the health
 * endpoint can show "legacy secret used N times in the last 7 days" per
 * direction and the count survives restarts and deploys.
 *
 * Best-effort: never throws, never blocks the request, and stores only
 * direction, route path and X-DE-Source. Never a secret or a header value
 * that could carry one.
 *
 * Read side: `loadLegacyCredentialUsage()` THROWS when the table cannot be
 * read, so the health endpoint reports "unknown" (null), never 0. The 7-day
 * check that gates removing the fallback must never pass on missing data.
 */
import { pool } from "../db";
import { logger } from "../logger";
import { ensureDeSyncSchema } from "./ensureDeSyncSchema";
import { DE_SYNC_DIRECTIONS, LEGACY_SECRET_ENV, SCOPED_SECRET_ENV, type SyncDirection } from "./deSyncAuth";

export const LEGACY_CREDENTIAL_WINDOW_DAYS = 7;

export interface LegacyCredentialUseInput {
  direction: string;
  route: string;
  source: string;
  at?: Date;
}

export interface LegacyCredentialUsage {
  uses: number;
  lastUsedAt: Date | null;
  lastRoute: string | null;
  lastSource: string | null;
}

let unavailableLogged = false;

export function hourBucket(at: Date): Date {
  const d = new Date(at.getTime());
  d.setUTCMinutes(0, 0, 0);
  return d;
}

/** Route path only (no query string, which can carry tenant ids), capped. */
export function cleanRoute(route: string): string {
  return String(route || "").split("?")[0].slice(0, 200);
}

const UPSERT = `
  INSERT INTO de_sync_legacy_credential_uses
    (direction, hour_bucket, uses, last_used_at, last_route, last_source)
  VALUES ($1, $2, 1, $3, $4, $5)
  ON CONFLICT (direction, hour_bucket) DO UPDATE SET
    uses = de_sync_legacy_credential_uses.uses + 1,
    last_route = CASE WHEN EXCLUDED.last_used_at >= de_sync_legacy_credential_uses.last_used_at
      THEN EXCLUDED.last_route ELSE de_sync_legacy_credential_uses.last_route END,
    last_source = CASE WHEN EXCLUDED.last_used_at >= de_sync_legacy_credential_uses.last_used_at
      THEN EXCLUDED.last_source ELSE de_sync_legacy_credential_uses.last_source END,
    last_used_at = GREATEST(EXCLUDED.last_used_at, de_sync_legacy_credential_uses.last_used_at)`;

export async function recordLegacyCredentialUse(input: LegacyCredentialUseInput): Promise<void> {
  const at = input.at ?? new Date();
  const route = cleanRoute(input.route) || null;
  const source = String(input.source || "").slice(0, 40) || null;
  try {
    await ensureDeSyncSchema();
    if (!process.env.DATABASE_URL || !pool) {
      if (!unavailableLogged) {
        unavailableLogged = true;
        logger.warn("de_sync_legacy_credential_uses unavailable (no database); legacy secret uses are logged but not counted");
      }
      return;
    }
    await pool.query(UPSERT, [input.direction, hourBucket(at), at, route, source]);
  } catch (err) {
    logger.warn("legacy DE-Sync credential use could not be counted", {
      direction: input.direction,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Uses per direction in the last `days` days. Throws when the table cannot be
 * read (no database, bootstrap failed, query failed), so the caller says the
 * count is unavailable instead of showing a false zero.
 */
export async function loadLegacyCredentialUsage(
  now: Date = new Date(),
  days: number = LEGACY_CREDENTIAL_WINDOW_DAYS,
): Promise<Map<string, LegacyCredentialUsage>> {
  await ensureDeSyncSchema();
  if (!process.env.DATABASE_URL || !pool) {
    throw new Error("legacy use count is unavailable: no database");
  }
  const since = hourBucket(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
  const result = await pool.query(
    `SELECT direction, uses, last_used_at, last_route, last_source
       FROM de_sync_legacy_credential_uses
      WHERE hour_bucket >= $1`,
    [since],
  );
  const map = new Map<string, LegacyCredentialUsage>();
  for (const row of result.rows as Array<Record<string, unknown>>) {
    const direction = String(row.direction);
    const lastUsedAt = row.last_used_at ? new Date(row.last_used_at as string | Date) : null;
    const prev = map.get(direction);
    const newer = !prev?.lastUsedAt || (lastUsedAt !== null && lastUsedAt.getTime() > prev.lastUsedAt.getTime());
    map.set(direction, {
      uses: (prev?.uses ?? 0) + Number(row.uses ?? 0),
      lastUsedAt: newer ? lastUsedAt : prev!.lastUsedAt,
      lastRoute: newer ? ((row.last_route as string | null) ?? null) : prev!.lastRoute,
      lastSource: newer ? ((row.last_source as string | null) ?? null) : prev!.lastSource,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Health read model (per direction). Names and counts only, never a value.
// ---------------------------------------------------------------------------

export interface DirectionCredentialHealth {
  direction: SyncDirection;
  scopedEnv: string;
  scopedConfigured: boolean;
  /** Names of the legacy env vars that are set (values never read out). */
  legacyEnvConfigured: string[];
  /** Uses in the last 7 days; null = unknown (count unreadable), never 0 by default. */
  legacyUses7d: number | null;
  /** ISO time of the last legacy use in the window; "unknown" when the count is unreadable. */
  lastUsedAt: string | null;
  lastRoute: string | null;
  lastSource: string | null;
  /** Why legacyUses7d is null. */
  countError: string | null;
}

export type LegacyRetirementState = "ready" | "not_ready" | "unknown";

function envSet(env: NodeJS.ProcessEnv, name: string): boolean {
  return Boolean((env[name] || "").trim());
}

/** Pure: build the per-direction rows. `usage === null` means the count could not be read. */
export function directionCredentialHealth(
  env: NodeJS.ProcessEnv,
  usage: Map<string, LegacyCredentialUsage> | null,
  usageError: string | null,
): DirectionCredentialHealth[] {
  return DE_SYNC_DIRECTIONS.map((direction) => {
    const scopedEnv = SCOPED_SECRET_ENV[direction];
    const u = usage?.get(direction) ?? null;
    return {
      direction,
      scopedEnv,
      scopedConfigured: envSet(env, scopedEnv),
      legacyEnvConfigured: LEGACY_SECRET_ENV.filter((n) => envSet(env, n)),
      legacyUses7d: usage ? (u?.uses ?? 0) : null,
      lastUsedAt: usage ? (u?.lastUsedAt?.toISOString() ?? null) : "unknown",
      lastRoute: u?.lastRoute ?? null,
      lastSource: u?.lastSource ?? null,
      countError: usage ? null : usageError || "legacy use count is unavailable",
    };
  });
}

/**
 * "ready" only when every direction has its scoped secret AND a readable count
 * of 0. Any unreadable count is "unknown", so the gate can never pass on
 * missing data.
 */
export function legacyRetirementState(rows: DirectionCredentialHealth[]): LegacyRetirementState {
  if (rows.some((r) => r.legacyUses7d === null)) return "unknown";
  return rows.every((r) => r.scopedConfigured && r.legacyUses7d === 0) ? "ready" : "not_ready";
}

export async function loadDirectionCredentialHealth(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Promise<{
  windowDays: number;
  state: LegacyRetirementState;
  directions: DirectionCredentialHealth[];
  leadWebhookFallback: LeadWebhookFallbackHealth;
}> {
  let usage: Map<string, LegacyCredentialUsage> | null = null;
  let usageError: string | null = null;
  try {
    usage = await loadLegacyCredentialUsage(now);
  } catch (err) {
    usageError = err instanceof Error ? err.message : String(err);
  }
  const directions = directionCredentialHealth(env, usage, usageError);
  return {
    windowDays: LEGACY_CREDENTIAL_WINDOW_DAYS,
    state: legacyRetirementState(directions),
    directions,
    leadWebhookFallback: leadWebhookFallbackHealth(env, usage, usageError),
  };
}

/**
 * The site's fallback to the Hub's /webhooks/website-lead (not a DE-Sync
 * direction; it does not affect `state`). Counted so that route can be
 * retired once it shows 0 uses. Names only, never a value.
 */
export interface LeadWebhookFallbackHealth {
  urlEnv: "TECHSALES_SYNC_URL";
  urlConfigured: boolean;
  secretEnv: "WEBSITE_LEAD_WEBHOOK_SECRET";
  secretConfigured: boolean;
  /** Uses in the last 7 days; null = unknown (count unreadable), never 0 by default. */
  uses7d: number | null;
  lastUsedAt: string | null;
  countError: string | null;
}

export function leadWebhookFallbackHealth(
  env: NodeJS.ProcessEnv,
  usage: Map<string, LegacyCredentialUsage> | null,
  usageError: string | null,
): LeadWebhookFallbackHealth {
  const u = usage?.get("website_lead_webhook") ?? null;
  return {
    urlEnv: "TECHSALES_SYNC_URL",
    urlConfigured: envSet(env, "TECHSALES_SYNC_URL"),
    secretEnv: "WEBSITE_LEAD_WEBHOOK_SECRET",
    secretConfigured: envSet(env, "WEBSITE_LEAD_WEBHOOK_SECRET"),
    uses7d: usage ? (u?.uses ?? 0) : null,
    lastUsedAt: usage ? (u?.lastUsedAt?.toISOString() ?? null) : "unknown",
    countError: usage ? null : usageError || "legacy use count is unavailable",
  };
}

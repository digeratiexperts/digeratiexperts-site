/**
 * Portal "login door knocks" — durable audit of who/what hits the login surface.
 * Tracks page hits, failed/success auth, MFA failures, and bot-ish signals.
 */
import { sql, desc } from "drizzle-orm";
import { db, dbReady, initPromise } from "./db";
import { randomBytes } from "crypto";
import { boundedKnockText, normalizeKnockMeta, normalizeKnockPath, PAGE_HIT_RETENTION_MS } from "./portalLoginKnocksPolicy";

export type KnockKind =
  | "page_hit"
  | "login_failed"
  | "login_success"
  | "mfa_failed"
  | "mfa_success"
  | "zoho_start"
  | "zoho_failed"
  | "turnstile_failed"
  | "locked_out";

export type LoginKnock = {
  id: string;
  kind: KnockKind;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  path: string | null;
  isBotLikely: boolean;
  botReason: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
};

const memory: LoginKnock[] = [];
const MAX_MEMORY = 2000;
let schemaReady = false;
let nextPageHitPruneAt = 0;

async function pruneOldPageHits(): Promise<void> {
  const now = Date.now();
  if (now < nextPageHitPruneAt) return;
  nextPageHitPruneAt = now + 60 * 60 * 1000;
  const cutoff = new Date(now - PAGE_HIT_RETENTION_MS).toISOString();
  for (let i = memory.length - 1; i >= 0; i--) {
    if (memory[i].kind === "page_hit" && memory[i].createdAt < cutoff) memory.splice(i, 1);
  }
  if (dbReady && db && schemaReady) {
    try {
      // Preserve real sign-in/MFA audit events; only anonymous page beacons expire.
      await db.execute(sql`DELETE FROM portal_login_knocks WHERE kind = 'page_hit' AND created_at < ${cutoff}::timestamptz`);
    } catch {
      console.warn("[loginKnocks] page-hit retention cleanup failed");
    }
  }
}

function newId(): string {
  return randomBytes(12).toString("hex");
}

export function classifyBotSignal(userAgent?: string | null, meta?: Record<string, unknown>): {
  isBotLikely: boolean;
  botReason: string | null;
} {
  const ua = (userAgent || "").toLowerCase();
  if (!ua || ua.length < 12) return { isBotLikely: true, botReason: "missing_or_short_ua" };
  const botHints = [
    "bot",
    "crawler",
    "spider",
    "curl/",
    "wget",
    "python-requests",
    "httpclient",
    "scrapy",
    "headless",
    "phantom",
    "selenium",
  ];
  for (const h of botHints) {
    if (ua.includes(h)) return { isBotLikely: true, botReason: `ua:${h}` };
  }
  if (meta?.turnstileFailed) return { isBotLikely: true, botReason: "turnstile_failed" };
  if (meta?.rapidFire) return { isBotLikely: true, botReason: "rapid_fire" };
  return { isBotLikely: false, botReason: null };
}

async function ensureSchema(): Promise<void> {
  if (schemaReady || !dbReady || !db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS portal_login_knocks (
        id varchar PRIMARY KEY,
        kind text NOT NULL,
        email text,
        ip text,
        user_agent text,
        path text,
        is_bot_likely boolean DEFAULT false,
        bot_reason text,
        meta jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_portal_login_knocks_created
      ON portal_login_knocks (created_at DESC)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_portal_login_knocks_ip_created
      ON portal_login_knocks (ip, created_at DESC)
    `);
    schemaReady = true;
  } catch (err: any) {
    console.warn("[loginKnocks] schema ensure:", err?.message);
  }
}

export async function initPortalLoginKnocks(): Promise<void> {
  await initPromise;
  await ensureSchema();
  if (dbReady && schemaReady) console.log("✅ Portal login knocks store ready");
}

export async function recordLoginKnock(input: {
  kind: KnockKind;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  path?: string | null;
  meta?: Record<string, unknown>;
}): Promise<LoginKnock> {
  await ensureSchema();
  await pruneOldPageHits();
  const userAgent = boundedKnockText(input.userAgent, 512);
  const meta = normalizeKnockMeta(input.meta);
  const bot = classifyBotSignal(userAgent, meta);
  const knock: LoginKnock = {
    id: newId(),
    kind: input.kind,
    email: boundedKnockText(input.email, 254),
    ip: boundedKnockText(input.ip, 64),
    userAgent,
    path: normalizeKnockPath(input.path),
    isBotLikely: bot.isBotLikely,
    botReason: bot.botReason,
    meta,
    createdAt: new Date().toISOString(),
  };

  memory.unshift(knock);
  if (memory.length > MAX_MEMORY) memory.length = MAX_MEMORY;

  if (dbReady && db && schemaReady) {
    try {
      await db.execute(sql`
        INSERT INTO portal_login_knocks
          (id, kind, email, ip, user_agent, path, is_bot_likely, bot_reason, meta, created_at)
        VALUES (
          ${knock.id},
          ${knock.kind},
          ${knock.email},
          ${knock.ip},
          ${knock.userAgent},
          ${knock.path},
          ${knock.isBotLikely},
          ${knock.botReason},
          ${JSON.stringify(knock.meta)}::jsonb,
          ${knock.createdAt}::timestamptz
        )
      `);
    } catch (err: any) {
      console.warn("[loginKnocks] insert failed:", err?.message);
    }
  }
  return knock;
}

export async function listLoginKnocks(opts?: {
  limit?: number;
  sinceHours?: number;
}): Promise<LoginKnock[]> {
  await ensureSchema();
  const limit = Math.min(opts?.limit || 200, 500);
  const sinceHours = opts?.sinceHours || 72;

  if (dbReady && db && schemaReady) {
    try {
      const rows = await db.execute(sql`
        SELECT id, kind, email, ip, user_agent, path, is_bot_likely, bot_reason, meta, created_at
        FROM portal_login_knocks
        WHERE created_at > now() - (${sinceHours}::text || ' hours')::interval
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      const list = (rows as any).rows || rows;
      return (list as any[]).map((r) => ({
        id: r.id,
        kind: r.kind,
        email: r.email,
        ip: r.ip,
        userAgent: r.user_agent,
        path: r.path,
        isBotLikely: !!r.is_bot_likely,
        botReason: r.bot_reason,
        meta: typeof r.meta === "string" ? JSON.parse(r.meta) : r.meta || {},
        createdAt: new Date(r.created_at).toISOString(),
      }));
    } catch (err: any) {
      console.warn("[loginKnocks] list failed:", err?.message);
    }
  }

  const cutoff = Date.now() - sinceHours * 3600_000;
  return memory.filter((k) => new Date(k.createdAt).getTime() >= cutoff).slice(0, limit);
}

export async function summarizeLoginKnocks(sinceHours = 24): Promise<{
  sinceHours: number;
  total: number;
  bots: number;
  humans: number;
  failed: number;
  success: number;
  pageHits: number;
  uniqueIps: number;
  topIps: Array<{ ip: string; count: number; bots: number }>;
}> {
  const knocks = await listLoginKnocks({ limit: 1000, sinceHours });
  const byIp = new Map<string, { count: number; bots: number }>();
  let bots = 0;
  let failed = 0;
  let success = 0;
  let pageHits = 0;
  for (const k of knocks) {
    if (k.isBotLikely) bots++;
    if (k.kind === "login_failed" || k.kind === "mfa_failed" || k.kind === "zoho_failed") failed++;
    if (k.kind === "login_success" || k.kind === "mfa_success") success++;
    if (k.kind === "page_hit") pageHits++;
    const ip = k.ip || "unknown";
    const cur = byIp.get(ip) || { count: 0, bots: 0 };
    cur.count++;
    if (k.isBotLikely) cur.bots++;
    byIp.set(ip, cur);
  }
  const topIps = Array.from(byIp.entries())
    .map(([ip, v]) => ({ ip, count: v.count, bots: v.bots }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    sinceHours,
    total: knocks.length,
    bots,
    humans: knocks.length - bots,
    failed,
    success,
    pageHits,
    uniqueIps: byIp.size,
    topIps,
  };
}

export function clientIpFromReq(req: { headers?: any; ip?: string; socket?: any }): string | null {
  const xf = req.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim();
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

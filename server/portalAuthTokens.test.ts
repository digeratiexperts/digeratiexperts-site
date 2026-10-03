import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #251 / #241: verification and reset tokens must survive a restart, be stored
 * only as a hash, work exactly once, and be revoked by a newer token. The SQL
 * path runs the real Drizzle queries against a tiny pg-proxy fake; the memory
 * path is the dev/test fallback.
 */

type Row = Record<string, any>;
const table: Row[] = [];
const statements: string[] = [];

const COLS = ["id", "purpose", "token_hash", "user_id", "email", "created_at", "expires_at", "consumed_at", "revoked_at"];
const q = (list: string) => [...list.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

function matches(row: Row, where: string, params: unknown[]): boolean {
  for (const m of where.matchAll(/"portal_auth_tokens"\."([a-z_]+)" = \$(\d+)/g)) {
    if (row[m[1]] !== params[Number(m[2]) - 1]) return false;
  }
  for (const m of where.matchAll(/"portal_auth_tokens"\."([a-z_]+)" is null/g)) {
    if (row[m[1]] !== null && row[m[1]] !== undefined) return false;
  }
  for (const m of where.matchAll(/"portal_auth_tokens"\."([a-z_]+)" > \$(\d+)/g)) {
    if (!(String(row[m[1]]) > String(params[Number(m[2]) - 1]))) return false;
  }
  return true;
}

// node-postgres returns timestamp-without-tz as "YYYY-MM-DD HH:MM:SS.mmm"; Drizzle appends "+0000" itself.
const wire = (c: string, v: unknown) =>
  typeof v === "string" && /_at$/.test(c) ? v.replace("T", " ").replace("Z", "") : (v ?? null);
const project = (row: Row, list: string) => q(list).map((c) => wire(c, row[c]));

async function fakeDriver(sql: string, params: unknown[]) {
  statements.push(sql);
  if (!sql.includes('"portal_auth_tokens"')) return { rows: [] };
  if (sql.startsWith("insert")) {
    const [, cols, vals] = sql.match(/\(([^)]*)\) values \(([^)]*)\)/)!;
    const tokens = vals.split(",").map((t) => t.trim());
    const row: Row = Object.fromEntries(COLS.map((c) => [c, null]));
    q(cols).forEach((n, i) => {
      if (tokens[i].startsWith("$")) row[n] = params[Number(tokens[i].slice(1)) - 1];
    });
    if (table.some((r) => r.token_hash === row.token_hash)) throw new Error("duplicate token_hash");
    table.push(row);
    return { rows: [] };
  }
  if (sql.startsWith("update")) {
    const m = sql.match(/ set (.*?) where (.*?)(?: returning (.*))?$/)!;
    const hits = table.filter((r) => matches(r, m[2], params));
    for (const r of hits) for (const s of m[1].matchAll(/"([a-z_]+)" = \$(\d+)/g)) r[s[1]] = params[Number(s[2]) - 1];
    return { rows: m[3] ? hits.map((r) => project(r, m[3])) : [] };
  }
  if (sql.startsWith("select")) {
    const m = sql.match(/^select (.*) from "portal_auth_tokens" where (.*?)( order by .*?)?( limit \$\d+)?$/)!;
    const rows = table.filter((r) => matches(r, m[2], params));
    if (m[3]?.includes("desc")) rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return { rows: rows.map((r) => project(r, m[1])) };
  }
  throw new Error(`Unhandled fake SQL: ${sql}`);
}

async function load(opts: { dbReady: boolean; nodeEnv?: string }) {
  vi.resetModules();
  process.env.NODE_ENV = opts.nodeEnv ?? "test";
  process.env.VITEST = "true";
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const db = opts.dbReady ? drizzle(async (sql, params) => fakeDriver(sql, params)) : null;
  vi.doMock("./db", () => ({ db, dbReady: opts.dbReady, initPromise: Promise.resolve(opts.dbReady) }));
  const mod = await import("./portalAuthTokens");
  mod.resetAuthTokensForTests();
  return mod;
}

describe("durable auth tokens (#251)", () => {
  const env = { ...process.env };
  beforeEach(() => {
    table.length = 0;
    statements.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  for (const mode of ["database", "memory"] as const) {
    describe(`${mode} backend`, () => {
      const open = () => load({ dbReady: mode === "database" });

      it("a token works once, then is invalid", async () => {
        const t = await open();
        const raw = await t.issueAuthToken({ purpose: "email_verification", userId: "u1", email: "A@x.test", ttlMs: 60_000 });
        const first = await t.consumeAuthToken("email_verification", raw);
        expect(first).toMatchObject({ ok: true, userId: "u1", email: "a@x.test" });
        expect(await t.consumeAuthToken("email_verification", raw)).toEqual({ ok: false, reason: "invalid" });
      });

      it("is bound to its purpose: a verification token cannot reset a password", async () => {
        const t = await open();
        const raw = await t.issueAuthToken({ purpose: "email_verification", userId: "u1", email: "a@x.test", ttlMs: 60_000 });
        expect(await t.consumeAuthToken("password_reset", raw)).toEqual({ ok: false, reason: "invalid" });
        expect((await t.consumeAuthToken("email_verification", raw)).ok).toBe(true);
      });

      it("an expired token is refused and reported as expired", async () => {
        const t = await open();
        const now = new Date("2026-10-03T00:00:00Z");
        const raw = await t.issueAuthToken({ purpose: "password_reset", userId: "u1", email: "a@x.test", ttlMs: 1000, now });
        const later = new Date(now.getTime() + 5000);
        expect(await t.consumeAuthToken("password_reset", raw, later)).toEqual({ ok: false, reason: "expired" });
      });

      it("issuing a new token revokes the older one for that user and purpose only", async () => {
        const t = await open();
        const old = await t.issueAuthToken({ purpose: "password_reset", userId: "u1", email: "a@x.test", ttlMs: 60_000 });
        const other = await t.issueAuthToken({ purpose: "email_verification", userId: "u1", email: "a@x.test", ttlMs: 60_000 });
        const fresh = await t.issueAuthToken({ purpose: "password_reset", userId: "u1", email: "a@x.test", ttlMs: 60_000 });
        expect(await t.consumeAuthToken("password_reset", old)).toEqual({ ok: false, reason: "invalid" });
        expect((await t.consumeAuthToken("password_reset", fresh)).ok).toBe(true);
        expect((await t.consumeAuthToken("email_verification", other)).ok).toBe(true);
      });

      it("release makes a consumed token usable again (failed downstream write)", async () => {
        const t = await open();
        const raw = await t.issueAuthToken({ purpose: "password_reset", userId: "u1", email: "a@x.test", ttlMs: 60_000 });
        const used = await t.consumeAuthToken("password_reset", raw);
        if (!used.ok) throw new Error("expected consume");
        await t.releaseAuthToken(used.id);
        expect((await t.consumeAuthToken("password_reset", raw)).ok).toBe(true);
      });

      it("reports a fresh token for the resend cooldown", async () => {
        const t = await open();
        const now = new Date("2026-10-03T00:00:00Z");
        expect(await t.hasFreshAuthToken("email_verification", "a@x.test", 60_000, now)).toBe(false);
        await t.issueAuthToken({ purpose: "email_verification", userId: "u1", email: "A@x.test", ttlMs: 3_600_000, now });
        expect(await t.hasFreshAuthToken("email_verification", "a@X.test", 60_000, new Date(now.getTime() + 10_000))).toBe(true);
        expect(await t.hasFreshAuthToken("email_verification", "a@x.test", 60_000, new Date(now.getTime() + 120_000))).toBe(false);
      });

      it("rejects garbage tokens without touching state", async () => {
        const t = await open();
        expect(await t.consumeAuthToken("password_reset", "")).toEqual({ ok: false, reason: "invalid" });
        expect(await t.consumeAuthToken("password_reset", "short")).toEqual({ ok: false, reason: "invalid" });
      });
    });
  }

  it("stores only the hash, and the link survives a restart", async () => {
    const before = await load({ dbReady: true });
    const raw = await before.issueAuthToken({ purpose: "email_verification", userId: "u1", email: "a@x.test", ttlMs: 60_000 });
    expect(table).toHaveLength(1);
    expect(JSON.stringify(table)).not.toContain(raw);
    expect(table[0].token_hash).toMatch(/^[0-9a-f]{64}$/);

    // Restart: a fresh module instance with no process memory, same database.
    const after = await load({ dbReady: true });
    expect((await after.consumeAuthToken("email_verification", raw)).ok).toBe(true);
  });

  it("consume is a single conditional UPDATE (atomic one-time use)", async () => {
    const t = await load({ dbReady: true });
    const raw = await t.issueAuthToken({ purpose: "password_reset", userId: "u1", email: "a@x.test", ttlMs: 60_000 });
    statements.length = 0;
    await t.consumeAuthToken("password_reset", raw);
    const update = statements.find((s) => s.startsWith("update"))!;
    expect(update).toContain('"consumed_at" is null');
    expect(update).toContain('"revoked_at" is null');
    expect(update).toContain('"expires_at" >');
  });

  it("production without a database fails closed instead of using memory", async () => {
    const t = await load({ dbReady: false, nodeEnv: "production" });
    await expect(
      t.issueAuthToken({ purpose: "password_reset", userId: "u1", email: "a@x.test", ttlMs: 1000 }),
    ).rejects.toMatchObject({ code: "PERSISTENCE_UNAVAILABLE" });
    await expect(t.consumeAuthToken("password_reset", "x".repeat(64))).rejects.toMatchObject({
      code: "PERSISTENCE_UNAVAILABLE",
    });
  });

  it("a database error surfaces as a persistence error, never as an accepted token", async () => {
    const t = await load({ dbReady: true });
    const raw = await t.issueAuthToken({ purpose: "password_reset", userId: "u1", email: "a@x.test", ttlMs: 60_000 });
    // Same hash inserted twice makes the fake driver throw like a unique violation.
    const { createHash } = await import("node:crypto");
    expect(createHash("sha256").update(raw).digest("hex")).toBe(table[0].token_hash);
    const spy = vi.spyOn(table, "filter").mockImplementation(() => {
      throw new Error("connection terminated");
    });
    await expect(t.consumeAuthToken("password_reset", raw)).rejects.toMatchObject({ code: "PERSISTENCE_UNAVAILABLE" });
    spy.mockRestore();
  });

  it("routes use the durable token store, not process-local maps", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/new Map<string,\s*\{\s*email: string;\s*userId: string;\s*createdAt: number/);
    expect(src).not.toContain("emailVerificationTokens");
    expect(src).not.toContain("passwordResetTokens");
  });
});

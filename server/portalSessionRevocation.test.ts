import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

/**
 * #242: logout and password reset must revoke already-issued portal JWTs
 * server-side, durably, and fail closed. authMiddleware is exercised for real;
 * only the live-user lookup and the database are replaced.
 */

vi.mock("./portalAuthStore", async () => {
  const actual = await vi.importActual<typeof import("./portalAuthStore")>("./portalAuthStore");
  return { ...actual, getUser: vi.fn() };
});
vi.mock("./portalOrg", async () => {
  const actual = await vi.importActual<typeof import("./portalOrg")>("./portalOrg");
  return { ...actual, findUserById: vi.fn() };
});

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-session-revocation";

const dbRows: Array<{ tokenHash: string; expiresAt: Date }> = [];
let failWrites = false;
vi.mock("./db", () => {
  const db = {
    insert: () => ({
      values: (v: any) => ({
        onConflictDoNothing: async () => {
          if (failWrites) throw new Error("connection terminated");
          dbRows.push({ tokenHash: v.tokenHash, expiresAt: v.expiresAt });
        },
      }),
    }),
    select: () => ({ from: () => ({ where: async () => dbRows.map((r) => ({ ...r })) }) }),
    delete: () => ({ where: async () => undefined }),
  };
  return { db, dbReady: true, initPromise: Promise.resolve(true) };
});

const live = {
  id: "u1",
  email: "real@example.com",
  role: "user",
  storeRole: "managed",
  clientId: "c1",
  isActive: true,
  fullName: "Real",
  sessionsValidAfter: null as Date | null,
};

function sign(iatSec?: number) {
  const claims: Record<string, unknown> = { userId: "u1", email: live.email, role: "user" };
  if (iatSec !== undefined) claims.iat = iatSec;
  return jwt.sign(claims, process.env.JWT_SECRET as string, { expiresIn: "24h" });
}

async function call(token: string) {
  const { authMiddleware } = await import("./routes");
  const { getUser } = await import("./portalAuthStore");
  (getUser as any).mockReturnValue(live);
  const { findUserById } = await import("./portalOrg");
  (findUserById as any).mockReturnValue(undefined);
  let status: number | undefined;
  let body: any;
  const res: any = {
    status(c: number) {
      status = c;
      return res;
    },
    json(b: any) {
      body = b;
      return res;
    },
  };
  const next = vi.fn();
  authMiddleware({ headers: { authorization: `Bearer ${token}` }, cookies: {} } as any, res, next);
  return { status, body, next };
}

describe("portal session revocation (#242)", () => {
  beforeEach(async () => {
    dbRows.length = 0;
    failWrites = false;
    live.sessionsValidAfter = null;
    const rev = await import("./portalSessionRevocation");
    rev.resetRevocationsForTests();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("a valid token is accepted until it is revoked, then a copy of it fails", async () => {
    const token = sign();
    expect((await call(token)).next).toHaveBeenCalled();
    const { revokeToken } = await import("./portalSessionRevocation");
    await revokeToken(token, { userId: "u1", expiresAtSec: Math.floor(Date.now() / 1000) + 3600 });
    const after = await call(token);
    expect(after.status).toBe(401);
    expect(after.next).not.toHaveBeenCalled();
    // A different token for the same user (another device) is untouched.
    const other = jwt.sign({ userId: "u1", email: live.email, role: "user", n: 2 }, process.env.JWT_SECRET as string, { expiresIn: "24h" });
    expect((await call(other)).next).toHaveBeenCalled();
  });

  it("password reset cutoff kills every older token and spares a newer login", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const stolen = sign(nowSec - 600);
    expect((await call(stolen)).next).toHaveBeenCalled();
    const { cutoffNow } = await import("./portalSessionRevocation");
    live.sessionsValidAfter = cutoffNow(new Date(Date.now() - 1000));
    expect((await call(stolen)).status).toBe(401);
    const fresh = sign(nowSec + 5);
    expect((await call(fresh)).next).toHaveBeenCalled();
  });

  it("issuedBeforeCutoff is strict, and fails closed without an iat", async () => {
    const { issuedBeforeCutoff } = await import("./portalSessionRevocation");
    const cutoff = new Date("2026-10-03T12:00:00.400Z");
    const cutoffSec = Math.floor(cutoff.getTime() / 1000);
    expect(issuedBeforeCutoff(cutoffSec - 1, cutoff)).toBe(true);
    expect(issuedBeforeCutoff(cutoffSec, cutoff)).toBe(false);
    expect(issuedBeforeCutoff(undefined, cutoff)).toBe(true);
    expect(issuedBeforeCutoff(undefined, null)).toBe(false);
  });

  it("a revocation is durable: it is written, and reloaded after a restart", async () => {
    const token = sign();
    const rev = await import("./portalSessionRevocation");
    await rev.revokeToken(token, { userId: "u1", expiresAtSec: Math.floor(Date.now() / 1000) + 3600 });
    expect(dbRows).toHaveLength(1);
    expect(dbRows[0].tokenHash).toBe(rev.tokenFingerprint(token));
    expect(JSON.stringify(dbRows)).not.toContain(token);

    rev.resetRevocationsForTests(); // simulated restart: memory gone, database kept
    expect(rev.isTokenRevoked(token)).toBe(false);
    await rev.loadRevokedSessions();
    expect(rev.isTokenRevoked(token)).toBe(true);
  });

  it("a failed durable write still revokes in memory but is reported to the caller", async () => {
    const token = sign();
    const rev = await import("./portalSessionRevocation");
    failWrites = true;
    await expect(rev.revokeToken(token, { userId: "u1" })).rejects.toMatchObject({ code: "PERSISTENCE_UNAVAILABLE" });
    expect(rev.isTokenRevoked(token)).toBe(true);
  });

  it("revocations expire with the token", async () => {
    const token = sign();
    const rev = await import("./portalSessionRevocation");
    await rev.revokeToken(token, { userId: "u1", expiresAtSec: Math.floor(Date.now() / 1000) - 100 });
    expect(rev.isTokenRevoked(token, Date.now() + 5000)).toBe(false);
  });

  it("logout and password reset are wired to revocation", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    const logout = src.slice(src.indexOf('app.post("/api/portal/logout"'));
    expect(logout.slice(0, logout.indexOf("MFA SETUP"))).toContain("revokeToken(token");
    expect(src).toMatch(/sessionsValidAfter = cutoffNow\(\)/);
  });
});

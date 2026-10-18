import { readFileSync } from "node:fs";
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PASSKEY_CEREMONY_TTL,
  registerPortalPasskeyEnrollmentRoutes,
  type PasskeyEnrollmentUser,
} from "./portalPasskeyEnrollmentRoutes";
import { makeAuthenticator } from "./portalPasskeys.testkit";

/**
 * #153: route-level tests for passkey enrollment, over HTTP against the real
 * handlers and the real WebAuthn verifier. Only the session middleware (the
 * test names the signed-in user in a header) and the user store stand in.
 */

const ALICE_EMAIL = "alice@acme.test";
const BOB_EMAIL = "bob@globex.test";

let users: Map<string, PasskeyEnrollmentUser>;
const commit = vi.fn(async (_user: unknown) => undefined);
const securityEvents: string[] = [];

/** Stands in for authMiddleware: 401 without a session, else the named user. */
const auth: express.RequestHandler = (req, res, next) => {
  const email = req.header("x-test-user");
  if (!email) return res.status(401).json({ error: "Authentication required" });
  (req as any).user = { email };
  next();
};

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const app = express();
  // The RP ID comes from the request host; the test reaches 127.0.0.1 as the portal host.
  app.set("trust proxy", true);
  app.use(express.json());
  registerPortalPasskeyEnrollmentRoutes(app, {
    auth,
    validateInput: (_req, _res, next) => next(),
    users: { get: (email) => users.get(email), commit },
    generateBackupCodes: (n) => Array.from({ length: n }, (_, i) => `code-${i}`),
    logSecurityEvent: (event) => securityEvents.push(event),
    sendPersistenceFailure: () => false,
    logger: { error: () => undefined },
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  users = new Map([
    [ALICE_EMAIL, { id: "user-alice", email: ALICE_EMAIL, fullName: "Alice", mfaEnabled: false, mfaPasskeys: [] }],
    [BOB_EMAIL, { id: "user-bob", email: BOB_EMAIL, fullName: "Bob", mfaEnabled: false, mfaPasskeys: [] }],
  ]);
  commit.mockClear();
  securityEvents.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

function post(path: string, email: string | null, body: object) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Forwarded-Host": "portal.digeratiexperts.com",
  };
  if (email) headers["x-test-user"] = email;
  return fetch(`${baseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

async function startEnrollment(email: string) {
  const res = await post("/api/portal/mfa/passkey/register/options", email, { provider: "apple", nickname: "Laptop" });
  expect(res.status).toBe(200);
  const body = await res.json();
  return { setupToken: body.setupToken as string, challenge: body.options.challenge as string, options: body.options };
}

function verify(email: string | null, setupToken: string, credential: unknown) {
  return post("/api/portal/mfa/passkey/register/verify", email, { setupToken, credential });
}

describe("passkey enrollment requires an authenticated session", () => {
  it("refuses options and verify without a session and issues no challenge", async () => {
    const options = await post("/api/portal/mfa/passkey/register/options", null, { provider: "apple" });
    expect(options.status).toBe(401);
    expect(await options.json()).not.toHaveProperty("setupToken");

    const authenticator = makeAuthenticator();
    const res = await verify(null, "any-token", authenticator.register("any-challenge"));
    expect(res.status).toBe(401);
    expect(commit).not.toHaveBeenCalled();
  });

  it("routes.ts wires enrollment to the real session middleware", () => {
    const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    expect(src).toMatch(/registerPortalPasskeyEnrollmentRoutes\(app,\s*\{\s*auth:\s*authMiddleware,/);
    // The enrollment paths are no longer registered inline anywhere else.
    expect(src).not.toContain('"/api/portal/mfa/passkey/register/options"');
    expect(src).not.toContain('"/api/portal/mfa/passkey/register/verify"');
  });

  it("enrolls a passkey for the signed-in user and turns MFA on", async () => {
    const { setupToken, challenge, options } = await startEnrollment(ALICE_EMAIL);
    expect(options.rp.id).toBe("digeratiexperts.com");
    const authenticator = makeAuthenticator();
    const res = await verify(ALICE_EMAIL, setupToken, authenticator.register(challenge));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.backupCodes).toHaveLength(8);
    const alice = users.get(ALICE_EMAIL)!;
    expect(alice.mfaPasskeys?.map((p) => p.id)).toEqual([authenticator.id]);
    expect(alice.mfaEnabled).toBe(true);
    expect(alice.mfaMethod).toBe("passkey");
    expect(commit).toHaveBeenCalledTimes(1);
    expect(securityEvents).toEqual(["PASSKEY_REGISTERED", "MFA_ENABLED"]);
  });
});

describe("passkey enrollment challenge expires after 10 minutes", () => {
  it("accepts a response just inside the window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
    const { setupToken, challenge } = await startEnrollment(ALICE_EMAIL);
    vi.setSystemTime(new Date(Date.now() + PASSKEY_CEREMONY_TTL - 1000));
    const res = await verify(ALICE_EMAIL, setupToken, makeAuthenticator().register(challenge));
    expect(res.status).toBe(200);
  });

  it("rejects a response after 10 minutes and saves nothing", async () => {
    expect(PASSKEY_CEREMONY_TTL).toBe(10 * 60 * 1000);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
    const { setupToken, challenge } = await startEnrollment(ALICE_EMAIL);
    vi.setSystemTime(new Date(Date.now() + PASSKEY_CEREMONY_TTL + 1000));
    const res = await verify(ALICE_EMAIL, setupToken, makeAuthenticator().register(challenge));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/expired/i);
    expect(users.get(ALICE_EMAIL)!.mfaPasskeys).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
  });
});

describe("passkey enrollment challenge is single use", () => {
  it("a replay of a successful ceremony is refused", async () => {
    const { setupToken, challenge } = await startEnrollment(ALICE_EMAIL);
    const credential = makeAuthenticator().register(challenge);
    expect((await verify(ALICE_EMAIL, setupToken, credential)).status).toBe(200);
    const replay = await verify(ALICE_EMAIL, setupToken, credential);
    expect(replay.status).toBe(400);
    expect((await replay.json()).message).toMatch(/expired/i);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("a failed verification consumes the challenge too", async () => {
    const { setupToken, challenge } = await startEnrollment(ALICE_EMAIL);
    const authenticator = makeAuthenticator();
    const wrong = await verify(ALICE_EMAIL, setupToken, authenticator.register(challenge, { origin: "https://evil.example" }));
    expect(wrong.status).toBe(400);
    expect(securityEvents).toContain("PASSKEY_REGISTRATION_REJECTED");
    const retry = await verify(ALICE_EMAIL, setupToken, authenticator.register(challenge));
    expect(retry.status).toBe(400);
    expect((await retry.json()).message).toMatch(/expired/i);
    expect(users.get(ALICE_EMAIL)!.mfaPasskeys).toEqual([]);
  });

  it("a credential signed over a different challenge is refused", async () => {
    const { setupToken } = await startEnrollment(ALICE_EMAIL);
    const other = await startEnrollment(ALICE_EMAIL);
    const res = await verify(ALICE_EMAIL, setupToken, makeAuthenticator().register(other.challenge));
    expect(res.status).toBe(400);
    expect(users.get(ALICE_EMAIL)!.mfaPasskeys).toEqual([]);
  });
});

describe("passkey enrollment challenge is bound to the user who requested it", () => {
  it("another signed-in user cannot complete it", async () => {
    const { setupToken, challenge } = await startEnrollment(ALICE_EMAIL);
    const res = await verify(BOB_EMAIL, setupToken, makeAuthenticator().register(challenge));
    expect(res.status).toBe(403);
    expect(users.get(ALICE_EMAIL)!.mfaPasskeys).toEqual([]);
    expect(users.get(BOB_EMAIL)!.mfaPasskeys).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
    // Observed behaviour: the attempt also burns the token, so the owner must start again.
    const owner = await verify(ALICE_EMAIL, setupToken, makeAuthenticator().register(challenge));
    expect(owner.status).toBe(400);
  });

  it("an unknown token is refused", async () => {
    const res = await verify(ALICE_EMAIL, "not-issued", makeAuthenticator().register("x"));
    expect(res.status).toBe(400);
  });
});

describe("passkey enrollment limits", () => {
  it("refuses a credential already registered to the account", async () => {
    const authenticator = makeAuthenticator();
    const first = await startEnrollment(ALICE_EMAIL);
    expect((await verify(ALICE_EMAIL, first.setupToken, authenticator.register(first.challenge))).status).toBe(200);
    const second = await startEnrollment(ALICE_EMAIL);
    expect(second.options.excludeCredentials.map((c: any) => c.id)).toEqual([authenticator.id]);
    const dup = await verify(ALICE_EMAIL, second.setupToken, authenticator.register(second.challenge));
    expect(dup.status).toBe(409);
    expect(users.get(ALICE_EMAIL)!.mfaPasskeys).toHaveLength(1);
  });

  it("caps an account at 10 passkeys", async () => {
    const alice = users.get(ALICE_EMAIL)!;
    alice.mfaPasskeys = Array.from({ length: 10 }, (_, i) => ({ id: `pk-${i}` }) as any);
    const res = await post("/api/portal/mfa/passkey/register/options", ALICE_EMAIL, { provider: "apple" });
    expect(res.status).toBe(400);
    expect(await res.json()).not.toHaveProperty("setupToken");
  });
});

import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerPortalPasskeyLoginRoutes, type PasskeyLoginUser, type PortalMfaChallenge } from "./portalPasskeyLoginRoutes";
import { verifyRegistration } from "./portalPasskeys";
import { makeAuthenticator, RP_ID, USER_ID } from "./portalPasskeys.testkit";

// Real HTTP handlers and cryptographic WebAuthn assertions. The password step
// seeds the same challenge shape; only durable storage/session issuance stand in.
const EMAIL = "alice@acme.test";
const TOKEN = "password-proven-token";
const challenges = new Map<string, PortalMfaChallenge>();
let users: Map<string, PasskeyLoginUser>;
let authenticator: ReturnType<typeof makeAuthenticator>;
const commit = vi.fn<(user: PasskeyLoginUser) => Promise<void>>();
const completeLogin = vi.fn((_user, _req, res) => res.cookie("sessionId", "test-session").json({ success: true }));
const events: string[] = [];
let server: Server;
let baseUrl: string;
let middlewareCalls: string[];
const WRITE_FAILED = new Error("unconfirmed durable write");

beforeAll(async () => {
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  registerPortalPasskeyLoginRoutes(app, {
    rateLimit: (_req, _res, next) => { middlewareCalls.push("rate-limit"); next(); },
    validateInput: (_req, _res, next) => { middlewareCalls.push("validation"); next(); },
    challenges,
    maxAttempts: 5,
    users: { get: (email) => users.get(email), commit },
    completeLogin,
    logSecurityEvent: (event) => events.push(event),
    sendPersistenceFailure: (res, error) => {
      if (error !== WRITE_FAILED) return false;
      res.status(503).json({ message: "Storage unavailable" });
      return true;
    },
    logger: { error: () => undefined },
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
afterEach(() => vi.useRealTimers());
beforeEach(() => {
  authenticator = makeAuthenticator();
  const passkey = verifyRegistration({ credential: authenticator.register("enroll"), expectedChallenge: "enroll", rpId: RP_ID, provider: "apple", nickname: "Test" });
  users = new Map([[EMAIL, { id: USER_ID, email: EMAIL, isActive: true, mfaPasskeys: [passkey] }]]);
  challenges.clear();
  challenges.set(TOKEN, { userId: USER_ID, email: EMAIL, method: "passkey", createdAt: Date.now(), expiresAt: Date.now() + 300_000, attempts: 0 });
  commit.mockReset().mockImplementation(async (user) => { users.set(user.email, user); });
  completeLogin.mockClear();
  events.length = 0;
  middlewareCalls = [];
});

function post(step: "options" | "verify", body: object, host = "portal.digeratiexperts.com") {
  return fetch(`${baseUrl}/api/portal/mfa/passkey/login/${step}`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Host": host }, body: JSON.stringify(body),
  });
}
async function options(token = TOKEN) {
  const response = await post("options", { mfaToken: token });
  expect(response.status).toBe(200);
  return (await response.json()).options;
}
function verify(credential: unknown, token = TOKEN) { return post("verify", { mfaToken: token, credential }); }
function expectNoSession(response: Response) {
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(completeLogin).not.toHaveBeenCalled();
}

describe("password-first passkey sign-in HTTP boundary", () => {
  it("uses the existing challenge map, login limiter and session issuer in production", () => {
    const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    expect(source).toMatch(/registerPortalPasskeyLoginRoutes\(app,\s*\{\s*rateLimit: loginRateLimiter,[\s\S]*?challenges: mfaChallenges,[\s\S]*?users: portalUsers,[\s\S]*?completeLogin,/);
    expect(source).not.toContain('"/api/portal/mfa/passkey/login/options"');
    expect(source).not.toContain('"/api/portal/mfa/passkey/login/verify"');
  });
  it("rejects absent, non-string and unknown password-step tokens", async () => {
    for (const mfaToken of [undefined, 3, "unknown"]) {
      for (const step of ["options", "verify"] as const) {
        const response = await post(step, { mfaToken });
        expect(response.status).toBe(400);
        expectNoSession(response);
      }
    }
    expect(commit).not.toHaveBeenCalled();
    expect(middlewareCalls).toEqual(Array.from({ length: 6 }, () => ["rate-limit", "validation"]).flat());
  });
  it("issues only this account's RP credentials and commits before issuing a session", async () => {
    const foreign = { ...users.get(EMAIL)!.mfaPasskeys![0], id: "other-host", rpId: "other.test" };
    users.get(EMAIL)!.mfaPasskeys!.push(foreign);
    const issued = await options();
    expect(issued.rpId).toBe(RP_ID);
    expect(issued.allowCredentials.map((c: any) => c.id)).toEqual([authenticator.id]);
    authenticator.setCounter(1);
    const response = await verify(authenticator.assert(issued.challenge));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("sessionId=test-session");
    expect(commit).toHaveBeenCalledTimes(1);
    expect(completeLogin).toHaveBeenCalledTimes(1);
    expect(commit.mock.invocationCallOrder[0]).toBeLessThan(completeLogin.mock.invocationCallOrder[0]);
    expect(challenges.has(TOKEN)).toBe(false);
    expect(events).toContain("MFA_VERIFICATION_SUCCESS");
  });
  it("expires the password-step session for options and verify", async () => {
    const issued = await options();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(challenges.get(TOKEN)!.expiresAt + 1);
    const response = await verify(authenticator.assert(issued.challenge));
    expect(response.status).toBe(400);
    expect((await post("options", { mfaToken: TOKEN })).status).toBe(400);
    expect(challenges.has(TOKEN)).toBe(false);
    expectNoSession(response);
  });
  it("rejects an assertion before options and consumes successful assertions exactly once", async () => {
    expect((await verify(authenticator.assert("not-issued"))).status).toBe(400);
    const issued = await options();
    const credential = authenticator.assert(issued.challenge);
    expect((await verify(credential)).status).toBe(200);
    const replay = await verify(credential);
    expect(replay.status).toBe(400);
    expect(replay.headers.get("set-cookie")).toBeNull();
    expect(completeLogin).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(1);
  });
  it("burns a failed assertion challenge and requires fresh options", async () => {
    const issued = await options();
    const rejected = await verify(authenticator.assert(issued.challenge, { tamper: true }));
    expect(rejected.status).toBe(401);
    expectNoSession(rejected);
    expect((await verify(authenticator.assert(issued.challenge))).status).toBe(400);
    const fresh = await options();
    expect(fresh.challenge).not.toBe(issued.challenge);
    expect((await verify(authenticator.assert(fresh.challenge))).status).toBe(200);
  });
  it.each(["origin", "signature", "userHandle", "credential", "challenge", "rp"])("rejects a mismatched %s at the HTTP boundary", async (kind) => {
    const issued = await options();
    if (kind === "rp") challenges.get(TOKEN)!.passkeyRpId = "other.test";
    const signer = kind === "credential" ? makeAuthenticator() : authenticator;
    const credential = signer.assert(kind === "challenge" ? "wrong-challenge" : issued.challenge, {
      ...(kind === "origin" ? { origin: "https://evil.example" } : {}),
      ...(kind === "signature" ? { tamper: true } : {}),
      ...(kind === "userHandle" ? { userHandle: Buffer.from("other-user").toString("base64url") } : {}),
    });
    const response = await verify(credential);
    expect(response.status).toBe(401);
    expectNoSession(response);
    expect(commit).not.toHaveBeenCalled();
    expect(events).toContain("MFA_VERIFICATION_FAILED");
  });
  it.each(["disabled", "replaced", "deleted"])("rejects a %s account after the password step", async (kind) => {
    for (const stage of ["options", "verify"] as const) {
      const original = users.get(EMAIL)!;
      const challenge = { userId: USER_ID, email: EMAIL, method: "passkey" as const, createdAt: Date.now(), expiresAt: Date.now() + 300_000, attempts: 0 };
      challenges.set(TOKEN, challenge);
      const issued = stage === "verify" ? await options() : null;
      if (kind === "deleted") users.delete(EMAIL);
      else users.set(EMAIL, { ...original, ...(kind === "disabled" ? { isActive: false } : { id: "replacement-user" }) });
      const response = stage === "options" ? await post("options", { mfaToken: TOKEN }) : await verify(authenticator.assert(issued.challenge));
      expect(response.status).toBe(400);
      expectNoSession(response);
      expect(challenges.has(TOKEN)).toBe(false);
      users.set(EMAIL, original);
    }
    expect(commit).not.toHaveBeenCalled();
  });
  it("counts failures across fresh options and locks out after five attempts", async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const issued = await options();
      expect((await verify(authenticator.assert(issued.challenge, { tamper: true }))).status).toBe(401);
      expect(challenges.get(TOKEN)!.attempts).toBe(attempt);
    }
    const response = await post("options", { mfaToken: TOKEN });
    expect(response.status).toBe(429);
    expectNoSession(response);
    expect(challenges.has(TOKEN)).toBe(false);
    expect(events).toContain("MFA_LOCKED_OUT");
  });
  it("enforces lockout even when options were issued before the fifth failure", async () => {
    const issued = await options();
    challenges.get(TOKEN)!.attempts = 5;
    const response = await verify(authenticator.assert(issued.challenge));
    expect(response.status).toBe(429);
    expectNoSession(response);
    expect(challenges.has(TOKEN)).toBe(false);
  });
  it("rejects accounts with no credential registered for this RP", async () => {
    const response = await post("options", { mfaToken: TOKEN }, "unrelated.example");
    expect(response.status).toBe(400);
    expectNoSession(response);
    expect(commit).not.toHaveBeenCalled();
  });
  it("does not publish credential changes or issue a session when persistence fails", async () => {
    const original = structuredClone(users.get(EMAIL));
    const issued = await options();
    authenticator.setCounter(7);
    commit.mockRejectedValueOnce(WRITE_FAILED);
    const response = await verify(authenticator.assert(issued.challenge));
    expect(response.status).toBe(503);
    expectNoSession(response);
    expect(users.get(EMAIL)).toEqual(original);
    expect(challenges.has(TOKEN)).toBe(false);
    expect(events).not.toContain("MFA_VERIFICATION_SUCCESS");
  });
  it("blocks a parallel ceremony and leaves the cache unchanged while a write is pending", async () => {
    const original = structuredClone(users.get(EMAIL));
    let release!: () => void;
    let started!: () => void;
    const writing = new Promise<void>((resolve) => { started = resolve; });
    commit.mockImplementationOnce(async (user) => {
      started();
      await new Promise<void>((resolve) => { release = resolve; });
      users.set(user.email, user);
    });
    const issued = await options();
    authenticator.setCounter(8);
    const credential = authenticator.assert(issued.challenge);
    const pending = verify(credential);
    await writing;
    try {
      expect(users.get(EMAIL)).toEqual(original);
      expect(completeLogin).not.toHaveBeenCalled();
      expect((await post("options", { mfaToken: TOKEN })).status).toBe(400);
      expect((await verify(credential)).status).toBe(400);
    } finally { release(); }
    expect((await pending).status).toBe(200);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(completeLogin).toHaveBeenCalledTimes(1);
  });
});

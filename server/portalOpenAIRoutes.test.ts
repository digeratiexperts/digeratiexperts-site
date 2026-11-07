import express from "express";
import cookieParser from "cookie-parser";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openAIControlResponseSchema } from "@shared/openaiControl";
import { registerPortalOpenAIRoutes } from "./portalOpenAIRoutes";
import { openaiConfig } from "./services/openai-config";

vi.mock("./db", () => ({ db: null, dbReady: false, getDatabaseStatus: () => ({ connected: false, type: "memory" }), initPromise: Promise.resolve(false) }));
vi.mock("./portalAuthStore", async () => ({ ...await vi.importActual<any>("./portalAuthStore"), getUser: vi.fn() }));
vi.mock("./portalOrg", async () => ({ ...await vi.importActual<any>("./portalOrg"), findUserById: vi.fn() }));
const secret = "synthetic-jwt-secret-for-openai-route-tests-only";
const identity = { id: "fixture-admin", email: "admin@example.invalid", role: "admin", isActive: true, fullName: "Synthetic Admin" };
let live: any = identity;
let server: Server, base: string;
const audit = vi.fn();
let transport: ReturnType<typeof vi.fn>;
const token = (claims: object = {}) => jwt.sign({ userId: identity.id, email: identity.email, role: "admin", ...claims }, secret, { expiresIn: "1h" });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", secret);
  vi.stubEnv("DATABASE_URL", "");
  const authStore = await import("./portalAuthStore");
  const org = await import("./portalOrg");
  vi.mocked(authStore.getUser).mockImplementation(() => live);
  vi.mocked(org.findUserById).mockImplementation(() => live);
  const rev = await import("./portalSessionRevocation");
  rev.resetRevocationsForTests({ loadState: "ready" });
  const { authMiddleware, requireAdmin } = await import("./routes");
  const app = express(); app.use(express.json()); app.use(cookieParser());
  registerPortalOpenAIRoutes(app, { guards: [authMiddleware as any, requireAdmin as any], audit });
  server = createServer(app); await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
}, 60_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server?.close(() => r())); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => {
  live = { ...identity }; audit.mockReset(); openaiConfig.enable();
  transport = vi.fn(async () => { throw new Error("No provider traffic permitted in route tests"); });
  // Keep loopback fetch available, reject any non-loopback request.
  const realFetch = globalThis.fetch;
  if (!(realFetch as any).__openaiRouteWrapper) {
    const wrapped: typeof fetch = (input, init) => String(input).startsWith(base) ? realFetch(input, init) : transport(input, init);
    (wrapped as any).__openaiRouteWrapper = true; vi.stubGlobal("fetch", wrapped);
  }
});
async function call(path: string, method = "GET", headers: Record<string, string> = {}, body?: string) {
  const r = await fetch(`${base}/api/portal/admin/openai/${path}`, { method, headers: { authorization: `Bearer ${token()}`, ...(method === "POST" ? { "Content-Type":"application/json", "X-DE-OpenAI-Control":"1", origin:base } : {}), ...headers }, ...(method === "POST" ? { body: body ?? "{}" } : {}) });
  return { code:r.status, headers:r.headers, body:await r.json() };
}
describe("OpenAI control HTTP with actual auth/admin guards", () => {
  it("returns one safe nested state shape and disables caching", async () => {
    const r=await call("status"); expect(r.code).toBe(200); expect(openAIControlResponseSchema.safeParse(r.body).success).toBe(true);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(r.body)).not.toMatch(/apiKey|baseUrl|Bearer|synthetic-jwt/);
  });
  it("explicit disable/enable operations persist runtime state and are idempotent", async () => {
    for(const enabled of [false,false,true,true]) {
      const r=await call(enabled?"enable":"disable","POST"); expect(r.code).toBe(200); expect(r.body.status.enabled).toBe(enabled);
      expect((await call("status")).body.status.enabled).toBe(enabled);
    }
    expect(audit).toHaveBeenCalledTimes(4); expect(transport).not.toHaveBeenCalled();
  });
  it("a lost audit does not reverse a successful disable", async () => {
    audit.mockImplementation(()=>{throw new Error("Synthetic audit failure");});
    const r=await call("disable","POST"); expect(r.code).toBe(200); expect(openaiConfig.isEnabled()).toBe(false);
  });
  it("rejects unauthenticated, expired, disabled and non-admin identities", async () => {
    expect((await call("disable","POST",{authorization:""})).code).toBe(401);
    expect((await call("disable","POST",{authorization:`Bearer ${jwt.sign({userId:identity.id,email:identity.email},secret,{expiresIn:-1})}`})).code).toBe(401);
    live={...identity,isActive:false}; expect((await call("disable","POST")).code).toBe(401);
    live={...identity,role:"user"}; expect((await call("disable","POST")).code).toBe(403);
    // A claimed admin role in a valid token cannot elevate a live staff user.
    live={...identity,role:"staff"}; expect((await call("enable","POST")).code).toBe(403);
    expect(openaiConfig.isEnabled()).toBe(true); expect(audit).not.toHaveBeenCalled();
  });
  it("cookie sessions use the same auth and CSRF requirements", async () => {
    expect((await call("disable","POST",{authorization:"",cookie:`portalAuth=${token()}`})).code).toBe(200);
    openaiConfig.enable();
    expect((await call("disable","POST",{authorization:"",cookie:`portalAuth=${token()}`,origin:"https://attacker.invalid"})).code).toBe(403);
    expect(openaiConfig.isEnabled()).toBe(true);
  });
  it.each([
    {"X-DE-OpenAI-Control":""},
    {origin:"null"},
    {origin:"https://sibling.example.invalid"},
    {"sec-fetch-site":"cross-site"},
    {"Content-Type":"text/plain"},
  ])("rejects cross-origin/simple browser mutation %j", async headers => {
    expect((await call("disable","POST",headers)).code).toBe(403); expect(openaiConfig.isEnabled()).toBe(true); expect(audit).not.toHaveBeenCalled();
  });
  it("retires blind toggle without changing state", async () => {
    expect((await call("toggle","POST")).code).toBe(410); expect(openaiConfig.isEnabled()).toBe(true); expect(audit).not.toHaveBeenCalled();
  });
  it("main registration uses the real auth/admin pair and has no legacy parallel handlers", () => {
    const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
    expect(source).toMatch(/registerPortalOpenAIRoutes\(app,\s*\{\s*guards: \[authMiddleware, requireAdmin\]/);
    expect(source).not.toContain('app.post("/api/portal/admin/openai/toggle"');
  });
});

import express from "express";
import { createServer, type Server } from "http";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { registerPortalPhoneRoutes, PHONE_PATH, PHONE_UNAVAILABLE_MESSAGE } from "./routes";
import { CYTRACOM_DATA_USERS_EXAMPLE } from "./cytracom.fixtures";

/**
 * GET /api/portal/phone over HTTP. The caller is set per request from the
 * x-test-user header; the environment and the vendor fetch are injected so
 * each test chooses the mode and the vendor's answer.
 */

const env: Record<string, string | undefined> = {};
const vendorFetch = vi.fn();

const users = {
  acme: { id: "u1", role: "user", clientId: "acme", email: "kerip@customeraccount.com" },
  globex: { id: "u2", role: "user", clientId: "globex", email: "g@globex.test" },
  admin: { id: "a1", role: "admin", clientId: null, email: "admin@de.test" },
  adminAsAcme: { id: "a1", role: "admin", clientId: null, email: "admin@de.test", impersonatingCompanyId: "acme" },
} as Record<string, unknown>;

let server: Server;
let base = "";

beforeAll(async () => {
  const app = express();
  const asUser: express.RequestHandler = (req, _res, next) => {
    (req as any).user = users[String(req.headers["x-test-user"] || "")];
    next();
  };
  registerPortalPhoneRoutes(app, { guards: [asUser], env, fetchImpl: vendorFetch as any });
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

afterEach(() => {
  for (const k of Object.keys(env)) delete env[k];
  vendorFetch.mockReset();
  vi.restoreAllMocks();
});

const get = async (who: string) => {
  const res = await fetch(`${base}${PHONE_PATH}`, { headers: { "x-test-user": who } });
  return { status: res.status, body: (await res.json()) as any };
};

const live = (extra: Record<string, string> = {}) =>
  Object.assign(env, {
    PORTAL_PHONE_PROVIDER: "cytracom",
    PORTAL_PHONE_CLIENT_MAP: JSON.stringify({ acme: "ACME", globex: "GLOBEX" }),
    PORTAL_PHONE_CYTRACOM_TOKEN_ACME: "tok-acme",
    PORTAL_PHONE_CYTRACOM_TOKEN_GLOBEX: "tok-globex",
    ...extra,
  });

const vendorOk = () =>
  vendorFetch.mockImplementation(async () =>
    new Response(JSON.stringify(CYTRACOM_DATA_USERS_EXAMPLE), { status: 200, headers: { "content-type": "application/json" } }),
  );

const tokenUsed = (call: number) => {
  const auth = (vendorFetch.mock.calls[call][1] as RequestInit).headers as Record<string, string>;
  return Buffer.from(auth.authorization.replace(/^Basic /, ""), "base64").toString("utf8");
};

describe("GET /api/portal/phone", () => {
  it("sample by default, with no data and no vendor call", async () => {
    const { status, body } = await get("acme");
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, status: { mode: "sample", provider: null } });
    expect(vendorFetch).not.toHaveBeenCalled();
  });

  it("hidden", async () => {
    env.PORTAL_PHONE_PROVIDER = "hidden";
    const { body } = await get("acme");
    expect(body).toEqual({ success: true, status: { mode: "hidden", provider: null } });
  });

  it("needsCompany for a DE admin in admin view", async () => {
    live();
    const { body } = await get("admin");
    expect(body).toMatchObject({ success: true, needsCompany: true, status: { mode: "live", provider: "cytracom" } });
    expect(vendorFetch).not.toHaveBeenCalled();
  });

  it("notMapped for a company missing from the client map, without calling the vendor", async () => {
    live({ PORTAL_PHONE_CLIENT_MAP: JSON.stringify({ acme: "ACME" }) });
    const { body } = await get("globex");
    expect(body).toEqual({ success: true, status: { mode: "live", provider: "cytracom" }, notMapped: true });
    expect(vendorFetch).not.toHaveBeenCalled();
  });

  it("live data for a mapped company, read with that company's token", async () => {
    live();
    vendorOk();
    const { status, body } = await get("acme");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.provider).toBe("cytracom");
    expect(body.data.extensions).toHaveLength(4);
    expect(body.data.myExtension).toEqual({ name: "Keri Parker", extension: "201", assigned: true });
    expect(tokenUsed(0)).toBe("token:tok-acme");
  });

  it("each company only ever reaches its own token", async () => {
    live();
    vendorOk();
    await get("globex");
    await get("adminAsAcme");
    expect(tokenUsed(0)).toBe("token:tok-globex");
    expect(tokenUsed(1)).toBe("token:tok-acme");
  });

  it("502 with a generic message when the vendor fails, detail only in the log", async () => {
    live();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vendorFetch.mockImplementation(async () => new Response("bad token tok-acme", { status: 401 }));
    const { status, body } = await get("acme");
    expect(status).toBe(502);
    expect(body).toEqual({ success: false, status: { mode: "live", provider: "cytracom" }, error: PHONE_UNAVAILABLE_MESSAGE });
    expect(JSON.stringify(body)).not.toContain("tok-acme");
    expect(warn.mock.calls[0][0]).toMatch(/\[portal-phone\] cytracom failed for client acme: CytracomError: GET \/data\/users answered HTTP 401/);
    expect(warn.mock.calls[0][0]).not.toContain("tok-acme");
  });

  it("502 when a mapped company's token is not set", async () => {
    live({ PORTAL_PHONE_CYTRACOM_TOKEN_ACME: "" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { status, body } = await get("acme");
    expect(status).toBe(502);
    expect(body.error).toBe(PHONE_UNAVAILABLE_MESSAGE);
    expect(vendorFetch).not.toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toMatch(/PORTAL_PHONE_CYTRACOM_TOKEN_ACME is not set/);
  });

  it("502 when the client map is malformed (fails closed, not unfiltered)", async () => {
    live({ PORTAL_PHONE_CLIENT_MAP: "{not json" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { status } = await get("acme");
    expect(status).toBe(502);
    expect(vendorFetch).not.toHaveBeenCalled();
  });
});

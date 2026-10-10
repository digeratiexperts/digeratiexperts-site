/**
 * Mirrors Intelligence Hub routes/__tests__/zoho-connect.test.ts over real
 * HTTP: the feature flag, owner-only access, the state cookie bound to the
 * signed-in user, consent denial, and disconnect.
 */
import express from "express";
import cookieParser from "cookie-parser";
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createZohoConnectHandlers, requireZohoConnectEnabled } from "./zohoConnectRoutes";
import { resetZohoOAuthForTests } from "./zoho/oauth";

const complete = vi.fn();
const disconnect = vi.fn(async () => true);
const health = { configured: true, state: "connected" as const, source: "env" as const };

const OWNER = { id: "owner-1", email: "admin@digeratiexperts.com", role: "admin" };
let currentUser: Record<string, unknown> | null = OWNER;

function app() {
  const a = express();
  a.use(cookieParser());
  const fakeAuth = (req: any, res: any, next: any) => {
    if (!currentUser) return res.status(401).json({ error: "Authentication required" });
    req.user = currentUser;
    next();
  };
  const h = createZohoConnectHandlers({
    productHealth: async () => ({ crm: health, desk: health, books: health, payments: health }),
    complete: complete as any,
    disconnect: disconnect as any,
  });
  // Same guard order as server/routes.ts.
  a.get("/api/zoho/connect", [requireZohoConnectEnabled, fakeAuth], h.start);
  a.get("/api/zoho/connect/callback", [requireZohoConnectEnabled, fakeAuth], h.callback);
  a.get("/api/zoho/connection", [fakeAuth], h.connection);
  a.post("/api/zoho/disconnect", [requireZohoConnectEnabled, fakeAuth], h.disconnect);
  return a;
}

let server: Server;
let base = "";

beforeAll(async () => {
  server = createServer(app());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  vi.stubEnv("ZOHO_CONNECT_ENABLED", "true");
  vi.stubEnv("ZOHO_CONNECT_CLIENT_ID", "connect-client");
  vi.stubEnv("ZOHO_CONNECT_CLIENT_SECRET", "connect-secret");
  vi.stubEnv("ZOHO_CONNECT_REDIRECT_URI", "");
  vi.stubEnv("PUBLIC_SITE_URL", "");
  vi.stubEnv("MAIN_DOMAIN", "");
  vi.stubEnv("ZOHO_ACCOUNTS_SERVER", "");
  currentUser = OWNER;
  complete.mockReset();
  disconnect.mockClear();
  resetZohoOAuthForTests();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const get = (path: string, cookie?: string) =>
  fetch(`${base}${path}`, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });

const zohoError = (res: Response) =>
  new URL(res.headers.get("location") ?? "", "http://site.local").searchParams.get("zoho_error") ?? "";

function stateCookie(res: Response): { header: string; cookie: string } {
  const header = res.headers.getSetCookie().find((c) => c.startsWith("zoho_connect=")) ?? "";
  if (!header) throw new Error("no zoho_connect cookie");
  return { header, cookie: header.split(";")[0] };
}

async function startAsOwner(returnTo = "/portal/admin/integrations") {
  const res = await get(`/api/zoho/connect?returnTo=${encodeURIComponent(returnTo)}`);
  const state = new URL(res.headers.get("location")!).searchParams.get("state")!;
  return { res, state, ...stateCookie(res) };
}

describe("Zoho Connect routes", () => {
  it("are 404 while ZOHO_CONNECT_ENABLED is off", async () => {
    vi.stubEnv("ZOHO_CONNECT_ENABLED", "");
    expect((await get("/api/zoho/connect")).status).toBe(404);
    expect((await get("/api/zoho/connect/callback?code=c&state=s")).status).toBe(404);
    expect((await fetch(`${base}/api/zoho/disconnect`, { method: "POST" })).status).toBe(404);
    expect(complete).not.toHaveBeenCalled();
  });

  it("redirects the owner to Zoho consent with offline access and every product's scopes", async () => {
    const { res, header } = await startAsOwner();
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("location")!);
    expect(url.origin + url.pathname).toBe("https://accounts.zoho.com/oauth/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("connect-client");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("redirect_uri")).toBe(`${base}/api/zoho/connect/callback`);
    const scope = url.searchParams.get("scope") ?? "";
    for (const s of ["ZohoCRM.modules.READ", "Desk.tickets.CREATE", "ZohoBooks.estimates.CREATE", "ZohoPay.payments.CREATE"]) {
      expect(scope).toContain(s);
    }
    // The state cookie: httpOnly, SameSite=Lax, scoped to the connect paths.
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Path=\/api\/zoho\/connect/);
    // The secret never leaves the server.
    expect(res.headers.get("location")).not.toContain("connect-secret");
  });

  it("uses the registered redirect URI when ZOHO_CONNECT_REDIRECT_URI is set", async () => {
    vi.stubEnv("ZOHO_CONNECT_REDIRECT_URI", `${base}/api/zoho/connect/callback`);
    const { res } = await startAsOwner();
    expect(new URL(res.headers.get("location")!).searchParams.get("redirect_uri")).toBe(`${base}/api/zoho/connect/callback`);
  });

  it("refuses an admin who is not the owner, and an owner impersonating a company", async () => {
    for (const user of [
      { id: "admin-2", email: "someone@digeratiexperts.com", role: "admin" },
      { ...OWNER, impersonatingCompanyId: "client-9" },
      { id: "u-3", email: "admin@digeratiexperts.com", role: "user" },
    ]) {
      currentUser = user;
      const res = await get("/api/zoho/connect?returnTo=/portal/admin");
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toMatch(/^\/portal\/admin\?zoho_connect=error/);
      expect(res.headers.getSetCookie().some((c) => c.startsWith("zoho_connect="))).toBe(false);
    }
  });

  it("never redirects back off-site", async () => {
    currentUser = { id: "admin-2", email: "someone@digeratiexperts.com", role: "admin" };
    for (const returnTo of ["//evil.example", "/\\evil.example", "https://evil.example"]) {
      const res = await get(`/api/zoho/connect?returnTo=${encodeURIComponent(returnTo)}`);
      expect(res.headers.get("location")).toMatch(/^\/portal\/admin\?/);
    }
  });

  it("completes the callback only with the matching state for the same user", async () => {
    const { state, cookie } = await startAsOwner();

    const bad = await get("/api/zoho/connect/callback?code=c1&state=wrong", cookie);
    expect(bad.headers.get("location")).toContain("zoho_connect=error");

    const noCookie = await get(`/api/zoho/connect/callback?code=c1&state=${state}`);
    expect(noCookie.headers.get("location")).toContain("zoho_connect=error");

    currentUser = { ...OWNER, id: "owner-2" };
    const otherUser = await get(`/api/zoho/connect/callback?code=c1&state=${state}`, cookie);
    expect(otherUser.headers.get("location")).toContain("zoho_connect=error");
    expect(complete).not.toHaveBeenCalled();

    currentUser = OWNER;
    complete.mockResolvedValue({ products: ["crm", "desk", "books", "payments"], dc: "us", deskOrgId: "1", warnings: [] });
    const ok = await get(
      `/api/zoho/connect/callback?code=c1&state=${state}&location=us&accounts-server=${encodeURIComponent("https://accounts.zoho.com")}`,
      cookie,
    );
    expect(ok.status).toBe(302);
    expect(ok.headers.get("location")).toBe("/portal/admin/integrations?zoho_connect=ok&zoho_products=crm%2Cdesk%2Cbooks%2Cpayments");
    const arg = complete.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.code).toBe("c1");
    expect(arg.accountsServer).toBe("https://accounts.zoho.com");
    expect(arg.redirectUri).toBe(`${base}/api/zoho/connect/callback`);
    expect(arg.requestedProducts).toEqual(["crm", "desk", "books", "payments"]);
    // The state cookie is single-use.
    expect(ok.headers.getSetCookie().some((c) => /^zoho_connect=;/.test(c))).toBe(true);
  });

  it("reports consent denial without calling Zoho", async () => {
    const { state, cookie } = await startAsOwner();
    const res = await get(`/api/zoho/connect/callback?error=access_denied&state=${state}`, cookie);
    expect(zohoError(res)).toContain("declined");
    expect(complete).not.toHaveBeenCalled();
  });

  it("reports a failed exchange back to the page, keeping the previous grant", async () => {
    const { state, cookie } = await startAsOwner();
    complete.mockRejectedValue(new Error("Zoho rejected the authorization code (expired or already used). Click Connect Zoho again."));
    const res = await get(`/api/zoho/connect/callback?code=c1&state=${state}`, cookie);
    expect(zohoError(res)).toContain("expired or already used");
  });

  it("shows each product's health to admins, even with the flag off, and no secrets", async () => {
    vi.stubEnv("ZOHO_CONNECT_ENABLED", "");
    currentUser = { id: "admin-2", email: "someone@digeratiexperts.com", role: "admin" };
    const res = await get("/api/zoho/connection");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ enabled: false, connectAvailable: true, canManage: false, unified: { connected: false } });
    expect(body.products.desk.state).toBe("connected");
    expect(JSON.stringify(body)).not.toContain("connect-secret");
  });

  it("restricts disconnect to the owner", async () => {
    currentUser = { id: "admin-2", email: "someone@digeratiexperts.com", role: "admin" };
    expect((await fetch(`${base}/api/zoho/disconnect`, { method: "POST" })).status).toBe(403);
    expect(disconnect).not.toHaveBeenCalled();
    currentUser = OWNER;
    const res = await fetch(`${base}/api/zoho/disconnect`, { method: "POST" });
    expect(await res.json()).toEqual({ removed: true });
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("starts on the callback's host so the state cookie comes back", async () => {
    vi.stubEnv("PUBLIC_SITE_URL", "https://digeratiexperts.com");
    const res = await get("/api/zoho/connect?returnTo=/portal/admin");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://digeratiexperts.com/api/zoho/connect?returnTo=/portal/admin");
  });
});

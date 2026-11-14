import { randomBytes } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import cookieParser from "cookie-parser";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const zohoMocks = vi.hoisted(() => ({
  profile: {
    email: "mfa-sso@portal.test",
    fullName: "MFA SSO User",
  },
}));

vi.mock("./portalZohoAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./portalZohoAuth")>();
  return {
    ...actual,
    exchangeZohoAuthCode: vi.fn(async () => ({ accessToken: "test-access-token" })),
    fetchZohoUserInfo: vi.fn(async () => ({ ...zohoMocks.profile })),
  };
});

vi.mock("./replit_integrations/object_storage", () => ({
  registerObjectStorageRoutes: vi.fn(),
  isLegacyObjectStorageEnabled: vi.fn(() => false),
  ObjectStorageService: class ObjectStorageService {},
}));

type CallbackResult = {
  response: Response;
  location: string;
};

function setCookieHeaders(headers: Headers): string[] {
  const nodeHeaders = headers as Headers & { getSetCookie?: () => string[] };
  return nodeHeaders.getSetCookie?.()
    ?? (headers.get("set-cookie") || "")
      .split(/,(?=\s*[A-Za-z0-9_]+=)/)
      .filter(Boolean);
}

function portalCookieHeader(headers: Headers): string {
  return setCookieHeaders(headers)
    .map((value) => value.split(";", 1)[0])
    .filter((value) => /^(?:portalSession|portalAuth)=/i.test(value))
    .join("; ");
}

function challengeFromLocation(location: string): {
  mfaToken: string;
  mfaMethod: string;
  returnTo: string;
} {
  const parsed = new URL(location, "http://portal.test");
  const fragment = new URLSearchParams(parsed.hash.slice(1));
  return {
    mfaToken: fragment.get("mfaToken") || "",
    mfaMethod: fragment.get("mfaMethod") || "",
    returnTo: parsed.searchParams.get("returnTo") || "",
  };
}

describe("Zoho portal SSO with local MFA", () => {
  let server: Server;
  let baseUrl: string;
  let portalAuth: typeof import("./portalAuthStore");
  const emailCodes = new Map<string, string>();
  const originalEnv = new Map<string, string | undefined>();

  const isolatedEnvironmentKeys = [
    "DATABASE_URL",
    "NODE_ENV",
    "PORTAL_MFA_ENCRYPTION_KEY",
    "ZOHO_CLIENT_ID",
    "ZOHO_CLIENT_SECRET",
    "ZOHO_PORTAL_OIDC_REDIRECT_URI",
    "ZOHO_OAUTH_STATE_SECRET",
  ];

  async function beginCallback(email: string, returnTo: string): Promise<CallbackResult> {
    zohoMocks.profile = { email, fullName: email.split("@", 1)[0] };

    const start = await fetch(
      `${baseUrl}/api/portal/auth/zoho/start?returnTo=${encodeURIComponent(returnTo)}`,
      { redirect: "manual" },
    );
    expect(start.status).toBe(302);
    const authorizeLocation = start.headers.get("location");
    expect(authorizeLocation).toBeTruthy();
    const state = new URL(authorizeLocation!).searchParams.get("state");
    expect(state).toBeTruthy();

    const pkceCookie = setCookieHeaders(start.headers)
      .map((value) => value.split(";", 1)[0])
      .find((value) => value.startsWith("portal_zoho_cv="));
    expect(pkceCookie).toBeTruthy();

    const response = await fetch(
      `${baseUrl}/api/portal/auth/zoho/callback?code=test-code&state=${encodeURIComponent(state!)}`,
      {
        headers: { Cookie: pkceCookie! },
        redirect: "manual",
      },
    );
    return {
      response,
      location: response.headers.get("location") || "",
    };
  }

  async function verifyMfa(mfaToken: string, code: string): Promise<Response> {
    return fetch(`${baseUrl}/api/portal/mfa/verify-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ mfaToken, code }),
      redirect: "manual",
    });
  }

  beforeAll(async () => {
    for (const key of isolatedEnvironmentKeys) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env.NODE_ENV = "test";
    process.env.PORTAL_MFA_ENCRYPTION_KEY = randomBytes(32).toString("base64url");
    process.env.ZOHO_CLIENT_ID = "test-client-id";
    process.env.ZOHO_CLIENT_SECRET = "test-client-secret";
    process.env.ZOHO_PORTAL_OIDC_REDIRECT_URI =
      "http://portal.test/api/portal/auth/zoho/callback";
    process.env.ZOHO_OAUTH_STATE_SECRET = randomBytes(32).toString("hex");

    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    const [{ registerRoutes }, portalAuthModule, notificationModule] = await Promise.all([
      import("./routes"),
      import("./portalAuthStore"),
      import("./services/notificationService"),
    ]);
    portalAuth = portalAuthModule;
    vi.spyOn(notificationModule.notificationService, "sendMfaCode").mockImplementation(
      async ({ email, code }) => {
        emailCodes.set(email, code);
        return true;
      },
    );

    await registerRoutes(app);

    portalAuth.setUser({
      id: "mfa-sso-user",
      email: "mfa-sso@portal.test",
      username: "mfa-sso-user",
      password: "not-used-for-sso",
      fullName: "MFA SSO User",
      role: "user",
      storeRole: "prospect",
      clientId: null,
      emailVerified: true,
      isActive: true,
      mfaEnabled: true,
      mfaMethod: "email",
    });
    portalAuth.setUser({
      id: "plain-sso-user",
      email: "plain-sso@portal.test",
      username: "plain-sso-user",
      password: "not-used-for-sso",
      fullName: "Plain SSO User",
      role: "user",
      storeRole: "prospect",
      clientId: null,
      emailVerified: true,
      isActive: true,
      mfaEnabled: false,
      mfaMethod: null,
    });

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) {
      server.close();
      await once(server, "close");
    }
    vi.restoreAllMocks();
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("does not create portal auth cookies until an MFA-enabled SSO user verifies", async () => {
    const callback = await beginCallback("mfa-sso@portal.test", "/portal/tickets");

    expect(callback.response.status).toBe(302);
    expect(portalCookieHeader(callback.response.headers)).toBe("");
    const challenge = challengeFromLocation(callback.location);
    expect(callback.location).toContain("/portal/login?");
    expect(challenge.mfaToken).toMatch(/^[a-f0-9]{32}$/);
    expect(challenge.mfaMethod).toBe("email");
    expect(challenge.returnTo).toBe("/portal/tickets");

    const wrong = await verifyMfa(challenge.mfaToken, "000000");
    expect(wrong.status).toBe(401);
    expect(portalCookieHeader(wrong.headers)).toBe("");

    const code = emailCodes.get("mfa-sso@portal.test");
    expect(code).toMatch(/^\d{6}$/);
    const verified = await verifyMfa(challenge.mfaToken, code!);
    expect(verified.status).toBe(200);
    expect(portalCookieHeader(verified.headers)).toContain("portalSession=");
    expect(portalCookieHeader(verified.headers)).toContain("portalAuth=");
    await expect(verified.json()).resolves.toMatchObject({
      success: true,
      returnTo: "/portal/tickets",
      user: { id: "mfa-sso-user" },
    });
  });

  it("denies an expired SSO MFA challenge without creating a session", async () => {
    const callback = await beginCallback("mfa-sso@portal.test", "/portal/company");
    const challenge = challengeFromLocation(callback.location);
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(now + 11 * 60 * 1000);
    try {
      const expired = await verifyMfa(challenge.mfaToken, emailCodes.get("mfa-sso@portal.test")!);
      expect(expired.status).toBe(400);
      expect(portalCookieHeader(expired.headers)).toBe("");
      await expect(expired.json()).resolves.toMatchObject({
        message: expect.stringMatching(/expired/i),
      });
    } finally {
      dateSpy.mockRestore();
    }
  });

  it("continues direct SSO login for users without local MFA", async () => {
    const callback = await beginCallback("plain-sso@portal.test", "/portal/company");

    expect(callback.response.status).toBe(302);
    expect(callback.location).toBe("/portal/company");
    expect(portalCookieHeader(callback.response.headers)).toContain("portalSession=");
    expect(portalCookieHeader(callback.response.headers)).toContain("portalAuth=");
  });
});

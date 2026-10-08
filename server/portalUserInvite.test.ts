import express from "express";
import bcrypt from "bcrypt";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { InviteDeps } from "./portalUserInvite";

/**
 * Manage Companies "Add user" (Joe, 2026-10-07). Runs the real route over HTTP
 * with the user store in memory. The admin never handles a password: the
 * account starts with one nobody holds, and the response never carries the
 * set-password link.
 */

vi.mock("./portalAuthStore", () => {
  class PortalPersistenceError extends Error {
    readonly code = "PERSISTENCE_UNAVAILABLE";
    constructor(message = "This change could not be saved. Please try again in a moment.") {
      super(message);
    }
  }
  return { PortalPersistenceError, commitUser: vi.fn(), getClient: vi.fn(), getUser: vi.fn() };
});
vi.mock("./portalAuthTokens", () => ({ issueAuthToken: vi.fn() }));
vi.mock("./services/notificationService", () => ({ notificationService: { sendPortalInvite: vi.fn() } }));

const COMPANIES: Record<string, { id: string; companyName: string; contactEmail: string; type?: string; serviceType?: string }> = {
  acme: { id: "acme", companyName: "Acme <Corp>", contactEmail: "it@acme.test", type: "client", serviceType: "managed" },
  de: { id: "de", companyName: "Digerati Experts", contactEmail: "ops@de.test", type: "msp" },
};

const state = {
  users: new Map<string, any>(),
  sent: [] as Array<{ email: string; name: string; companyName: string; setPasswordLink: string }>,
  commitFails: false,
  sendResult: true as boolean | Error,
};

describe("admin adds a user to a client company", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const { registerPortalUserInviteRoute } = await import("./portalUserInvite");
    const { PortalPersistenceError } = await import("./portalAuthStore");
    const deps: Partial<InviteDeps> = {
      getClient: (id) => COMPANIES[id] as any,
      getUser: (key) => state.users.get(key),
      commitUser: async (user) => {
        if (state.commitFails) throw new PortalPersistenceError();
        state.users.set(user.email, user);
      },
      issueInviteToken: async (user) => `tok-${user.id}`,
      sendInvite: async (data) => {
        state.sent.push(data);
        if (state.sendResult instanceof Error) throw state.sendResult;
        return state.sendResult;
      },
      baseUrl: () => "https://portal.test",
      newId: () => `u${state.users.size + 1}`,
      logEvent: () => {},
    };
    const app = express();
    app.use(express.json());
    registerPortalUserInviteRoute(app, { guards: [], deps });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    state.users.clear();
    state.sent = [];
    state.commitFails = false;
    state.sendResult = true;
  });

  const add = (companyId: string, body: unknown) =>
    fetch(`${baseUrl}/api/portal/admin/companies/${companyId}/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("creates the person inside that company and emails a set-password link", async () => {
    const res = await add("acme", { email: "  Pat@Acme.Test ", fullName: "Pat Lee" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      emailSent: true,
      user: { id: "u1", email: "pat@acme.test", fullName: "Pat Lee", role: "user", isActive: true },
    });
    // Neither the link nor any password goes back to the admin.
    expect(JSON.stringify(body)).not.toContain("tok-");
    expect(JSON.stringify(body)).not.toContain("password");

    const saved = state.users.get("pat@acme.test");
    expect(saved).toMatchObject({ clientId: "acme", role: "user", storeRole: "managed", emailVerified: true, isActive: true });
    expect(saved.password).toMatch(/^\$2[aby]\$12\$/);
    // The stored hash is of a random secret, not of anything guessable.
    for (const guess of ["", "Pat Lee", "pat@acme.test", "password", "Password1"]) {
      expect(await bcrypt.compare(guess, saved.password)).toBe(false);
    }

    expect(state.sent).toEqual([
      {
        email: "pat@acme.test",
        name: "Pat Lee",
        companyName: "Acme <Corp>",
        setPasswordLink: "https://portal.test/portal/reset-password?token=tok-u1",
      },
    ]);
  });

  it("refuses an email that already has a portal account", async () => {
    state.users.set("pat@acme.test", { id: "existing", email: "pat@acme.test" });
    const res = await add("acme", { email: "pat@acme.test", fullName: "Pat Lee" });
    expect(res.status).toBe(409);
    expect(state.sent).toEqual([]);
  });

  it("checks the company, the email and the name before creating anything", async () => {
    expect((await add("nope", { email: "a@b.test", fullName: "A" })).status).toBe(404);
    expect((await add("de", { email: "a@b.test", fullName: "A" })).status).toBe(400);
    expect((await add("acme", { email: "not-an-email", fullName: "A" })).status).toBe(400);
    expect((await add("acme", { email: "a@b.test", fullName: "   " })).status).toBe(400);
    expect((await add("acme", { email: 42, fullName: "A" })).status).toBe(400);
    expect(state.users.size).toBe(0);
    expect(state.sent).toEqual([]);
  });

  it("says so, and sends nothing, when the account cannot be saved", async () => {
    state.commitFails = true;
    const res = await add("acme", { email: "pat@acme.test", fullName: "Pat Lee" });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("PERSISTENCE_UNAVAILABLE");
    expect(state.sent).toEqual([]);
  });

  it("keeps the account and reports emailSent false when the email fails", async () => {
    state.sendResult = new Error("SMTP down");
    const res = await add("acme", { email: "pat@acme.test", fullName: "Pat Lee" });
    expect(res.status).toBe(201);
    expect((await res.json()).emailSent).toBe(false);
    expect(state.users.has("pat@acme.test")).toBe(true);
  });
});

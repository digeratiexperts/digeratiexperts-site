import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #249: the DE Desk reply/claim/release routes ran on authMiddleware
 * alone, so any signed-in portal user whose email matched a Desk session could
 * act as a DE agent. These mount the real routes with the real requireAdmin
 * and prove a non-admin is refused on all three, an admin succeeds, and the
 * agent name comes from the signed-in user, not a caller-supplied senderName.
 */

const mem = vi.hoisted(() => ({
  sessions: new Map<string, { id: string; email: string | null; claimedBy?: string | null; released?: boolean; archiveFolder?: string | null }>(),
  archived: [] as string[][],
  appended: [] as Array<{ sessionId: string; role: string; content: string; senderName: string }>,
}));

vi.mock("./services/msp-advisor", () => ({
  getDeskSessionMessages: async (id: string) => ({ session: mem.sessions.get(id) ?? null, messages: [] }),
  claimDeskSession: async (id: string, agentName: string) => {
    const s = mem.sessions.get(id);
    if (s) { s.claimedBy = agentName; s.released = false; }
    return s ?? null;
  },
  releaseDeskSession: async (id: string) => {
    const s = mem.sessions.get(id);
    if (s) { s.claimedBy = null; s.released = true; }
    return s ?? null;
  },
  appendDeskMessage: async (input: { sessionId: string; role: string; content: string; senderName: string }) => {
    mem.appended.push(input);
    return { id: `m${mem.appended.length}`, ...input };
  },
}));

vi.mock("./services/msp-advisor/persist", () => ({
  getDeskSessionMessages: async (id: string) => ({ session: mem.sessions.get(id) ?? null, messages: [] }),
  sessionIdsInSameCompany: async (id: string) => [id, "s2"],
  archiveDeskSessions: async (ids: string[]) => {
    mem.archived.push(ids);
    return ids.map((id) => {
      const s = mem.sessions.get(id);
      if (s) s.archiveFolder = "Acme";
      return { ...s, archiveFolder: "Acme" };
    });
  },
  unarchiveDeskSession: async (id: string) => {
    const s = mem.sessions.get(id);
    if (s) s.archiveFolder = null;
    return s ?? null;
  },
  deleteDeskSession: async (id: string) => mem.sessions.delete(id),
}));

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-desk-agent";

const ADMIN = { id: "a1", role: "admin", fullName: "DE Staffer", email: "staff@digeratiexperts.com" };
// A Company IT Contact whose email matches the session: the #249 attacker.
const IT_CONTACT = { id: "u1", role: "user", fullName: "Client ITC", email: "visitor@client.test", isCompanyItContact: true };

const signedInAs: express.RequestHandler = (req, _res, next) => {
  const raw = req.header("x-test-user");
  (req as express.Request & { user?: unknown }).user = raw ? JSON.parse(raw) : undefined;
  next();
};
const passThrough: express.RequestHandler = (_req, _res, next) => next();

describe("DE Desk agent routes are admin-only", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const { registerPortalDeskAgentRoutes } = await import("./portalDeskAgentRoutes");
    const { requireAdmin } = await import("./routes");
    const app = express();
    app.use(express.json());
    registerPortalDeskAgentRoutes(app, {
      actionGuards: [signedInAs, requireAdmin],
      replyGuards: [signedInAs, requireAdmin, passThrough],
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
    mem.sessions.clear();
    mem.appended.length = 0;
    mem.archived.length = 0;
    mem.sessions.set("s1", { id: "s1", email: "visitor@client.test", claimedBy: null, released: false });
  });

  const post = (path: string, user: object | null, body: object = {}) =>
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
      body: JSON.stringify(body),
    });

  for (const action of ["reply", "claim", "release"] as const) {
    it(`refuses an IT contact whose email matches the session on ${action}`, async () => {
      const body = action === "reply" ? { content: "I am totally a DE agent" } : {};
      const res = await post(`/api/portal/desk-chats/s1/${action}`, IT_CONTACT, body);
      expect(res.status).toBe(403);
      expect(mem.appended).toHaveLength(0);
      expect(mem.sessions.get("s1")!.claimedBy).toBeNull();
    });

    it(`refuses an unauthenticated caller on ${action}`, async () => {
      const res = await post(`/api/portal/desk-chats/s1/${action}`, null, action === "reply" ? { content: "x" } : {});
      expect(res.status).toBe(401);
    });
  }

  it("lets a DE admin reply, using their own name, ignoring a supplied senderName", async () => {
    const res = await post("/api/portal/desk-chats/s1/reply", ADMIN, { content: "How can I help?", senderName: "Someone Else" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, agentLive: true, agentName: "DE Staffer" });
    expect(mem.appended).toHaveLength(1);
    expect(mem.appended[0]).toMatchObject({ role: "agent", senderName: "DE Staffer" });
    expect(mem.sessions.get("s1")!.claimedBy).toBe("DE Staffer");
  });

  it("lets a DE admin claim and release", async () => {
    const claim = await post("/api/portal/desk-chats/s1/claim", ADMIN);
    expect(claim.status).toBe(200);
    expect(mem.sessions.get("s1")!.claimedBy).toBe("DE Staffer");
    const release = await post("/api/portal/desk-chats/s1/release", ADMIN);
    expect(release.status).toBe(200);
    expect(mem.sessions.get("s1")!.released).toBe(true);
  });

  it("404s a missing session for an admin, rather than leaking existence by status", async () => {
    const res = await post("/api/portal/desk-chats/nope/claim", ADMIN);
    expect(res.status).toBe(404);
  });

  it("rejects empty or over-long reply content for an admin", async () => {
    expect((await post("/api/portal/desk-chats/s1/reply", ADMIN, { content: "   " })).status).toBe(400);
    expect((await post("/api/portal/desk-chats/s1/reply", ADMIN, { content: "x".repeat(8001) })).status).toBe(400);
  });

  const del = (path: string, user: object | null) =>
    fetch(`${baseUrl}${path}`, {
      method: "DELETE",
      headers: user ? { "x-test-user": JSON.stringify(user) } : {},
    });

  for (const action of ["archive", "unarchive"] as const) {
    it(`refuses an IT contact on ${action}`, async () => {
      const res = await post(`/api/portal/desk-chats/s1/${action}`, IT_CONTACT);
      expect(res.status).toBe(403);
      expect(mem.archived).toHaveLength(0);
    });
  }

  it("refuses an IT contact and an anonymous caller on delete", async () => {
    expect((await del("/api/portal/desk-chats/s1", IT_CONTACT)).status).toBe(403);
    expect((await del("/api/portal/desk-chats/s1", null)).status).toBe(401);
    expect(mem.sessions.has("s1")).toBe(true);
  });

  it("lets a DE admin archive one chat, or every chat from its company", async () => {
    const one = await post("/api/portal/desk-chats/s1/archive", ADMIN);
    expect(one.status).toBe(200);
    expect(await one.json()).toMatchObject({ success: true, folder: "Acme" });
    expect(mem.archived[0]).toEqual(["s1"]);

    const company = await post("/api/portal/desk-chats/s1/archive", ADMIN, { company: true });
    expect(company.status).toBe(200);
    expect(mem.archived[1]).toEqual(["s1", "s2"]);

    const restore = await post("/api/portal/desk-chats/s1/unarchive", ADMIN);
    expect(restore.status).toBe(200);
    expect(mem.sessions.get("s1")!.archiveFolder).toBeNull();
  });

  it("lets a DE admin delete a chat, and 404s one that is gone", async () => {
    expect((await del("/api/portal/desk-chats/s1", ADMIN)).status).toBe(200);
    expect(mem.sessions.has("s1")).toBe(false);
    expect((await del("/api/portal/desk-chats/s1", ADMIN)).status).toBe(404);
    expect((await post("/api/portal/desk-chats/nope/archive", ADMIN)).status).toBe(404);
  });
});

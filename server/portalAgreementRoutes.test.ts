import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { agreementGateStatus, welcomeVideoFrom, PORTAL_AGREEMENTS } from "@shared/portalAgreements";

/**
 * The agreement gate over HTTP with the memory store: company agreements are
 * signed once by someone who can bind the company and then cover everyone;
 * personal agreements are signed by each person; staff below the signer wait
 * on the company; DE admins never sign for a client; every signature carries
 * the hash of the PDF that was shown.
 */

vi.mock("./integrations/ensureDeSyncSchema", () => ({ ensureDeSyncSchema: async () => undefined }));
vi.mock("./integrations/deSyncOutboxRecovery", () => ({ recoverStaleOutboxLocks: async () => 0 }));

const CLIENTS = {
  acme: { id: "acme", companyName: "Acme Corp", hubAccountId: null },
  globex: { id: "globex", companyName: "Globex", hubAccountId: null },
} as Record<string, { id: string; companyName: string; hubAccountId: string | null }>;

const ANN = { id: "u-ann", role: "user", clientId: "acme", fullName: "Ann Acme", email: "ann@acme.test" };
const IVY = { id: "u-it", role: "user", clientId: "acme", fullName: "Ivy IT", email: "ivy@acme.test", isCompanyItContact: true };
const GUS_IT = { id: "u-gus", role: "user", clientId: "globex", fullName: "Gus Globex", email: "gus@globex.test", isCompanyItContact: true };
const DE_ADMIN = { id: "u-admin", role: "admin", clientId: null, fullName: "DE Staff", email: "staff@de.test", impersonatingCompanyId: "acme" };

const signedInAs: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return res.status(401).json({ error: "Sign in" });
  next();
};
const adminOnly: express.RequestHandler = (req, res, next) => {
  if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
};

const COMPANY_KEYS = PORTAL_AGREEMENTS.filter((a) => a.scope === "company").map((a) => a.key);
const USER_KEYS = PORTAL_AGREEMENTS.filter((a) => a.scope === "user").map((a) => a.key);
const ALL_KEYS = PORTAL_AGREEMENTS.map((a) => a.key);

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const { registerPortalAgreementRoutes } = await import("./portalAgreementRoutes");
  const app = express();
  app.use(express.json());
  registerPortalAgreementRoutes(app, {
    guards: [signedInAs],
    adminGuards: [signedInAs, adminOnly],
    getClient: (id) => CLIENTS[id],
    isCompanySigner: (u: any) => u?.role !== "admin" && Boolean(u?.isCompanyItContact),
    readPdf: async (p) => Buffer.from(`pdf:${p}`),
    mode: () => "enforce",
    videos: () => ({ company: welcomeVideoFrom("company", null), user: welcomeVideoFrom("user", "https://youtu.be/abcDEF12345") }),
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

beforeEach(async () => {
  const { _resetAgreementMemory } = await import("./portalAgreementStore");
  _resetAgreementMemory();
});

const call = (method: string, path: string, user: object | null, body?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const status = async (user: object) => (await (await call("GET", "/api/portal/agreements", user)).json()) as any;
const sign = (user: object, keys: string[], signerName = "Typed Name") => call("POST", "/api/portal/agreements/sign", user, { keys, signerName, accept: true });

describe("agreement gate", () => {
  it("holds a staff member on the company agreement until the company signs", async () => {
    const before = await status(ANN);
    expect(before.mode).toBe("enforce");
    expect(before.status.complete).toBe(false);
    expect(before.status.canFinish).toBe(false);
    expect(before.status.items.find((i: any) => i.scope === "company").state).toBe("awaiting_company");

    expect((await sign(ANN, COMPANY_KEYS)).status).toBe(403);
    expect((await sign(ANN, USER_KEYS, "Ann Acme")).status).toBe(200);
    expect((await status(ANN)).status.complete).toBe(false);

    expect((await sign(IVY, ALL_KEYS, "Ivy IT")).status).toBe(200);
    expect((await status(IVY)).status.complete).toBe(true);
    expect((await status(ANN)).status.complete).toBe(true);
  });

  it("keeps personal agreements personal and companies apart", async () => {
    await sign(IVY, ALL_KEYS, "Ivy IT");
    const ann = await status(ANN);
    expect(ann.status.items.find((i: any) => i.scope === "company").state).toBe("signed");
    expect(ann.status.items.filter((i: any) => i.scope === "user").every((i: any) => i.state === "outstanding")).toBe(true);
    const gus = await status(GUS_IT);
    expect(gus.status.items.every((i: any) => i.state === "outstanding")).toBe(true);
  });

  it("needs the box ticked, a typed name and known keys", async () => {
    expect((await call("POST", "/api/portal/agreements/sign", IVY, { keys: ALL_KEYS, signerName: "Ivy IT" })).status).toBe(400);
    expect((await call("POST", "/api/portal/agreements/sign", IVY, { keys: ALL_KEYS, signerName: " ", accept: true })).status).toBe(400);
    expect((await call("POST", "/api/portal/agreements/sign", IVY, { keys: ["nope"], signerName: "Ivy IT", accept: true })).status).toBe(400);
    expect((await call("POST", "/api/portal/agreements/sign", IVY, { keys: [], signerName: "Ivy IT", accept: true })).status).toBe(400);
  });

  it("never lets DE staff sign for a client, and reports them exempt", async () => {
    expect((await sign(DE_ADMIN, ALL_KEYS)).status).toBe(403);
    const s = await status(DE_ADMIN);
    expect(s.exempt).toBe(true);
    expect(s.status.complete).toBe(true);
  });

  it("records evidence once per version and shows it to DE admins only", async () => {
    await sign(IVY, ALL_KEYS, "Ivy  IT");
    await sign(IVY, ALL_KEYS, "Ivy IT");
    expect((await call("GET", "/api/portal/admin/agreements?clientId=acme", IVY)).status).toBe(403);
    const log = (await (await call("GET", "/api/portal/admin/agreements?clientId=acme", DE_ADMIN)).json()) as any;
    expect(log.signatures).toHaveLength(ALL_KEYS.length);
    for (const s of log.signatures) {
      expect(s.signerName).toBe("Ivy IT");
      expect(s.signerEmail).toBe("ivy@acme.test");
      expect(s.documentSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("serves the welcome videos as player URLs", async () => {
    const s = await status(ANN);
    expect(s.videos.user).toMatchObject({ url: "https://www.youtube-nocookie.com/embed/abcDEF12345", kind: "embed" });
    expect(s.videos.company.url).toBeNull();
  });
});

describe("agreementGateStatus", () => {
  const ref = (key: string, version: string, scope: "company" | "user") => ({ key, version, scope, signerName: "X", signedAt: "2026-01-01T00:00:00Z" });

  it("asks again, as updated, when a version moves on", () => {
    const a = [{ ...PORTAL_AGREEMENTS[1], version: "2027.01" }];
    const s = agreementGateStatus({ company: [], user: [ref(a[0].key, "2026.10", "user")], isCompanySigner: false, agreements: a });
    expect(s.items[0].state).toBe("updated");
    expect(s.canFinish).toBe(true);
  });
});

describe("welcomeVideoFrom", () => {
  it("accepts YouTube, Vimeo, Loom and same-origin files only", () => {
    expect(welcomeVideoFrom("user", "https://www.youtube.com/watch?v=abcDEF12345").url).toBe("https://www.youtube-nocookie.com/embed/abcDEF12345");
    expect(welcomeVideoFrom("user", "https://vimeo.com/123456789").url).toBe("https://player.vimeo.com/video/123456789");
    expect(welcomeVideoFrom("user", "https://www.loom.com/share/0123456789abcdef").url).toBe("https://www.loom.com/embed/0123456789abcdef");
    expect(welcomeVideoFrom("user", "/assets/video/welcome.mp4")).toMatchObject({ kind: "file" });
    expect(welcomeVideoFrom("user", "https://evil.example/embed").url).toBeNull();
    expect(welcomeVideoFrom("user", "/../../etc/passwd.mp4").url).toBeNull();
    expect(welcomeVideoFrom("user", "javascript:alert(1)").url).toBeNull();
  });
});

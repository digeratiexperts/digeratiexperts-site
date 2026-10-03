import { readFileSync } from "node:fs";
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemStorage } from "./storage";

const getObjectEntityFile = vi.fn();
const canAccessObjectEntity = vi.fn();
const downloadObject = vi.fn();

vi.mock("./replit_integrations/object_storage/objectStorage", () => {
  class ObjectNotFoundError extends Error {}
  return {
    ObjectNotFoundError,
    ObjectStorageService: class {
      getObjectEntityFile = getObjectEntityFile;
      canAccessObjectEntity = canAccessObjectEntity;
      downloadObject = downloadObject;
      getObjectEntityUploadURL = vi.fn(async () => "https://storage.example/uploads/new");
      normalizeObjectEntityPath = vi.fn(() => "/objects/uploads/new");
    },
  };
});

/**
 * Regression guards for #250 (raw Zoho proxy routes) and #237 (object storage).
 * A new `/api/zoho/*` route is admin-only unless it is explicitly listed here
 * as public or self-scoped, so a collection-vs-object mismatch cannot reappear.
 */

const PUBLIC = new Set(["GET /api/zoho/status", "GET /api/zoho/oauth/callback"]);

// Self-scoped: each handler resolves the caller's own Desk contact / Billing customer from the session email.
const SELF_SCOPED = new Set([
  "GET /api/zoho/desk/tickets/:id", // non-admins must own the ticket (contactId check in the handler)
  "POST /api/zoho/desk/tickets",
  "GET /api/zoho/desk/my-tickets",
  "GET /api/zoho/desk/departments",
  "GET /api/zoho/billing/my-subscription",
  "GET /api/zoho/billing/my-invoices",
  "GET /api/zoho/billing/plans",
]);

function zohoRoutes() {
  const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const routes: Array<{ key: string; guards: string }> = [];
  const re = /app\.(get|post|put|patch|delete)\(\s*("\/api\/zoho\/[^"]*"|[A-Za-z_]+),\s*(\[[^\]]*\]|[A-Za-z_]+)?/g;
  for (const m of src.matchAll(re)) {
    if (!m[2].startsWith('"')) continue;
    routes.push({ key: `${m[1].toUpperCase()} ${m[2].slice(1, -1)}`, guards: m[3] ?? "" });
  }
  return routes;
}

describe("raw Zoho routes are admin-gated unless explicitly allowlisted (#250)", () => {
  const routes = zohoRoutes();

  it("finds the Zoho routes", () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it("every non-allowlisted /api/zoho route requires requireAdmin", () => {
    const open = routes.filter((r) => !PUBLIC.has(r.key) && !SELF_SCOPED.has(r.key) && !r.guards.includes("requireAdmin"));
    expect(open.map((r) => r.key)).toEqual([]);
  });

  it("self-scoped and public routes still require authentication, except the listed public ones", () => {
    const unauth = routes.filter((r) => SELF_SCOPED.has(r.key) && !r.guards.includes("authMiddleware"));
    expect(unauth.map((r) => r.key)).toEqual([]);
  });

  it("collection and object-by-id routes agree: CRM accounts/:id and the list are both admin-only", () => {
    const byKey = new Map(routes.map((r) => [r.key, r.guards]));
    expect(byKey.get("GET /api/zoho/crm/accounts")).toContain("requireAdmin");
    expect(byKey.get("GET /api/zoho/crm/accounts/:id")).toContain("requireAdmin");
    expect(byKey.get("GET /api/zoho/desk/tickets")).toContain("requireAdmin");
  });

  it("the allowlist has no stale entries", () => {
    const keys = new Set(routes.map((r) => r.key));
    for (const k of [...PUBLIC, ...SELF_SCOPED]) expect(keys.has(k), k).toBe(true);
  });

  it("Desk ticket-by-id refuses a non-admin whose Desk contact does not own the ticket", () => {
    const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    const start = src.indexOf('app.get("/api/zoho/desk/tickets/:id"');
    const handler = src.slice(start, src.indexOf("\n  });", start));
    expect(handler).toContain('req.user?.role !== "admin"');
    expect(handler).toContain("ticket.contactId !== contact.id");
    expect(handler).toContain("403");
  });
});

describe("object storage routes enforce the current tenant-file ACL (#237)", () => {
  const OBJ = "/objects/uploads/a-secret.pdf";
  let server: Server;
  let base = "";
  let storage: MemStorage;
  let caller: { id: string; role: string; clientId: string | null } | null;

  beforeAll(async () => {
    const { registerObjectStorageRoutes } = await import("./replit_integrations/object_storage/routes");
    storage = new MemStorage();
    const app = express();
    app.use(express.json());
    // Same wiring shape as registerRoutes in routes.ts: auth first, then admin, resolver backed by findTenantFileByFileUrl.
    const auth: express.RequestHandler = (req, res, next) => {
      if (!caller) return res.status(401).json({ error: "Not authenticated" });
      (req as any).userId = caller.id;
      (req as any).user = caller;
      next();
    };
    const admin: express.RequestHandler = (req, res, next) =>
      (req as any).user?.role === "admin" ? next() : res.status(403).json({ error: "Admin access required" });
    registerObjectStorageRoutes(app, {
      auth,
      admin,
      resolveTenantOwnerClientId: async (objectPath) => (await storage.findTenantFileByFileUrl(objectPath))?.clientId ?? null,
    });
    server = createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  let fileId: string;
  beforeEach(async () => {
    getObjectEntityFile.mockReset().mockResolvedValue({ name: "uploads/a-secret.pdf" });
    canAccessObjectEntity.mockReset().mockResolvedValue(false);
    downloadObject.mockReset().mockImplementation(async (_f: unknown, res: any) => res.status(200).send("BYTES"));
    for (const f of await storage.getTenantFilesByClientId("client-a")) await storage.deleteTenantFile(f.id);
    const f = await storage.createTenantFile({
      clientId: "client-a", fileName: "a.pdf", fileType: "document", category: "documentation",
      description: "", fileUrl: OBJ, uploadedBy: "admin-1",
    });
    fileId = f.id;
    caller = { id: "user-a", role: "user", clientId: "client-a" };
  });

  it("refuses an unauthenticated read and never touches storage", async () => {
    caller = null;
    const r = await fetch(base + OBJ);
    expect(r.status).toBe(401);
    expect(downloadObject).not.toHaveBeenCalled();
  });

  it("serves the owning tenant's registered file", async () => {
    const r = await fetch(base + OBJ);
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("BYTES");
  });

  it("refuses another tenant's object (registered to client-a, caller is client-b)", async () => {
    caller = { id: "user-b", role: "user", clientId: "client-b" };
    const r = await fetch(base + OBJ);
    expect(r.status).toBe(403);
    expect(downloadObject).not.toHaveBeenCalled();
  });

  it("refuses a caller with no tenant at all (self-registered prospect)", async () => {
    caller = { id: "user-p", role: "user", clientId: null };
    expect((await fetch(base + OBJ)).status).toBe(403);
  });

  it("refuses an object path that is in no tenant registry (default deny)", async () => {
    expect((await fetch(`${base}/objects/uploads/unregistered.pdf`)).status).toBe(403);
    expect(downloadObject).not.toHaveBeenCalled();
  });

  it("refuses the former owner once the tenant file record is deleted", async () => {
    expect(await storage.deleteTenantFile(fileId)).toBe(true);
    expect(await storage.findTenantFileByFileUrl(OBJ)).toBeUndefined();
    const r = await fetch(base + OBJ);
    expect(r.status).toBe(403);
    expect(downloadObject).not.toHaveBeenCalled();
  });

  it("still lets an admin read, and a failed tenant lookup denies rather than allows", async () => {
    caller = { id: "admin-1", role: "admin", clientId: null };
    expect((await fetch(base + OBJ)).status).toBe(200);
    caller = { id: "user-a", role: "user", clientId: "client-a" };
    vi.spyOn(storage, "findTenantFileByFileUrl").mockRejectedValueOnce(new Error("db down"));
    expect((await fetch(base + OBJ)).status).toBe(403);
  });

  it("upload URL minting is admin-only: anonymous 401, tenant user 403, admin 200", async () => {
    const post = () => fetch(`${base}/api/uploads/request-url`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "x.pdf" }),
    });
    caller = null;
    expect((await post()).status).toBe(401);
    caller = { id: "user-a", role: "user", clientId: "client-a" };
    expect((await post()).status).toBe(403);
    caller = { id: "admin-1", role: "admin", clientId: null };
    expect((await post()).status).toBe(200);
  });

  it("the server wires the real tenant-file lookup into the object routes and never mounts them bare", () => {
    const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    const start = src.indexOf("registerObjectStorageRoutes(app, {");
    expect(start).toBeGreaterThan(-1);
    const call = src.slice(start, src.indexOf("});", start));
    expect(call).toContain("auth: authMiddleware");
    expect(call).toContain("admin: requireAdmin");
    expect(call).toContain("storage.findTenantFileByFileUrl(objectPath)");
    expect(src).not.toMatch(/registerObjectStorageRoutes\(app\)/);
  });
});

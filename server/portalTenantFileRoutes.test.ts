import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { faults, resetFakeDb, tables } from "./tenantFilesFakeDb.testkit";

/**
 * #259 / PR #373 review: route-level negative tests for tenant files.
 *
 * Runs the real tenant file routes (portalTenantFileRoutes.ts) and the real
 * object serve route (registerObjectStorageRoutes + authorizeObjectRead) over
 * HTTP, wired to the real storage classes exactly as routes.ts wires them
 * (storage.findTenantFileByFileUrl). DatabaseStorage runs its real Drizzle
 * queries against the pg-proxy fake; MemStorage runs as-is. Only the auth
 * middleware (the test names the user in a header), the portal company/user
 * directory, and the GCS client are stood in.
 *
 * There is no "get one file by id" route: a tenant file's bytes are fetched
 * only by its file URL (GET /objects/...), so "read/download" is tested there.
 */

vi.mock("./db", async () => (await import("./tenantFilesFakeDb.testkit")).fakeDbModule());

const objectStorage = vi.hoisted(() => ({
  getObjectEntityFile: vi.fn(),
  canAccessObjectEntity: vi.fn(),
  downloadObject: vi.fn(),
}));

vi.mock("./replit_integrations/object_storage/objectStorage", () => {
  class ObjectNotFoundError extends Error {}
  return {
    ObjectNotFoundError,
    ObjectStorageService: class {
      getObjectEntityFile = objectStorage.getObjectEntityFile;
      canAccessObjectEntity = objectStorage.canAccessObjectEntity;
      downloadObject = objectStorage.downloadObject;
      getObjectEntityUploadURL = vi.fn();
      normalizeObjectEntityPath = vi.fn();
    },
  };
});

const COMPANIES: Record<string, { companyName: string }> = {
  "client-a": { companyName: "Acme" },
  "client-b": { companyName: "Globex" },
};
const USERS: Record<string, { clientId: string }> = {
  "alice@acme.test": { clientId: "client-a" },
  "bob@globex.test": { clientId: "client-b" },
};

const ALICE = { id: "u-alice", email: "alice@acme.test", role: "user", clientId: "client-a" };
const BOB = { id: "u-bob", email: "bob@globex.test", role: "user", clientId: "client-b" };
const ADMIN = { id: "u-admin", email: "admin@de.test", role: "admin", clientId: null };

const A_PATH = "/objects/uploads/acme-contract";

/** Stands in for authMiddleware: 401 without a user, else the named user. */
const auth: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  if (!raw) return res.status(401).json({ error: "Authentication required" });
  const user = JSON.parse(raw);
  (req as any).user = user;
  (req as any).userId = user.id;
  next();
};
const admin: express.RequestHandler = (req, res, next) =>
  (req as any).user?.role === "admin" ? next() : res.status(403).json({ error: "Admin access required" });

type Kind = "DatabaseStorage" | "MemStorage";

describe.each<Kind>(["DatabaseStorage", "MemStorage"])("tenant file routes keep tenants apart (%s)", (kind) => {
  let server: Server;
  let baseUrl = "";
  let current: any;
  const securityEvents: string[] = [];

  async function newStorage() {
    const mod = await import("./storage");
    return kind === "DatabaseStorage" ? new mod.DatabaseStorage() : new mod.MemStorage();
  }

  beforeAll(async () => {
    await import("./db");
    const { registerPortalTenantFileRoutes } = await import("./portalTenantFileRoutes");
    const { registerObjectStorageRoutes } = await import("./replit_integrations/object_storage/routes");

    // Delegates to whichever storage instance is current, so a test can
    // simulate a restart by swapping in a fresh instance.
    const storage = new Proxy({} as any, { get: (_t, prop) => (current as any)[prop].bind(current) });

    const app = express();
    app.use(express.json());
    // Same resolver as registerRoutes in routes.ts.
    registerObjectStorageRoutes(app, {
      auth,
      admin,
      resolveTenantOwnerClientId: async (objectPath) => {
        const file = await storage.findTenantFileByFileUrl(objectPath);
        return file?.clientId ?? null;
      },
    });
    registerPortalTenantFileRoutes(app, {
      auth,
      admin,
      validateInput: (_req, _res, next) => next(),
      storage,
      getCompany: (id) => COMPANIES[id],
      getUserByEmail: (email) => USERS[email],
      logSecurityEvent: (event) => securityEvents.push(event),
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

  let aFileId = "";

  beforeEach(async () => {
    resetFakeDb();
    securityEvents.length = 0;
    current = await newStorage();
    objectStorage.getObjectEntityFile.mockReset().mockResolvedValue({ name: "uploads/acme-contract" });
    // Admin uploads, so the GCS ACL never names a tenant user.
    objectStorage.canAccessObjectEntity.mockReset().mockResolvedValue(false);
    objectStorage.downloadObject.mockReset().mockImplementation(async (_file: unknown, res: express.Response) => {
      res.status(200).send("ACME-BYTES");
    });
    const created = await call("POST", "/api/portal/admin/companies/client-a/files", ADMIN, {
      fileName: "Contract.pdf",
      objectPath: A_PATH,
    });
    expect(created.status).toBe(200);
    aFileId = (await created.json()).file.id;
  });

  function call(method: string, path: string, user?: object, body?: object) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (user) headers["x-test-user"] = JSON.stringify(user);
    return fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  }

  async function myFiles(user: object) {
    const res = await call("GET", "/api/portal/my-files", user);
    expect(res.status).toBe(200);
    return (await res.json()).files.map((f: any) => f.id);
  }

  async function adminList(companyId: string) {
    const res = await call("GET", `/api/portal/admin/companies/${companyId}/files`, ADMIN);
    expect(res.status).toBe(200);
    return (await res.json()).files.map((f: any) => f.id);
  }

  it("owner positive path: tenant A lists and downloads its own file", async () => {
    expect(await myFiles(ALICE)).toEqual([aFileId]);
    const res = await call("GET", A_PATH, ALICE);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ACME-BYTES");
    expect(await adminList("client-a")).toEqual([aFileId]);
  });

  it("tenant B does not see tenant A's file in its own list", async () => {
    expect(await myFiles(BOB)).toEqual([]);
  });

  it("tenant B cannot download tenant A's file by its file URL", async () => {
    const res = await call("GET", A_PATH, BOB);
    expect(res.status).toBe(403);
    expect(objectStorage.downloadObject).not.toHaveBeenCalled();
  });

  it("tenant B cannot list or delete tenant A's files through the admin routes", async () => {
    expect((await call("GET", "/api/portal/admin/companies/client-a/files", BOB)).status).toBe(403);
    expect((await call("DELETE", `/api/portal/admin/companies/client-a/files/${aFileId}`, BOB)).status).toBe(403);
    expect((await call("DELETE", `/api/portal/admin/companies/client-b/files/${aFileId}`, BOB)).status).toBe(403);
    expect((await call("POST", "/api/portal/admin/companies/client-a/files", BOB, { fileName: "x", objectPath: A_PATH })).status).toBe(403);
    expect(await myFiles(ALICE)).toEqual([aFileId]);
  });

  it("a non-admin naming an impersonated company still sees only its own files", async () => {
    expect(await myFiles({ ...BOB, impersonatingCompanyId: "client-a" })).toEqual([]);
  });

  it("deleting by id under another company's URL is a 404 and deletes nothing", async () => {
    const res = await call("DELETE", `/api/portal/admin/companies/client-b/files/${aFileId}`, ADMIN);
    expect(res.status).toBe(404);
    expect(securityEvents).not.toContain("TENANT_FILE_DELETED");
    expect(await myFiles(ALICE)).toEqual([aFileId]);
    expect((await call("GET", A_PATH, ALICE)).status).toBe(200);
  });

  it("a deleted file is refused: gone from lists, its URL no longer authorizes the owner, re-delete is 404", async () => {
    const del = await call("DELETE", `/api/portal/admin/companies/client-a/files/${aFileId}`, ADMIN);
    expect(del.status).toBe(200);
    expect(await myFiles(ALICE)).toEqual([]);
    expect(await adminList("client-a")).toEqual([]);
    expect((await call("GET", A_PATH, ALICE)).status).toBe(403);
    expect((await call("GET", A_PATH, BOB)).status).toBe(403);
    expect(objectStorage.downloadObject).not.toHaveBeenCalled();
    expect((await call("DELETE", `/api/portal/admin/companies/client-a/files/${aFileId}`, ADMIN)).status).toBe(404);
    if (kind === "DatabaseStorage") {
      const row = tables.portal_tenant_files.find((r) => r.id === aFileId)!;
      expect(row.deleted_at).toBeTruthy();
      expect(row.deleted_by).toBe(ADMIN.id);
      expect(row.file_url).toBe(A_PATH);
    }
  });

  it("unauthenticated callers are refused on every tenant file route", async () => {
    for (const [method, path] of [
      ["GET", "/api/portal/my-files"],
      ["GET", "/api/portal/admin/companies/client-a/files"],
      ["POST", "/api/portal/admin/companies/client-a/files"],
      ["DELETE", `/api/portal/admin/companies/client-a/files/${aFileId}`],
      ["GET", A_PATH],
    ] as const) {
      expect((await call(method, path)).status, `${method} ${path}`).toBe(401);
    }
    expect(objectStorage.downloadObject).not.toHaveBeenCalled();
    expect(await myFiles(ALICE)).toEqual([aFileId]);
  });

  it("a file URL registered to two tenants has no owner: both are denied", async () => {
    const dup = await call("POST", "/api/portal/admin/companies/client-b/files", ADMIN, {
      fileName: "Copy.pdf",
      objectPath: A_PATH,
    });
    expect(dup.status).toBe(200);
    expect((await call("GET", A_PATH, ALICE)).status).toBe(403);
    expect((await call("GET", A_PATH, BOB)).status).toBe(403);
    expect((await call("GET", A_PATH, ADMIN)).status).toBe(200);
    if (kind === "DatabaseStorage") {
      // Same rule on the cache fallback when the DB read fails.
      faults.reads = true;
      expect((await call("GET", A_PATH, ALICE)).status).toBe(403);
      expect((await call("GET", A_PATH, BOB)).status).toBe(403);
    }
  });

  it("A1/A2/B1 for one URL is ambiguous: two rows for A must not hide B", async () => {
    // A second live row for tenant A, then one for tenant B. A lookup that
    // limits rows (not distinct owners) could see only A's two rows and
    // authorize Alice; the distinct-owner lookup must deny both.
    const a2 = await call("POST", "/api/portal/admin/companies/client-a/files", ADMIN, {
      fileName: "Again.pdf",
      objectPath: A_PATH,
    });
    expect(a2.status).toBe(200);
    expect((await call("GET", A_PATH, ALICE)).status).toBe(200); // still one owner
    const b1 = await call("POST", "/api/portal/admin/companies/client-b/files", ADMIN, {
      fileName: "Copy.pdf",
      objectPath: A_PATH,
    });
    expect(b1.status).toBe(200);
    expect((await call("GET", A_PATH, ALICE)).status).toBe(403);
    expect((await call("GET", A_PATH, BOB)).status).toBe(403);
    expect((await call("GET", A_PATH, ADMIN)).status).toBe(200);
    if (kind === "DatabaseStorage") {
      faults.reads = true;
      expect((await call("GET", A_PATH, ALICE)).status).toBe(403);
      expect((await call("GET", A_PATH, BOB)).status).toBe(403);
    }
  });

  if (kind === "DatabaseStorage") {
    it("ownership survives a restart and stays tenant-scoped", async () => {
      current = await newStorage();
      expect(await myFiles(ALICE)).toEqual([aFileId]);
      expect((await call("GET", A_PATH, ALICE)).status).toBe(200);
      expect((await call("GET", A_PATH, BOB)).status).toBe(403);
    });

    it("a deleted file stays refused after a restart", async () => {
      await call("DELETE", `/api/portal/admin/companies/client-a/files/${aFileId}`, ADMIN);
      current = await newStorage();
      expect((await call("GET", A_PATH, ALICE)).status).toBe(403);
      expect(await myFiles(ALICE)).toEqual([]);
    });

    it("when the DB read fails, the cache fallback keeps tenant scope and never revives a deleted file", async () => {
      faults.reads = true;
      expect((await call("GET", A_PATH, ALICE)).status).toBe(200);
      expect((await call("GET", A_PATH, BOB)).status).toBe(403);
      faults.reads = false;
      await call("DELETE", `/api/portal/admin/companies/client-a/files/${aFileId}`, ADMIN);
      faults.reads = true;
      expect((await call("GET", A_PATH, ALICE)).status).toBe(403);
      // A fresh process has an empty cache: DB down means default deny.
      current = await newStorage();
      expect((await call("GET", "/objects/uploads/acme-contract", ALICE)).status).toBe(403);
      // Listing does not fall back: it fails loudly rather than show nothing.
      expect((await call("GET", "/api/portal/my-files", ALICE)).status).toBe(500);
    });
  }
});

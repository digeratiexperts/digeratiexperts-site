import { readFileSync } from "node:fs";
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { isStorageUnavailableError, sendStorageUnavailable, STORAGE_UNAVAILABLE_MESSAGE } from "./storageUnavailableResponse";

/**
 * #395 residual of #378: a route with its own catch block must answer 503,
 * not 500, when durable storage is unavailable (StorageUnavailableError).
 */

vi.mock("./db", () => ({
  db: null,
  dbReady: false,
  initPromise: Promise.resolve(false),
  getDatabaseStatus: () => ({ connected: false, type: "memory" }),
  reconnectDatabase: async () => false,
}));

function fakeRes(headersSent = false) {
  const out: { status?: number; body?: any } = {};
  const res: any = {
    headersSent,
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: any) {
      out.body = body;
      return res;
    },
  };
  return { res, out };
}

describe("sendStorageUnavailable", () => {
  it("answers 503 STORAGE_UNAVAILABLE for the real StorageUnavailableError", async () => {
    const { StorageUnavailableError } = await import("./storage");
    const error = new StorageUnavailableError();
    expect(isStorageUnavailableError(error)).toBe(true);
    const { res, out } = fakeRes();
    expect(sendStorageUnavailable(res, error)).toBe(true);
    expect(out.status).toBe(503);
    expect(out.body).toEqual({
      code: "STORAGE_UNAVAILABLE",
      message: STORAGE_UNAVAILABLE_MESSAGE,
      error: STORAGE_UNAVAILABLE_MESSAGE,
    });
  });

  it("leaves every other error to the route's own handling", () => {
    for (const error of [new Error("boom"), { code: "STORAGE_UNAVAILABLE" }, { name: "StorageUnavailableError" }, null, undefined, "x"]) {
      const { res, out } = fakeRes();
      expect(sendStorageUnavailable(res, error)).toBe(false);
      expect(out.status).toBeUndefined();
    }
  });

  it("does not write a second response when headers were already sent", async () => {
    const { StorageUnavailableError } = await import("./storage");
    const { res, out } = fakeRes(true);
    expect(sendStorageUnavailable(res, new StorageUnavailableError())).toBe(true);
    expect(out.status).toBeUndefined();
  });
});

describe("tenant file routes answer 503 when storage is unavailable", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const { StorageUnavailableError } = await import("./storage");
    const { registerPortalTenantFileRoutes } = await import("./portalTenantFileRoutes");
    const unavailable = async () => {
      throw new StorageUnavailableError();
    };
    const app = express();
    app.use(express.json());
    const auth: express.RequestHandler = (req, _res, next) => {
      (req as any).user = JSON.parse(req.header("x-test-user") || "{}");
      (req as any).userId = (req as any).user.id;
      next();
    };
    registerPortalTenantFileRoutes(app, {
      auth,
      admin: (_req, _res, next) => next(),
      validateInput: (_req, _res, next) => next(),
      storage: {
        getTenantFilesByClientId: unavailable,
        createTenantFile: unavailable,
        deleteTenantFile: unavailable,
      } as any,
      getCompany: () => ({ companyName: "Acme" }),
      getUserByEmail: () => ({ clientId: "client-a" }),
      logSecurityEvent: () => undefined,
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

  const ADMIN = { id: "u-admin", email: "admin@de.test", role: "admin", clientId: null };
  const ALICE = { id: "u-alice", email: "alice@acme.test", role: "user", clientId: "client-a" };

  async function call(method: string, path: string, user: object, body?: object) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "x-test-user": JSON.stringify(user) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  }

  it("ungated reads: my-files and the admin list", async () => {
    for (const [path, user] of [["/api/portal/my-files", ALICE], ["/api/portal/admin/companies/client-a/files", ADMIN]] as const) {
      const res = await call("GET", path, user);
      expect(res.status, path).toBe(503);
      expect(res.body.code, path).toBe("STORAGE_UNAVAILABLE");
    }
  });

  it("writes reached past the gate: upload and delete", async () => {
    const created = await call("POST", "/api/portal/admin/companies/client-a/files", ADMIN, { fileName: "a.pdf", objectPath: "/objects/uploads/a" });
    expect(created.status).toBe(503);
    const deleted = await call("DELETE", "/api/portal/admin/companies/client-a/files/f1", ADMIN);
    expect(deleted.status).toBe(503);
  });
});

/**
 * routes.ts handlers are registered inline in one large function, so this
 * guard reads the source: every route handler that calls `storage.*` inside
 * its own try/catch maps StorageUnavailableError to 503. A handler listed in
 * DEGRADES reports storage as an unavailable source on purpose (#233) and
 * never answers 500 for it.
 */
describe("routes.ts storage-backed handlers map storage outages to 503", () => {
  const DEGRADES = new Set([
    'app.get("/api/portal/profile/provisioning"',
    'app.get("/api/portal/orders"',
  ]);

  function handlerBlocks() {
    const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    const lines = src.split("\n");
    const starts = lines.flatMap((line, i) => (/^  app\.(get|post|put|patch|delete)\(/.test(line) ? [i] : []));
    return starts.map((start, n) => {
      // A handler ends at its own top-level close; helpers between routes are not part of it.
      const next = starts[n + 1] ?? lines.length;
      const close = lines.findIndex((line, i) => i > start && i < next && /^  (\}\)|\));\s*$/.test(line));
      const body = lines.slice(start, close === -1 ? next : close + 1).join("\n");
      const head = lines[start].trim().match(/^app\.\w+\("[^"]+"/)?.[0] ?? lines[start].trim();
      return { head, body };
    });
  }

  it("finds the storage-backed handlers", () => {
    const withStorage = handlerBlocks().filter((b) => /\bstorage\.[a-zA-Z]+\(/.test(b.body));
    expect(withStorage.length).toBeGreaterThanOrEqual(10);
  });

  it("each one calls sendStorageUnavailable, except the listed degrading reads", () => {
    const missing = handlerBlocks()
      .filter((b) => /\bstorage\.[a-zA-Z]+\(/.test(b.body) && /\bcatch\b/.test(b.body))
      .filter((b) => !DEGRADES.has(b.head))
      .filter((b) => !b.body.includes("sendStorageUnavailable(res,"))
      .map((b) => b.head);
    expect(missing).toEqual([]);
  });

  it("the degrading reads still exist (the allowlist has no stale entries)", () => {
    const heads = new Set(handlerBlocks().map((b) => b.head));
    for (const head of Array.from(DEGRADES)) expect(heads.has(head), head).toBe(true);
  });
});

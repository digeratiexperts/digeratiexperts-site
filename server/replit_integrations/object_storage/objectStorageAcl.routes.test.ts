import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const canAccessObjectEntity = vi.fn();
const getObjectEntityFile = vi.fn();
const downloadObject = vi.fn();

vi.mock("./objectStorage", () => {
  class ObjectNotFoundError extends Error {
    constructor() {
      super("Object not found");
      this.name = "ObjectNotFoundError";
    }
  }
  return {
    ObjectNotFoundError,
    ObjectStorageService: class {
      getObjectEntityFile = getObjectEntityFile;
      canAccessObjectEntity = canAccessObjectEntity;
      downloadObject = downloadObject;
      getObjectEntityUploadURL = vi.fn();
      normalizeObjectEntityPath = vi.fn();
    },
  };
});

describe("object storage serve ACL", () => {
  let server: Server;
  let baseUrl = "";
  let currentUser: { userId: string; role: string; clientId: string | null };
  let tenantOwnerByPath: Record<string, string | null>;

  beforeAll(async () => {
    const { registerObjectStorageRoutes } = await import("./routes");

    currentUser = { userId: "user-b", role: "user", clientId: "client-b" };
    tenantOwnerByPath = {};

    const app = express();
    const auth: express.RequestHandler = (req, _res, next) => {
      (req as any).userId = currentUser.userId;
      (req as any).user = {
        id: currentUser.userId,
        role: currentUser.role,
        clientId: currentUser.clientId,
      };
      next();
    };
    const admin: express.RequestHandler = (_req, res) => {
      res.status(403).json({ error: "Admin access required" });
    };

    registerObjectStorageRoutes(app, {
      auth,
      admin,
      resolveTenantOwnerClientId: async (objectPath) =>
        tenantOwnerByPath[objectPath] ?? null,
    });

    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    canAccessObjectEntity.mockReset();
    getObjectEntityFile.mockReset();
    downloadObject.mockReset();
    getObjectEntityFile.mockResolvedValue({ name: "uploads/secret.pdf" });
    canAccessObjectEntity.mockResolvedValue(false);
    downloadObject.mockImplementation(async (_file, res) => {
      res.status(200).send("PII-BYTES");
    });
    currentUser = { userId: "user-b", role: "user", clientId: "client-b" };
    tenantOwnerByPath = {
      "/objects/uploads/secret.pdf": "client-a",
    };
  });

  it("denies one authenticated client retrieving another client's object", async () => {
    const response = await fetch(`${baseUrl}/objects/uploads/secret.pdf`);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Access denied" });
    expect(downloadObject).not.toHaveBeenCalled();
  });

  it("allows the owning tenant to read its object", async () => {
    currentUser = { userId: "user-a", role: "user", clientId: "client-a" };
    const response = await fetch(`${baseUrl}/objects/uploads/secret.pdf`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("PII-BYTES");
    expect(downloadObject).toHaveBeenCalledOnce();
  });

  it("allows DE admin to read any object", async () => {
    currentUser = { userId: "admin-1", role: "admin", clientId: null };
    const response = await fetch(`${baseUrl}/objects/uploads/secret.pdf`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("PII-BYTES");
  });
});

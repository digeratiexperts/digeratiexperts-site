import { once } from "node:events";
import type { Server } from "node:http";
import { Readable } from "node:stream";
import express, { type RequestHandler } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { canPortalUserDownloadTenantObject } from "../../portalObjectStorageAuthorization";
import {
  isLegacyObjectStorageEnabled,
  LEGACY_OBJECT_UPLOAD_MAX_BYTES,
  ObjectStorageService,
  registerObjectStorageRoutes,
} from "./index";

describe("legacy object storage release flag", () => {
  it("defaults off in production and requires an explicit opt-in", () => {
    expect(isLegacyObjectStorageEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isLegacyObjectStorageEnabled({ NODE_ENV: "staging" })).toBe(false);
    expect(isLegacyObjectStorageEnabled({
      NODE_ENV: "production",
      LEGACY_OBJECT_STORAGE_ENABLED: "true",
    })).toBe(true);
  });

  it("preserves the authenticated compatibility path outside production", () => {
    expect(isLegacyObjectStorageEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isLegacyObjectStorageEnabled({ NODE_ENV: "test" })).toBe(true);
  });

  it("registers no legacy endpoints when the release flag is disabled", async () => {
    const app = express();
    const middleware = vi.fn((_req, _res, next) => next());
    registerObjectStorageRoutes(app, {
      enabled: isLegacyObjectStorageEnabled({ NODE_ENV: "production" }),
      authenticate: middleware,
      authorizeUpload: middleware,
      authorizeDownload: async () => true,
    });

    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/uploads/request-url`, {
        method: "POST",
      });
      expect(response.status).toBe(404);
      expect(middleware).not.toHaveBeenCalled();
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});

describe("legacy object storage download response", () => {
  it("does not replace a forced attachment policy with uploaded MIME metadata", async () => {
    const app = express();
    const service = new ObjectStorageService();
    const payload = "<script>alert('stored-xss')</script>";
    const file = {
      getMetadata: async () => [{
        contentType: "text/html",
        size: String(Buffer.byteLength(payload)),
        metadata: {},
      }],
      createReadStream: () => Readable.from([payload]),
    };
    app.get("/download", async (_req, res) => {
      res.set({
        "Cache-Control": "private, no-store",
        "Content-Disposition": "attachment",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "Content-Type": "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      await service.downloadObject(file as any, res);
    });

    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/download`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/octet-stream");
      expect(response.headers.get("content-disposition")).toBe("attachment");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.text()).toBe(payload);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});

describe("legacy object storage route authorization", () => {
  let server: Server;
  let baseUrl: string;
  const downloadObject = vi.fn(async (_file, res) => {
    res.status(200).json({ downloaded: true });
  });
  const getObjectEntityFile = vi.fn(async () => ({ name: "uploads/tenant-a-file" }));
  const getObjectEntityUploadURL = vi.fn(async () => (
    "https://storage.googleapis.com/private/uploads/new-file?signature=test"
  ));
  const normalizeObjectEntityPath = vi.fn(() => "/objects/uploads/new-file");
  const listTenantFiles = vi.fn(async (clientId: string) => (
    clientId === "tenant-a"
      ? [{ fileUrl: "/objects/uploads/tenant-a-file" }]
      : [{ fileUrl: "/objects/uploads/tenant-b-file" }]
  ));

  beforeAll(async () => {
    const app = express();
    app.use(express.json());

    const authenticate: RequestHandler = (req, res, next) => {
      const userId = req.get("x-test-user-id");
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      (req as any).user = {
        id: userId,
        role: req.get("x-test-role") || "user",
        orgRole: req.get("x-test-org-role") || "staff",
        clientId: req.get("x-test-client-id") || null,
        isCompanyItContact: req.get("x-test-company-it") === "true",
        impersonatingCompanyId: req.get("x-test-impersonating-client-id") || null,
      };
      next();
    };

    const authorizeUpload: RequestHandler = (req, res, next) => {
      if ((req as any).user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      next();
    };

    registerObjectStorageRoutes(app, {
      enabled: true,
      authenticate,
      authorizeUpload,
      authorizeDownload: (req, objectPath) => canPortalUserDownloadTenantObject({
        user: (req as any).user,
        objectPath,
        listTenantFiles,
      }),
      service: {
        downloadObject: downloadObject as any,
        getObjectEntityFile: getObjectEntityFile as any,
        getObjectEntityUploadURL,
        normalizeObjectEntityPath,
      },
    });

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    downloadObject.mockClear();
    getObjectEntityFile.mockClear();
    getObjectEntityUploadURL.mockClear();
    normalizeObjectEntityPath.mockClear();
    listTenantFiles.mockClear();
  });

  afterAll(async () => {
    if (!server) return;
    server.close();
    await once(server, "close");
  });

  it.each([
    ["upload URL", "/api/uploads/request-url", "POST"],
    ["download", "/objects/uploads/tenant-a-file", "GET"],
  ])("denies an unauthenticated %s request", async (_label, path, method) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST"
        ? JSON.stringify({ name: "agent.msi", size: 100, contentType: "application/octet-stream" })
        : undefined,
    });

    expect(response.status).toBe(401);
  });

  it("does not disclose another tenant's object", async () => {
    const response = await fetch(`${baseUrl}/objects/uploads/tenant-a-file`, {
      headers: {
        "x-test-user-id": "user-b",
        "x-test-client-id": "tenant-b",
        "x-test-org-role": "company_it_contact",
      },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Object not found" });
    expect(listTenantFiles).toHaveBeenCalledWith("tenant-b");
    expect(getObjectEntityFile).not.toHaveBeenCalled();
    expect(downloadObject).not.toHaveBeenCalled();
  });

  it("restricts an impersonating administrator to the selected tenant", async () => {
    const response = await fetch(`${baseUrl}/objects/uploads/tenant-a-file`, {
      headers: {
        "x-test-user-id": "admin-1",
        "x-test-role": "admin",
        "x-test-client-id": "tenant-a",
        "x-test-impersonating-client-id": "tenant-b",
      },
    });

    expect(response.status).toBe(404);
    expect(listTenantFiles).toHaveBeenCalledWith("tenant-b");
    expect(getObjectEntityFile).not.toHaveBeenCalled();
  });

  it("does not issue upload URLs to a non-administrator", async () => {
    const response = await fetch(`${baseUrl}/api/uploads/request-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": "user-a",
        "x-test-client-id": "tenant-a",
      },
      body: JSON.stringify({
        name: "agent.msi",
        size: 100,
        contentType: "application/octet-stream",
      }),
    });

    expect(response.status).toBe(403);
    expect(getObjectEntityUploadURL).not.toHaveBeenCalled();
  });

  it.each(["staff", "manager"])(
    "does not let a %s bypass the client-wide files role gate with a known object path",
    async (orgRole) => {
      const response = await fetch(`${baseUrl}/objects/uploads/tenant-a-file`, {
        headers: {
          "x-test-user-id": `${orgRole}-a`,
          "x-test-client-id": "tenant-a",
          "x-test-org-role": orgRole,
        },
      });

      expect(response.status).toBe(404);
      expect(listTenantFiles).not.toHaveBeenCalled();
      expect(getObjectEntityFile).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["path-like name", { name: "../agent.msi", size: 100, contentType: "application/octet-stream" }],
    ["zero size", { name: "agent.msi", size: 0, contentType: "application/octet-stream" }],
    ["oversized file", { name: "agent.msi", size: LEGACY_OBJECT_UPLOAD_MAX_BYTES + 1, contentType: "application/octet-stream" }],
    ["HTML metadata", { name: "agent.html", size: 100, contentType: "text/html" }],
    ["SVG metadata", { name: "logo.svg", size: 100, contentType: "image/svg+xml" }],
  ])("rejects unsafe upload metadata: %s", async (_label, body) => {
    const response = await fetch(`${baseUrl}/api/uploads/request-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": "admin-1",
        "x-test-role": "admin",
      },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
    expect(getObjectEntityUploadURL).not.toHaveBeenCalled();
  });

  it("issues a URL only after safe upload metadata is validated", async () => {
    const response = await fetch(`${baseUrl}/api/uploads/request-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": "admin-1",
        "x-test-role": "admin",
      },
      body: JSON.stringify({
        name: "tenant-agent.msi",
        size: 4096,
        contentType: "application/x-msi",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      objectPath: "/objects/uploads/new-file",
      metadata: {
        name: "tenant-agent.msi",
        size: 4096,
        contentType: "application/x-msi",
      },
    });
    expect(getObjectEntityUploadURL).toHaveBeenCalledTimes(1);
  });

  it("allows a non-impersonating Digerati admin without a tenant metadata lookup", async () => {
    const response = await fetch(`${baseUrl}/objects/uploads/tenant-a-file`, {
      headers: {
        "x-test-user-id": "admin-1",
        "x-test-role": "admin",
      },
    });

    expect(response.status).toBe(200);
    expect(listTenantFiles).not.toHaveBeenCalled();
    expect(getObjectEntityFile).toHaveBeenCalledWith("/objects/uploads/tenant-a-file");
    expect(downloadObject).toHaveBeenCalledTimes(1);
  });

  it("allows a live company IT flag even when the stored org role is staff", async () => {
    const response = await fetch(`${baseUrl}/objects/uploads/tenant-a-file`, {
      headers: {
        "x-test-user-id": "company-it-a",
        "x-test-client-id": "tenant-a",
        "x-test-org-role": "staff",
        "x-test-company-it": "true",
      },
    });

    expect(response.status).toBe(200);
    expect(listTenantFiles).toHaveBeenCalledWith("tenant-a");
    expect(getObjectEntityFile).toHaveBeenCalledWith("/objects/uploads/tenant-a-file");
    expect(downloadObject).toHaveBeenCalledTimes(1);
  });

  it.each(["dept_it_contact", "company_it_contact"])(
    "allows an authenticated %s to download its tenant's registered object",
    async (orgRole) => {
    const response = await fetch(`${baseUrl}/objects/uploads/tenant-a-file`, {
      headers: {
        "x-test-user-id": "user-a",
        "x-test-client-id": "tenant-a",
        "x-test-org-role": orgRole,
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^application\/octet-stream(?:;|$)/);
    expect(response.headers.get("content-disposition")).toBe("attachment");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    await expect(response.json()).resolves.toEqual({ downloaded: true });
    expect(listTenantFiles).toHaveBeenCalledWith("tenant-a");
    expect(getObjectEntityFile).toHaveBeenCalledWith("/objects/uploads/tenant-a-file");
    expect(downloadObject).toHaveBeenCalledTimes(1);
    },
  );
});

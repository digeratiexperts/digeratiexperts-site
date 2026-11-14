import { once } from "node:events";
import type { Server } from "node:http";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const fetchHubContractDownload = vi.hoisted(() => vi.fn());

vi.mock("./integrations/techSalesClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("./integrations/techSalesClient")>(),
  fetchHubContractDownload,
}));

vi.mock("./replit_integrations/object_storage", () => ({
  registerObjectStorageRoutes: vi.fn(),
  isLegacyObjectStorageEnabled: vi.fn(() => false),
  ObjectStorageService: class ObjectStorageService {},
}));

describe("portal contract download HTTP policy", () => {
  let server: Server;
  let baseUrl: string;
  let cookie = "";
  const originalEnv = new Map<string, string | undefined>();
  const isolatedEnvironmentKeys = [
    "DATABASE_URL",
    "TURNSTILE_SECRET_KEY",
    "ZOHO_CLIENT_ID",
    "ZOHO_CLIENT_ID_API",
    "ZOHO_CLIENT_SECRET",
    "ZOHO_CLIENT_SECRET_API",
    "ZOHO_REFRESH_TOKEN",
    "ZOHO_PAYMENTS_ACCOUNT_ID",
    "ZOHO_PAYMENTS_CLIENT_ID",
    "ZOHO_PAYMENTS_CLIENT_SECRET",
    "ZOHO_PAYMENTS_REFRESH_TOKEN",
    "TECHSALES_SYNC_URL",
    "TECHSALES_SYNC_TOKEN",
    "PORTAL_ENABLE_DEMO_DATA",
    "PORTAL_DEMO_PASSWORD_HASH",
  ];

  beforeAll(async () => {
    for (const key of isolatedEnvironmentKeys) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
    originalEnv.set("NODE_ENV", process.env.NODE_ENV);
    process.env.NODE_ENV = "test";

    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    const [{ registerRoutes }, portalAuth] = await Promise.all([
      import("./routes"),
      import("./portalAuthStore"),
    ]);
    await registerRoutes(app);

    const password = await bcrypt.hash("ContractDownload!42", 4);
    portalAuth.setClient({
      id: "contract-download-client",
      companyName: "Contract Download Company",
      contactEmail: "company-it@contract-download.test",
      contactPhone: null,
      industry: "Testing",
      primaryContact: "Company IT",
      status: "active",
      type: "client",
      serviceType: "managed",
      createdAt: new Date(),
    });
    portalAuth.setUser({
      id: "contract-download-user",
      email: "company-it@contract-download.test",
      username: "contract-download-user",
      password,
      role: "user",
      storeRole: "managed",
      fullName: "Contract Download User",
      clientId: "contract-download-client",
      orgRole: "company_it_contact",
      isCompanyItContact: true,
      emailVerified: true,
      isActive: true,
      createdAt: new Date(),
    });

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const login = await fetch(`${baseUrl}/api/portal/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({
        email: "company-it@contract-download.test",
        password: "ContractDownload!42",
      }),
    });
    expect(login.status).toBe(200);
    const headers = login.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = headers.getSetCookie?.()
      ?? (headers.get("set-cookie") || "")
        .split(/,(?=\s*(?:portalSession|portalAuth)=)/i)
        .filter(Boolean);
    cookie = setCookies
      .map((value) => value.split(";", 1)[0])
      .filter((value) => /^(?:portalSession|portalAuth)=/i.test(value))
      .join("; ");
    expect(cookie).toContain("portalSession=");
  }, 30_000);

  beforeEach(() => {
    fetchHubContractDownload.mockReset();
  });

  afterAll(async () => {
    if (server) {
      server.close();
      await once(server, "close");
    }
    for (const key of [...isolatedEnvironmentKeys, "NODE_ENV"]) {
      const value = originalEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.restoreAllMocks();
  });

  it("requires portal authentication before contacting the document hub", async () => {
    const response = await fetch(`${baseUrl}/api/portal/contracts/123/download`);

    expect(response.status).toBe(401);
    expect(fetchHubContractDownload).not.toHaveBeenCalled();
  });

  it("downloads a PDF response as a non-executable attachment", async () => {
    const pdf = Buffer.from("%PDF-1.7\ncontract body");
    fetchHubContractDownload.mockResolvedValue({
      buffer: pdf,
      contentType: "text/html; charset=utf-8",
      fileName: `..\\agreement\r\nX-Injected: yes.html`,
    });

    const response = await fetch(`${baseUrl}/api/portal/contracts/123/download`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(200);
    expect(fetchHubContractDownload).toHaveBeenCalledWith(
      123,
      "Contract Download Company",
      "signed_pdf",
      null,
    );
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="agreement_X-Injected_yes.html.pdf"',
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf);
  });

  it("rejects active content returned by the trusted hub without reflecting details", async () => {
    fetchHubContractDownload.mockResolvedValue({
      buffer: Buffer.from("<html><script>alert(document.cookie)</script></html>"),
      contentType: "text/html",
      fileName: "contract.html",
    });

    const response = await fetch(`${baseUrl}/api/portal/contracts/123/download`, {
      headers: { Cookie: cookie },
    });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ message: "Document not available" });
    expect(JSON.stringify(body)).not.toContain("script");
    expect(response.headers.get("content-disposition")).toBeNull();
  });
});

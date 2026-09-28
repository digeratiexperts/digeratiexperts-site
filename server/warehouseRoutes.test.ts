import express from "express";
import cookieParser from "cookie-parser";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-warehouse-routes";

vi.mock("./portalAuthStore", async () => {
  const actual = await vi.importActual<typeof import("./portalAuthStore")>("./portalAuthStore");
  return { ...actual, getUser: vi.fn() };
});

vi.mock("./portalOrg", async () => {
  const actual = await vi.importActual<typeof import("./portalOrg")>("./portalOrg");
  return { ...actual, findUserById: vi.fn() };
});

const STORE_PREVIEW_COOKIE = "de_store_preview";

function sign(claims: Record<string, unknown>) {
  return jwt.sign(claims, process.env.JWT_SECRET as string, { expiresIn: "1h" });
}

describe("warehouse HTTP gates", () => {
  let server: Server;
  let baseUrl = "";
  let getUser: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const { registerWarehouseGates } = await import("./warehouseRoutes");
    const { getUser: mockedGetUser } = await import("./portalAuthStore");
    getUser = mockedGetUser as ReturnType<typeof vi.fn>;

    const app = express();
    app.use(cookieParser());
    registerWarehouseGates(app);
    app.get("/store", (_req, res) => res.status(200).send("PUBLIC_STORE"));
    app.get("/store/solution", (_req, res) => res.status(200).send("PUBLIC_WORKSPACE"));
    app.get("/api/store/solutions/current", (_req, res) => res.json({ leaked: true }));
    app.get("/internal/warehouse", (_req, res) => res.status(200).send("WAREHOUSE_OK"));
    app.get("/internal/warehouse/product/:sku", (_req, res) => res.status(200).send("WAREHOUSE_PDP"));

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
    getUser.mockReset();
  });

  it("serves the curated public Store without exposing a warehouse Location", async () => {
    const response = await fetch(`${baseUrl}/store`, { redirect: "manual" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("PUBLIC_STORE");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("location") || "").not.toContain("/internal");
  });

  it("returns the same generic 404 for unknown and staff-only SKUs", async () => {
    const unknown = await fetch(`${baseUrl}/store/product/not-a-real-sku`, { redirect: "manual" });
    const staffSku = await fetch(`${baseUrl}/store/product/DE-SVC-CM-ENDPOINT-EDR-MO`, {
      redirect: "manual",
    });
    expect(unknown.status).toBe(404);
    expect(staffSku.status).toBe(404);
    expect(unknown.headers.get("location")).toBeNull();
    expect(staffSku.headers.get("location")).toBeNull();
    const unknownBody = await unknown.text();
    const staffBody = await staffSku.text();
    expect(unknownBody).toBe(staffBody);
    expect(unknownBody.toLowerCase()).not.toContain("sku");
    expect(unknownBody.toLowerCase()).not.toContain("warehouse");
    expect(unknownBody.toLowerCase()).not.toContain("ninjaone");
  });

  it("denies warehouse HTML and catalog APIs without revealing existence", async () => {
    const html = await fetch(`${baseUrl}/internal/warehouse`, { redirect: "manual" });
    expect(html.status).toBe(404);
    expect(html.headers.get("location")).toBeNull();
    expect(await html.text()).not.toContain("WAREHOUSE_OK");

    const api = await fetch(`${baseUrl}/api/store/solutions/current?sessionId=abc`);
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual({ error: "Not found" });
  });

  it("lets a live admin open the warehouse and catalog APIs", async () => {
    getUser.mockReturnValue({
      id: "a1",
      email: "admin@digeratiexperts.com",
      role: "admin",
      isActive: true,
    });
    const token = sign({ userId: "a1", email: "admin@digeratiexperts.com" });
    const headers = { cookie: `portalAuth=${token}` };

    const html = await fetch(`${baseUrl}/internal/warehouse`, { headers, redirect: "manual" });
    expect(html.status).toBe(200);
    expect(await html.text()).toBe("WAREHOUSE_OK");

    const destage = await fetch(`${baseUrl}/store/co-managed`, { headers, redirect: "manual" });
    expect(destage.status).toBe(302);
    expect(destage.headers.get("location")).toBe("/internal/warehouse/co-managed");

    const api = await fetch(`${baseUrl}/api/store/solutions/current?sessionId=abc`, { headers });
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual({ leaked: true });
  });

  describe("the staff preview of the public Store (source of truth §16.10)", () => {
    const admin = () => {
      getUser.mockReturnValue({ id: "a1", email: "admin@digeratiexperts.com", role: "admin", isActive: true });
      return `portalAuth=${sign({ userId: "a1", email: "admin@digeratiexperts.com" })}`;
    };
    const get = (path: string, cookie?: string) =>
      fetch(`${baseUrl}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });

    it("sends signed-in staff to the warehouse by default, as before", async () => {
      const response = await get("/store/solution", admin());
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toMatch(/^\/internal\/warehouse/);
    });

    it("lets staff opt into the buyer's view with ?as=buyer and keeps them there", async () => {
      const auth = admin();
      const opt = await get("/store/solution?as=buyer&x=1", auth);
      expect(opt.status).toBe(302);
      expect(opt.headers.get("location")).toBe("/store/solution?x=1");
      const setCookie = opt.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain(`${STORE_PREVIEW_COOKIE}=1`);
      expect(setCookie.toLowerCase()).toContain("httponly");

      const previewing = `${auth}; ${STORE_PREVIEW_COOKIE}=1`;
      const view = await get("/store/solution", previewing);
      expect(view.status).toBe(200);
      expect(await view.text()).toBe("PUBLIC_WORKSPACE");
      // A buyer's 404 stays a buyer's 404: the preview grants nothing a buyer lacks.
      const staffOnly = await get("/store/product/DE-SVC-CM-ENDPOINT-EDR-MO", previewing);
      expect(staffOnly.status).toBe(404);
      expect(staffOnly.headers.get("location")).toBeNull();
    });

    it("returns staff to the warehouse and clears the cookie with ?as=staff", async () => {
      const back = await get("/store?as=staff", `${admin()}; ${STORE_PREVIEW_COOKIE}=1`);
      expect(back.status).toBe(302);
      expect(back.headers.get("location")).toBe("/internal/warehouse");
      expect(back.headers.get("set-cookie") ?? "").toMatch(new RegExp(`${STORE_PREVIEW_COOKIE}=;`));
    });

    it("changes nothing for a buyer, whatever the cookie or toggle says", async () => {
      for (const [path, cookie] of [["/store", undefined], ["/store?as=buyer", undefined], ["/store", `${STORE_PREVIEW_COOKIE}=1`]] as const) {
        const response = await get(path, cookie);
        expect(response.status, path).toBe(200);
        expect(response.headers.get("set-cookie"), path).toBeNull();
        expect(response.headers.get("location"), path).toBeNull();
      }
    });
  });
});

import express from "express";
import { readFileSync } from "fs";
import path from "path";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LEGACY_AUTH_RETIRED_PATHS, registerRetiredLegacyAuthRoutes } from "./legacyAuthRetired";

/**
 * #236: the legacy generic register/login minted a JWT with a caller-chosen
 * email for a second identity model. End to end, neither path may hand out a
 * token any more, whatever the body says.
 */
describe("retired legacy /api/auth register and login (#236)", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerRetiredLegacyAuthRoutes(app);
    app.use((_req, res) => res.status(404).json({ error: "not found" }));
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const post = (p: string, body: unknown) =>
    fetch(baseUrl + p, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("retires exactly register and login", () => {
    expect([...LEGACY_AUTH_RETIRED_PATHS]).toEqual(["/api/auth/register", "/api/auth/login"]);
  });

  it("register with another account's email answers 410 and mints no token", async () => {
    const res = await post("/api/auth/register", {
      username: "attacker",
      email: "admin@example.com",
      password: "long-enough-password",
    });
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.token).toBeUndefined();
    expect(body.user).toBeUndefined();
  });

  it("login answers 410 and mints no token", async () => {
    const res = await post("/api/auth/login", { email: "admin@example.com", password: "x" });
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.token).toBeUndefined();
  });

  it("routes.ts mounts the retired handlers and defines no live legacy register/login", () => {
    const src = readFileSync(path.join(__dirname, "routes.ts"), "utf8");
    expect(src).toContain("registerRetiredLegacyAuthRoutes(app)");
    expect(src).not.toMatch(/app\.post\(\s*["']\/api\/auth\/(register|login)["']/);
  });
});

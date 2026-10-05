import express from "express";
import { readFileSync } from "fs";
import path from "path";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  isRetiredLegacyGenericPath,
  LEGACY_GENERIC_RETIRED_PREFIXES,
  registerRetiredLegacyGenericRoutes,
} from "./legacyGenericRetired";

/**
 * #232: the legacy generic data routes and /api/chat are removed. Every method
 * on them, and below them, answers 410; neighbouring live paths are untouched.
 */
describe("retired legacy generic data and chat APIs (#232)", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerRetiredLegacyGenericRoutes(app);
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

  it("retires exactly the generic data routes and /api/chat", () => {
    expect([...LEGACY_GENERIC_RETIRED_PREFIXES]).toEqual([
      "/api/workspaces",
      "/api/projects",
      "/api/boards",
      "/api/tasks",
      "/api/labels",
      "/api/comments",
      "/api/chat",
    ]);
  });

  it.each([
    ["GET", "/api/workspaces"],
    ["POST", "/api/workspaces"],
    ["GET", "/api/workspaces/ws-1"],
    ["GET", "/api/projects?workspaceId=ws-1"],
    ["POST", "/api/boards"],
    ["PATCH", "/api/tasks/t-1"],
    ["DELETE", "/api/tasks/t-1"],
    ["POST", "/api/labels"],
    ["DELETE", "/api/comments/c-1"],
    ["GET", "/api/chat?ticketId=1"],
    ["POST", "/api/chat"],
  ])("%s %s answers 410", async (method, p) => {
    const res = await fetch(baseUrl + p, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify({ ticketId: "1", content: "hi" }),
    });
    expect(res.status).toBe(410);
  });

  it("leaves the live chat endpoints and look-alike paths alone", async () => {
    for (const p of ["/api/portal/chat/messages", "/api/portal/desk-chats", "/api/public/advisor/chat", "/api/chatbot", "/api/tasksync"]) {
      expect(isRetiredLegacyGenericPath(p)).toBe(false);
      expect((await fetch(baseUrl + p)).status).toBe(404);
    }
  });

  it("routes.ts mounts the retirement and defines none of the retired handlers", () => {
    const src = readFileSync(path.join(__dirname, "routes.ts"), "utf8");
    expect(src).toContain("registerRetiredLegacyGenericRoutes(app)");
    expect(src).not.toMatch(
      /app\.(get|post|put|patch|delete|all)\(\s*["'`]\/api\/(workspaces|projects|boards|tasks|labels|comments|chat)(["'`/?])/,
    );
  });
});

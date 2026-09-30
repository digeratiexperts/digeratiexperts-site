import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isVersionPreviewPath, registerVersionPreviewRobots } from "./versionPreviewRobots";

/**
 * The defect this guards: /version-4 rendered the preview while the served HTML
 * carried the shell's default "index, follow", because VersionFrame's noindex
 * only exists after hydration. Asserted over real HTTP rather than by reading
 * the matcher, since the header has to survive whichever handler responds.
 */
describe("version preview robots header", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    registerVersionPreviewRobots(app);

    // Stand-ins for the real handlers: the SPA catch-all that serves every
    // version preview, and an ordinary marketing route that must stay indexable.
    app.get("/pricing", (_req, res) => res.status(200).send("PRICING"));
    app.get("/", (_req, res) => res.status(200).send("HOME"));
    app.use((_req, res) => res.status(200).send("<div id=\"root\"></div>"));

    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  for (const n of [1, 2, 3, 4]) {
    it(`/version-${n} returns 200 and is noindex at the header level`, async () => {
      const response = await fetch(`${baseUrl}/version-${n}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
    });
  }

  it("covers the /versions archive index and trailing-slash and case variants", async () => {
    for (const path of ["/versions", "/version-4/", "/Version-4"]) {
      const response = await fetch(`${baseUrl}${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
    }
  });

  it("does not leak the header onto ordinary marketing routes", async () => {
    for (const path of ["/", "/pricing"]) {
      const response = await fetch(`${baseUrl}${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toBeNull();
    }
  });

  it("matches only the preview paths", () => {
    for (const path of ["/versions", "/version-1", "/version-12", "/version-4/", "/Version-4"]) {
      expect(isVersionPreviewPath(path)).toBe(true);
    }
    // Nothing that merely starts with the same letters, and no marketing route.
    for (const path of ["/", "/pricing", "/version-4/extra", "/versioning", "/store"]) {
      expect(isVersionPreviewPath(path)).toBe(false);
    }
  });
});

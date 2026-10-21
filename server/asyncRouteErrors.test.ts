import "express-async-errors";
import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Regression: an async route that throws must reach the error middleware and
// get a response. Without express-async-errors, Express 4 never answers and
// the request hangs until the client gives up.
describe("async route errors", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.get("/boom", async () => {
      throw new Error("db down");
    });
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ handled: err?.message });
    });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("routes a rejected async handler to the error middleware (not a hang)", async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${baseUrl}/boom`, { signal: controller.signal });
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ handled: "db down" });
    } finally {
      clearTimeout(timer);
    }
  });
});

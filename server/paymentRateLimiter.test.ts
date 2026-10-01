import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPaymentRateLimiter } from "./middleware/rateLimiter";

describe("paymentRateLimiter", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const limiter = createPaymentRateLimiter({
      windowMs: 60 * 60 * 1000,
      max: 2,
      message: "Too many payment attempts, please try again later",
    });

    const app = express();
    app.post("/api/portal/payment/zoho", limiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });
    // Read/status endpoints must stay outside the payment limiter.
    app.get("/api/payments/availability", (_req, res) => {
      res.status(200).json({ available: true });
    });
    app.get("/api/store/payment-status", (_req, res) => {
      res.status(200).json({ status: "ok" });
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

  it("returns 429 on the payment mutation after the threshold", async () => {
    const first = await fetch(`${baseUrl}/api/portal/payment/zoho`, { method: "POST" });
    const second = await fetch(`${baseUrl}/api/portal/payment/zoho`, { method: "POST" });
    const third = await fetch(`${baseUrl}/api/portal/payment/zoho`, { method: "POST" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(await third.text()).toBe("Too many payment attempts, please try again later");
  });

  it("does not throttle harmless payment read/status endpoints", async () => {
    const availability = await fetch(`${baseUrl}/api/payments/availability`);
    const status = await fetch(`${baseUrl}/api/store/payment-status`);
    expect(availability.status).toBe(200);
    expect(status.status).toBe(200);
    expect(await availability.json()).toEqual({ available: true });
    expect(await status.json()).toEqual({ status: "ok" });
  });
});

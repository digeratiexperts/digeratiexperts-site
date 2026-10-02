import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerCampaignAliasRedirects } from "./campaignAliasRedirects";

/**
 * Until 2026-10-01 /ads/<slug> and /lp/<slug> answered HTTP 404, and the
 * browser-side redirect that followed dropped the query string.
 */
describe("campaign alias redirects", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    registerCampaignAliasRedirects(app);
    app.use((_req, res) => res.status(404).send("not found"));
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const get = (p: string) => fetch(baseUrl + p, { redirect: "manual" });

  it("forwards an ad link to its campaign with the query string intact", async () => {
    const res = await get("/ads/managed-it?utm_source=google&utm_campaign=phx&gclid=abc123");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/go/managed-it?utm_source=google&utm_campaign=phx&gclid=abc123");
  });

  it("forwards a legacy /lp link the same way", async () => {
    const res = await get("/lp/cyber-risk-assessment");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/go/cyber-risk-assessment");
  });

  it("matches the campaign slug in any case", async () => {
    const res = await get("/ads/Managed-IT");
    expect(res.headers.get("location")).toBe("/go/managed-it");
  });

  it("leaves an unknown campaign to the 404", async () => {
    const res = await get("/ads/not-a-campaign?gclid=x");
    expect(res.status).toBe(404);
  });
});

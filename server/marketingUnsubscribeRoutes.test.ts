import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";
import { sendMarketingEmail, unsubscribeToken, type OptOutStore } from "./marketingEmail";
import { registerMarketingUnsubscribeRoutes, UNSUBSCRIBE_PATH } from "./marketingUnsubscribeRoutes";

const ENV = {
  MARKETING_EMAIL_ENABLED: "true",
  BUSINESS_POSTAL_ADDRESS: "PO Box 0000, Example City, ZZ 00000",
  MARKETING_UNSUBSCRIBE_SECRET: "route-secret",
};

const rows = new Map<string, string>();
let failWrites = false;
const store: OptOutStore = {
  async has(email) {
    return rows.has(email);
  },
  async add(email, source) {
    if (failWrites) throw new Error("db down");
    rows.set(email, source);
  },
};

describe("marketing unsubscribe endpoint", () => {
  let server: Server;
  let base = "";

  beforeAll(async () => {
    vi.spyOn(logger, "info").mockImplementation(() => {});
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.spyOn(logger, "error").mockImplementation(() => {});
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    registerMarketingUnsubscribeRoutes(app, { store, env: ENV });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test port");
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    rows.clear();
    failWrites = false;
  });

  const url = (email: string, secret = ENV.MARKETING_UNSUBSCRIBE_SECRET) =>
    `${base}${UNSUBSCRIBE_PATH}?t=${encodeURIComponent(unsubscribeToken(email, secret))}`;

  const oneClick = (target: string) =>
    fetch(target, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    });

  it("GET shows a confirm button and records nothing", async () => {
    const res = await fetch(url("reader@example.com"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form method="post"');
    expect(rows.size).toBe(0);
  });

  it("GET with a bad token says so", async () => {
    expect((await fetch(`${base}${UNSUBSCRIBE_PATH}?t=nope`)).status).toBe(400);
  });

  it("one-click POST records the opt-out", async () => {
    const res = await oneClick(url("reader@example.com"));
    expect(res.status).toBe(200);
    expect(rows.get("reader@example.com")).toBe("one-click");
  });

  it("the page button records the opt-out", async () => {
    const res = await fetch(url("reader@example.com"), { method: "POST" });
    expect(res.status).toBe(200);
    expect(rows.get("reader@example.com")).toBe("unsubscribe-page");
  });

  it("a token signed with another key opts out nobody", async () => {
    const res = await oneClick(url("reader@example.com", "wrong"));
    expect(res.status).toBe(400);
    expect(rows.size).toBe(0);
  });

  it("answers 503 when the opt-out could not be saved", async () => {
    failWrites = true;
    expect((await oneClick(url("reader@example.com"))).status).toBe(503);
  });

  it("after a one-click unsubscribe, the next marketing send to that address is skipped", async () => {
    await oneClick(url("Reader@Example.com"));
    const send = vi.fn(async () => true);
    const result = await sendMarketingEmail(
      { kind: "test", to: "READER@example.com", subject: "s", title: "t", contentHtml: "<p>x</p>", contentText: "x" },
      { env: ENV, store, send },
    );
    expect(result).toEqual({ sent: false, reason: "recipient opted out" });
    expect(send).not.toHaveBeenCalled();
  });
});

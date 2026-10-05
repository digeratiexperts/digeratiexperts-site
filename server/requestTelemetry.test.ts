import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { requestTelemetry, releaseIdentity, routeTemplate, applicationForPath } from "./requestTelemetry";

type Event = Record<string, unknown>;
function harness(statusCode = 200, fail = false) {
  const events: Event[] = [];
  const callbacks: Record<string, () => void> = {};
  const headers: Record<string, string> = {};
  const emit = (event: object) => { if (fail) throw Error("sink unavailable"); events.push(event as Event); };
  const sink = { info: emit, warn: emit, error: emit };
  const res = { statusCode, setHeader: (n: string, v: string) => { headers[n] = v; }, once: (n: string, f: () => void) => { callbacks[n] = f; } };
  return { events, callbacks, headers, sink, res };
}
describe("request telemetry", () => {
  it("classifies only explicit path boundaries without emitting path values", () => {
    for (const p of ["/store", "/store/order/private", "/api/store/quotes/private", "/internal/warehouse", "/api/internal/warehouse/orders", "/api/webhooks/zoho-payments"]) assert.equal(applicationForPath(p), "store");
    for (const p of ["/portal/login", "/api/portal/profile/private"]) assert.equal(applicationForPath(p), "portal");
    for (const p of [undefined, "/", "/storehouse", "/api/portals", "/internal/warehouses"]) assert.equal(applicationForPath(p), "website");
    const h = harness();
    requestTelemetry(h.sink, { environment: "test", release: undefined })({method:"GET", path:"/api/portal/accounts/private?secret"}, h.res, () => {});
    h.callbacks.finish();
    assert.equal(h.events[0].application, "portal");
    assert.ok(!JSON.stringify(h.events).includes("private"));
    assert.ok(!JSON.stringify(h.events).includes("secret"));
  });
  it("omits identifiers, query, headers and body and records once", () => {
    const h = harness(500);
    const req = { method: "GET", route: { path: "/accounts/:id" }, originalUrl: "/accounts/private-id?token=secret", headers: { authorization: "secret" }, body: { password: "secret" } };
    let next = false;
    requestTelemetry(h.sink, { environment: "production", release: "abcdef123" })(req, h.res, () => { next = true; });
    h.callbacks.finish(); h.callbacks.close();
    assert.equal(next, true);
    assert.equal(h.events.length, 1);
    assert.equal(h.events[0].route, "/accounts/:id");
    assert.equal(h.events[0].outcome, "failure");
    assert.equal(h.events[0].requestId, h.headers["X-Request-ID"]);
    assert.ok(!JSON.stringify(h.events).includes("secret"));
    assert.ok(!JSON.stringify(h.events).includes("private-id"));
    assert.ok(Number(h.events[0].durationMs) >= 0);
  });
  it("records disconnects without falsely reporting success", () => {
    const h = harness();
    requestTelemetry(h.sink, { environment: "test", release: undefined })({ method: "GET" }, h.res, () => {});
    h.callbacks.close(); h.callbacks.finish();
    assert.equal(h.events.length, 1);
    assert.equal(h.events[0].outcome, "aborted");
    assert.equal(h.events[0].statusCode, null);
    assert.equal(h.events[0].route, "unmatched");
    assert.equal(h.events[0].release, null);
  });
  it("does not propagate sink failures", () => {
    const h = harness(200, true);
    requestTelemetry(h.sink, { environment: "test", release: undefined })({ method: "GET" }, h.res, () => {});
    assert.doesNotThrow(() => h.callbacks.finish());
  });
  it("rejects malformed route and release metadata", () => {
    for (const value of [undefined, /private/, "/x?secret", "/x#secret", "/x\nsecret"]) assert.equal(routeTemplate(value), "unmatched");
    assert.equal(releaseIdentity("token=secret"), null);
    assert.equal(releaseIdentity("ABCDEF1"), "abcdef1");
  });
});

describe("request telemetry with Express", () => {
  it("returns the generated ID and logs templates rather than request secrets", async () => {
    const events: Event[] = [];
    const emit = (event: object) => { events.push(event as Event); };
    const app = express();
    app.use(requestTelemetry({ info: emit, warn: emit, error: emit }, { environment: "test", release: "abcdef123" }));
    app.use(express.json());
    app.get("/orders/:id", (_req, res) => { res.status(404).json({ error: "not found" }); });
    const server = app.listen(0, "127.0.0.1");
    try {
      await once(server, "listening");
      const address = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${address.port}/orders/private-key?token=secret&email=private@example.com`, { headers: { "x-request-id": "caller-secret", authorization: "Bearer secret" } });
      await response.text();
      assert.equal(response.status, 404);
      assert.equal(events.length, 1);
      assert.equal(events[0].route, "/orders/:id");
      assert.equal(events[0].requestId, response.headers.get("x-request-id"));
      assert.notEqual(events[0].requestId, "caller-secret");
      assert.ok(!JSON.stringify(events).includes("private-key"));
      assert.ok(!JSON.stringify(events).includes("secret"));
      assert.ok(!JSON.stringify(events).includes("@"));
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => { server.close(err => err ? reject(err) : resolve()); });
    }
  });
  it("records parser failures before a route is matched", async () => {
    const events: Event[] = [];
    const emit = (event: object) => { events.push(event as Event); };
    const app = express();
    app.use(requestTelemetry({ info: emit, warn: emit, error: emit }, { environment: "test", release: undefined }));
    app.use(express.json());
    app.post("/orders", (_req, res) => { res.sendStatus(204); });
    app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.sendStatus(err ? 400 : 500); });
    const server = app.listen(0, "127.0.0.1");
    try {
      await once(server, "listening");
      const address = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${address.port}/orders`, {method: "POST", headers: {"content-type": "application/json"}, body: "{invalid-secret"});
      await response.text();
      assert.equal(response.status, 400);
      assert.equal(events.length, 1);
      assert.equal(events[0].route, "unmatched");
      assert.equal(events[0].outcome, "failure");
      assert.ok(!JSON.stringify(events).includes("invalid-secret"));
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => { server.close(err => err ? reject(err) : resolve()); });
    }
  });
});

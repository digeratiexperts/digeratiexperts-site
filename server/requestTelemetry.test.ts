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

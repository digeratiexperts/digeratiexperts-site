import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PORTAL_ORIGIN,
  DESKTOP_NOTIFICATION_EVENTS,
  isAllowedPortalUrl,
  isDownloadAllowed,
  isRendererPermissionAllowed,
  parseDeepLink,
  PORTAL_DESTINATIONS,
  portalUrl,
  resolvePortalOrigin,
} from "./security";

test("production portal origins must use HTTPS", () => {
  assert.equal(resolvePortalOrigin(DEFAULT_PORTAL_ORIGIN, false).origin, DEFAULT_PORTAL_ORIGIN);
  assert.throws(() => resolvePortalOrigin("http://digeratiexperts.com", false));
  assert.throws(() => resolvePortalOrigin("https://user:secret@digeratiexperts.com", false));
});

test("loopback HTTP is allowed only during development", () => {
  assert.equal(resolvePortalOrigin("http://localhost:5000", true).origin, "http://localhost:5000");
  assert.throws(() => resolvePortalOrigin("http://localhost:5000", false));
  assert.throws(() => resolvePortalOrigin("http://192.168.1.10:5000", true));
});

test("portal navigation stays on the configured origin", () => {
  const origin = resolvePortalOrigin(DEFAULT_PORTAL_ORIGIN, false);
  assert.equal(portalUrl(origin, "tickets"), "https://portal.digeratiexperts.com/portal/tickets");
  assert.equal(isAllowedPortalUrl("https://portal.digeratiexperts.com/portal/kb", origin), true);
  assert.equal(isAllowedPortalUrl("https://portal.digeratiexperts.com/api/portal/me", origin), false);
  assert.equal(isAllowedPortalUrl("https://digeratiexperts.com/portal/kb", origin), false);
  assert.equal(isAllowedPortalUrl("https://evil.example/portal/kb", origin), false);
  assert.equal(isAllowedPortalUrl("file:///C:/Windows/System32/calc.exe", origin), false);
});

test("deep links accept only allowlisted portal destinations", () => {
  assert.equal(parseDeepLink("digeratiexperts://open/tickets"), "tickets");
  assert.equal(parseDeepLink("digeratiexperts://open/newTicket"), "newTicket");
  assert.equal(parseDeepLink("digeratiexperts://open/process"), null);
  assert.equal(parseDeepLink("digeratiexperts://open/../../process"), null);
  assert.equal(parseDeepLink("https://portal.digeratiexperts.com/portal"), null);
});

test("desktop notifications use privacy-safe catalog templates", () => {
  for (const notification of Object.values(DESKTOP_NOTIFICATION_EVENTS)) {
    assert.ok(notification.title.length <= 80);
    assert.ok(notification.body.length <= 160);
    assert.ok(Object.hasOwn(PORTAL_DESTINATIONS, notification.destination));
  }
});

test("remote renderer permissions are always denied", () => {
  assert.equal(isRendererPermissionAllowed(), false);
});

test("remote Portal downloads are denied until a signed transfer policy exists", () => {
  assert.equal(isDownloadAllowed(), false);
});

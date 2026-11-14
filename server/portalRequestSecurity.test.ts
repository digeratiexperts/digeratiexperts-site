import { describe, expect, it } from "vitest";
import { validatePortalRequestSecurity } from "./portalRequestSecurity";

const base = {
  method: "POST",
  host: "portal.digeratiexperts.com",
  protocol: "https",
  path: "/api/portal/profile",
  contentType: "application/json",
  contentLength: "24",
  allowedOrigins: new Set([
    "https://portal.digeratiexperts.com",
    "https://digeratiexperts.com",
  ]),
};

describe("portal unsafe request security", () => {
  it("accepts a same-origin portal JSON request", () => {
    expect(
      validatePortalRequestSecurity({
        ...base,
        origin: "https://portal.digeratiexperts.com",
      }),
    ).toEqual({ ok: true });
  });

  it("accepts the configured HTTPS origin when TLS terminates at the reverse proxy", () => {
    expect(
      validatePortalRequestSecurity({
        ...base,
        protocol: "http",
        origin: "https://portal.digeratiexperts.com",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects missing, foreign, and sibling origins", () => {
    expect(validatePortalRequestSecurity(base)).toEqual({
      ok: false,
      reason: "missing_origin",
    });
    expect(
      validatePortalRequestSecurity({ ...base, origin: "https://evil.example" }),
    ).toEqual({ ok: false, reason: "untrusted_origin" });
    expect(
      validatePortalRequestSecurity({
        ...base,
        origin: "https://digeratiexperts.com",
      }),
    ).toEqual({ ok: false, reason: "cross_origin_request" });
  });

  it("rejects form content types on authenticated JSON endpoints", () => {
    expect(
      validatePortalRequestSecurity({
        ...base,
        origin: "https://portal.digeratiexperts.com",
        contentType: "application/x-www-form-urlencoded",
      }),
    ).toEqual({ ok: false, reason: "invalid_content_type" });
  });

  it("allows only the ticket attachment route to send a validated raw MIME body", () => {
    expect(
      validatePortalRequestSecurity({
        ...base,
        origin: "https://portal.digeratiexperts.com",
        path: "/api/portal/tickets/ticket-123/attachments",
        contentType: "image/png",
      }),
    ).toEqual({ ok: true });

    expect(
      validatePortalRequestSecurity({
        ...base,
        origin: "https://portal.digeratiexperts.com",
        path: "/api/portal/tickets/ticket-123/attachments",
        contentType: "application/x-www-form-urlencoded",
      }),
    ).toEqual({ ok: false, reason: "invalid_content_type" });
  });

  it("allows safe methods without an origin header", () => {
    expect(validatePortalRequestSecurity({ ...base, method: "GET" })).toEqual({ ok: true });
  });
});

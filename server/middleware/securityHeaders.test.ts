import { describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { setSecurityHeaders } from "./security";
import { buildContentSecurityPolicy, paymentCspMarketingHosts, reportingEndpointsHeader } from "./cspBuilder";
import { CSP_REPORT_PATH } from "../cspReport";

function run(path: string) {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
    removeHeader: (k: string) => {
      delete headers[k.toLowerCase()];
    },
  } as unknown as Response;
  let nextCalled = false;
  setSecurityHeaders({ path } as Request, res, (() => {
    nextCalled = true;
  }) as NextFunction);
  return { headers, nextCalled };
}

describe("setSecurityHeaders", () => {
  it("turns the legacy XSS auditor off", () => {
    expect(run("/").headers["x-xss-protection"]).toBe("0");
  });

  it("keeps the CSP's framing and plugin locks", () => {
    const { headers, nextCalled } = run("/portal/login");
    expect(nextCalled).toBe(true);
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  });
});

describe("payment page CSP", () => {
  it("drops marketing hosts, reports violations, and omits unsafe-inline in production when a nonce is set", () => {
    const csp = buildContentSecurityPolicy({ isProduction: true, isPaymentPage: true, nonce: "abc123" });
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-abc123'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/);
    expect(csp).toContain(`report-uri ${CSP_REPORT_PATH}`);
    expect(csp).toContain("report-to csp-endpoint");
    expect(csp).toContain("https://payments.zoho.com");
    for (const host of paymentCspMarketingHosts()) {
      expect(csp).not.toContain(host);
    }
    expect(reportingEndpointsHeader()).toContain(CSP_REPORT_PATH);
  });

  it("sets a tighter payment CSP and a reporting header on checkout", () => {
    const { headers } = run("/store/checkout");
    const csp = headers["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(headers["reporting-endpoints"]).toContain(CSP_REPORT_PATH);
    for (const host of paymentCspMarketingHosts()) {
      expect(csp).not.toContain(host);
    }
  });
});


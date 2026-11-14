import { describe, expect, it } from "vitest";
import express from "express";
import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { CSP_REPORT_PATH, registerCspReportRoute, summarizeCspViolation } from "./cspReport";

describe("summarizeCspViolation", () => {
  it("keeps only path, directive and host, never query strings or samples", () => {
    const summary = summarizeCspViolation({
      "csp-report": {
        "document-uri": "https://digeratiexperts.com/store/checkout?token=secret-value",
        "violated-directive": "script-src-elem",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://www.googletagmanager.com/gtag/js?id=G-SECRET",
        disposition: "enforce",
        "script-sample": "gtag('event', 'purchase', {card: '4111111111111111'})",
      },
    });
    expect(summary).toEqual({
      event: "CSP_VIOLATION",
      path: "/store/checkout",
      effectiveDirective: "script-src-elem",
      violatedDirective: "script-src-elem",
      blockedHost: "https://www.googletagmanager.com",
      disposition: "enforce",
    });
    expect(JSON.stringify(summary)).not.toContain("secret-value");
    expect(JSON.stringify(summary)).not.toContain("4111111111111111");
    expect(JSON.stringify(summary)).not.toContain("script-sample");
  });
});

describe("CSP report endpoint", () => {
  it("accepts a report and answers 204", async () => {
    const app = express();
    registerCspReportRoute(app);
    const body = {
      "csp-report": {
        "document-uri": "https://digeratiexperts.com/portal/billing",
        "violated-directive": "connect-src",
        "blocked-uri": "https://www.google-analytics.com/g/collect",
      },
    };
    const result = await new Promise<{ status: number; text: string }>((resolve, reject) => {
      const server = createServer(app).listen(0, "127.0.0.1", () => {
        const { port } = server.address() as AddressInfo;
        const payload = JSON.stringify(body);
        const req = httpRequest(
          {
            host: "127.0.0.1",
            port,
            path: CSP_REPORT_PATH,
            method: "POST",
            headers: {
              "Content-Type": "application/csp-report",
              "Content-Length": Buffer.byteLength(payload),
            },
          },
          (res) => {
            let text = "";
            res.on("data", (chunk) => {
              text += chunk;
            });
            res.on("end", () => {
              server.close();
              resolve({ status: res.statusCode ?? 0, text });
            });
          },
        );
        req.on("error", (err) => {
          server.close();
          reject(err);
        });
        req.write(payload);
        req.end();
      });
    });
    expect(result.status).toBe(204);
    expect(result.text).toBe("");
  });
});

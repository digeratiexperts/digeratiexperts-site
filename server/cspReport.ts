import type { Express, Request, Response } from "express";
import express from "express";
import rateLimit from "express-rate-limit";

export const CSP_REPORT_PATH = "/api/security/csp-report";

function pathOnly(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value, "https://digeratiexperts.com");
    return url.pathname.slice(0, 200);
  } catch {
    const raw = value.split(/[?#]/)[0];
    return raw ? raw.slice(0, 200) : null;
  }
}

function hostOnly(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value === "inline" || value === "eval" || value === "data" || value === "'unsafe-inline'" || value === "self") {
    return value.slice(0, 40);
  }
  try {
    return new URL(value, "https://digeratiexperts.com").origin.slice(0, 200);
  } catch {
    return value.slice(0, 80);
  }
}

function firstReport(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  if (Array.isArray(body)) {
    const row = body[0] as { body?: unknown } | undefined;
    if (row && typeof row.body === "object" && row.body) return row.body as Record<string, unknown>;
    if (row && typeof row === "object") return row as Record<string, unknown>;
    return null;
  }
  const rec = body as Record<string, unknown>;
  if (rec["csp-report"] && typeof rec["csp-report"] === "object") {
    return rec["csp-report"] as Record<string, unknown>;
  }
  const reports = rec.reports;
  if (Array.isArray(reports) && reports[0] && typeof reports[0] === "object") {
    const row = reports[0] as { body?: unknown };
    if (row.body && typeof row.body === "object") return row.body as Record<string, unknown>;
  }
  return rec;
}

export function summarizeCspViolation(body: unknown): {
  event: "CSP_VIOLATION";
  path: string | null;
  effectiveDirective: string | null;
  violatedDirective: string | null;
  blockedHost: string | null;
  disposition: string | null;
} {
  const report = firstReport(body) || {};
  const directive = report["effective-directive"] || report.effectiveDirective || report["violated-directive"] || report.violatedDirective;
  const violated = report["violated-directive"] || report.violatedDirective || directive;
  const blocked = report["blocked-uri"] || report.blockedURL || report.blockedUri;
  const documentUri = report["document-uri"] || report.documentURL || report.documentUri;
  const disposition = report.disposition;
  return {
    event: "CSP_VIOLATION",
    path: pathOnly(documentUri),
    effectiveDirective: typeof directive === "string" ? directive.slice(0, 80) : null,
    violatedDirective: typeof violated === "string" ? violated.slice(0, 80) : null,
    blockedHost: hostOnly(blocked),
    disposition: typeof disposition === "string" ? disposition.slice(0, 40) : null,
  };
}

export const cspReportRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false },
});

export function registerCspReportRoute(app: Express): void {
  app.post(
    CSP_REPORT_PATH,
    express.json({
      type: ["application/csp-report", "application/reports+json", "application/json"],
      limit: "8kb",
    }),
    cspReportRateLimiter,
    (req: Request, res: Response) => {
      const summary = summarizeCspViolation(req.body);
      console.warn("[SECURITY] CSP_VIOLATION", summary);
      res.status(204).end();
    },
  );
}

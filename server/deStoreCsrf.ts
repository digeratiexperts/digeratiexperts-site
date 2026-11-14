import type { NextFunction, Request, Response } from "express";

export const CSRF_REQUEST_HEADER = "x-csrf-token";

function stringValue(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function firstHeaderValue(value: unknown, max = 200): string {
  if (Array.isArray(value)) return stringValue(value[0], max);
  return stringValue(value, max);
}

function requestHosts(req: Request): string[] {
  const hosts = new Set<string>();
  const host = firstHeaderValue(req.get("host"), 200).toLowerCase();
  if (host) hosts.add(host);
  const forwarded = firstHeaderValue(req.headers["x-forwarded-host"], 200).toLowerCase();
  const forwardedHost = forwarded.split(",")[0]?.trim() ?? "";
  if (forwardedHost) hosts.add(forwardedHost);
  return [...hosts];
}

function sameOriginHost(req: Request, candidateHost: string): boolean {
  return requestHosts(req).includes(candidateHost.toLowerCase());
}

export function csrfOriginGuard(req: Request, res: Response, next: NextFunction) {
  const secFetchSite = stringValue(req.get("sec-fetch-site"), 40).toLowerCase();
  if (secFetchSite === "cross-site") {
    return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "Cross-site request rejected." });
  }
  const origin = stringValue(req.get("origin"), 300);
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (!originHost || !sameOriginHost(req, originHost)) {
        return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "Cross-origin request rejected." });
      }
    } catch {
      return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "Invalid origin." });
    }
  } else {
    const referer = stringValue(req.get("referer"), 500);
    if (referer) {
      try {
        const refHost = new URL(referer).host.toLowerCase();
        if (!refHost || !sameOriginHost(req, refHost)) {
          return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "Cross-origin referer rejected." });
        }
      } catch {
        return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "Invalid referer." });
      }
    }
  }

  const headerToken = firstHeaderValue(req.headers[CSRF_REQUEST_HEADER], 200);
  if (!headerToken) {
    return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "Missing CSRF header." });
  }
  if (req.cookies && req.cookies["x-csrf-token"] && req.cookies["x-csrf-token"] !== headerToken) {
    return res.status(403).json({ code: "CSRF_FORBIDDEN", error: "CSRF token mismatch." });
  }
  return next();
}

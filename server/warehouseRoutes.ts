import type { Express, Request, Response } from "express";
import {
  applyPrivateCacheHeaders,
  isWarehouseCatalogApiPath,
  isWarehouseHtmlPath,
  requireWarehouseStaffApi,
  resolveWarehouseStaff,
  sendGenericNotFound,
} from "./warehouseAccess";
import { classifyLegacyStorePath, toWarehousePath } from "./storeLegacyRedirects";
import { fetchStaffCatalog, fetchPax8ConnectorHealth } from "./integrations/techSalesClient";

function withQuery(req: Request, dest: string): string {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  return `${dest}${q}`;
}

/**
 * Signed-in staff are sent from /store into the warehouse. This cookie lets them
 * walk the public Store as a buyer for internal visual QA (source of truth
 * §16.10, approved 2026-09-28): `?as=buyer` sets it, `?as=staff` clears it.
 * It only relaxes that one redirect for a request that is already staff; it
 * grants nothing, and a buyer who sets it by hand sees what they saw before.
 */
export const STORE_PREVIEW_COOKIE = "de_store_preview";
const STORE_PREVIEW_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 1000 * 60 * 60 * 8,
};

/** The request's query without the `as` toggle, so a reload does not toggle again. */
function queryWithoutToggle(req: Request): string {
  // Only the query is parsed, never the request target: an absolute-form target with a bad port must not throw.
  const target = req.originalUrl || req.url;
  const params = new URLSearchParams(target.includes("?") ? target.slice(target.indexOf("?") + 1) : "");
  params.delete("as");
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function registerWarehouseGates(app: Express): void {
  app.get("/api/internal/warehouse/session", (req: Request, res: Response) => {
    applyPrivateCacheHeaders(res);
    if (!resolveWarehouseStaff(req)) {
      sendGenericNotFound(req, res);
      return;
    }
    res.json({ ok: true });
  });

  /** Staff-safe Hub catalog projection (ECO-014). Generic 404 unless warehouse staff. */
  app.get("/api/internal/warehouse/catalog", async (req: Request, res: Response) => {
    applyPrivateCacheHeaders(res);
    if (!resolveWarehouseStaff(req)) {
      sendGenericNotFound(req, res);
      return;
    }
    const live = await fetchStaffCatalog();
    if (live && typeof live === "object") {
      const status =
        typeof (live as { status?: unknown }).status === "string"
          ? String((live as { status: string }).status)
          : "CONNECTED";
      res.json({
        status,
        source: "hub",
        publishedAt: (live as { publishedAt?: string }).publishedAt ?? new Date().toISOString(),
        message: (live as { message?: string }).message,
        tiers: (live as { tiers?: unknown[] }).tiers ?? [],
        skus: (live as { skus?: unknown[] }).skus ?? [],
      });
      return;
    }
    res.json({
      status: "LOCAL_WORKSHOP",
      source: "local_workshop_fallback",
      publishedAt: null,
      message:
        "Hub staff-catalog is not available. Use the workshop SKU catalog in this warehouse until the Hub feed is configured and reachable.",
      tiers: [],
      skus: [],
    });
  });

  /** Hub connector health for the warehouse Vendors page. */
  app.get("/api/internal/warehouse/connectors", async (req: Request, res: Response) => {
    applyPrivateCacheHeaders(res);
    if (!resolveWarehouseStaff(req)) {
      sendGenericNotFound(req, res);
      return;
    }
    const pax8 = await fetchPax8ConnectorHealth();
    res.json({
      connectors: [
        pax8 ?? {
          connector: "pax8",
          status: "UNKNOWN",
          message: "Hub Pax8 health endpoint unreachable or unconfigured.",
          checkedAt: new Date().toISOString(),
        },
      ],
    });
  });

  app.use((req, res, next) => {
    if (!isWarehouseCatalogApiPath(req.path)) return next();
    return requireWarehouseStaffApi(req, res, next);
  });

  // The Store's old public home. One address for the Business Solution Builder now.
  app.use((req, res, next) => {
    const path = req.path.replace(/\/+$/, "") || "/";
    if (path !== "/solutions/business-needs" && !path.startsWith("/solutions/business-needs/")) return next();
    const rest = path.slice("/solutions/business-needs".length);
    return res.redirect(301, withQuery(req, rest ? `/store/solutions${rest}` : "/store"));
  });

  app.use((req, res, next) => {
    const path = req.path;
    if (path !== "/store" && !path.startsWith("/store/")) return next();

    applyPrivateCacheHeaders(res);
    const staff = resolveWarehouseStaff(req);
    if (staff) {
      const toggle = typeof req.query.as === "string" ? req.query.as : "";
      if (toggle === "buyer") {
        res.cookie(STORE_PREVIEW_COOKIE, "1", STORE_PREVIEW_COOKIE_OPTIONS);
        return res.redirect(302, `${path}${queryWithoutToggle(req)}`);
      }
      if (toggle === "staff") {
        res.clearCookie(STORE_PREVIEW_COOKIE, { path: "/" });
        return res.redirect(302, `${toWarehousePath(path)}${queryWithoutToggle(req)}`);
      }
      if (req.cookies?.[STORE_PREVIEW_COOKIE] !== "1") {
        return res.redirect(302, withQuery(req, toWarehousePath(path)));
      }
      // Previewing as a buyer: fall through to exactly what a buyer gets.
    }

    const classified = classifyLegacyStorePath(path);
    if (classified.kind === "public_store") {
      res.removeHeader("X-Robots-Tag");
      res.removeHeader("Cache-Control");
      return next();
    }
    if (classified.kind === "public_redirect") {
      return res.redirect(301, withQuery(req, classified.to));
    }
    sendGenericNotFound(req, res);
  });

  app.use((req, res, next) => {
    const path = req.path;
    if (path !== "/internal" && !path.startsWith("/internal/")) return next();

    applyPrivateCacheHeaders(res);
    if (isWarehouseHtmlPath(path)) {
      if (resolveWarehouseStaff(req)) return next();
      sendGenericNotFound(req, res);
      return;
    }
    return res.redirect(301, "/");
  });
}

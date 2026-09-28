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

function withQuery(req: Request, dest: string): string {
  const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  return `${dest}${q}`;
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
      return res.redirect(302, withQuery(req, toWarehousePath(path)));
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

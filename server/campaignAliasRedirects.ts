import type { Express } from "express";
import { isKnownSpaPath } from "./spaKnownPaths";

/**
 * /lp/<slug> and /ads/<slug> are ad and legacy aliases for the campaign
 * landing /go/<slug>. Until 2026-10-01 the server answered them HTTP 404 (to
 * ad platforms and crawlers too) and the browser then redirected, dropping the
 * query string, so UTM tags and click ids never reached the landing page. The
 * server now forwards a known campaign with its query string intact; an
 * unknown slug falls through to the 404 it always got.
 */
export function registerCampaignAliasRedirects(app: Express): void {
  app.get(["/lp/:slug", "/ads/:slug"], (req, res, next) => {
    const target = `/go/${String(req.params.slug).toLowerCase()}`;
    if (!isKnownSpaPath(target)) return next();
    const q = req.originalUrl.indexOf("?");
    res.redirect(302, q === -1 ? target : target + req.originalUrl.slice(q));
  });
}

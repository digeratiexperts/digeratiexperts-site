import type { Express, Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import type { EmailEnv } from "@shared/marketingEmail";
import { logger } from "./logger";
import { dbOptOutStore, exportSuppressions, suppressionsCsv, verifyUnsubscribeTokenFromEnv, type OptOutStore } from "./marketingEmail";

/**
 * Marketing email unsubscribe.
 *
 *   GET  /api/email/unsubscribe?t=<token>  page with a single "Unsubscribe" button
 *   POST /api/email/unsubscribe?t=<token>  records the opt-out
 *
 * The POST is also the RFC 8058 one-click target named in the
 * List-Unsubscribe header: mail providers send it with the body
 * "List-Unsubscribe=One-Click" and no cookies. GET never changes anything,
 * because link scanners and previewers fetch URLs in mail on their own.
 * The token is an HMAC over the address (see marketingEmail.ts), so a link
 * only ever opts out the address it was sent to.
 *
 *   GET  /api/portal/admin/marketing/opt-outs[?format=csv]
 *
 * DE admins only: the whole opt-out list, for loading into the bulk
 * sender's suppression list before a campaign goes out.
 */

export const UNSUBSCRIBE_PATH = "/api/email/unsubscribe";
export const OPT_OUT_EXPORT_PATH = "/api/portal/admin/marketing/opt-outs";
const HELP_ADDRESS = "admin@digeratiexperts.com";

export interface UnsubscribeRouteDeps {
  /** Guards for the export; must admit DE admins only. */
  adminGuards: RequestHandler[];
  store?: OptOutStore;
  env?: EmailEnv;
}

function page(res: Response, status: number, heading: string, body: string): void {
  res
    .status(status)
    .set("Cache-Control", "no-store")
    .set("X-Robots-Tag", "noindex")
    .type("html")
    .send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${heading} - Digerati Experts</title></head>
<body>
<main>
<h1>${heading}</h1>
${body}
</main>
</body>
</html>`);
}

function tokenFrom(req: Request): string {
  const fromQuery = typeof req.query.t === "string" ? req.query.t : "";
  const fromBody = typeof req.body?.t === "string" ? req.body.t : "";
  return (fromQuery || fromBody).trim();
}

const invalidLink = (res: Response) =>
  page(
    res,
    400,
    "This unsubscribe link is not valid",
    `<p>The link may have been cut off. Use the full link from the email, or write to <a href="mailto:${HELP_ADDRESS}">${HELP_ADDRESS}</a> and we will remove you by hand.</p>`,
  );

export function registerMarketingUnsubscribeRoutes(app: Express, deps: UnsubscribeRouteDeps): void {
  if (!deps.adminGuards?.length) throw new Error("opt-out export needs admin guards");
  const store = deps.store ?? dbOptOutStore;
  const env = () => deps.env ?? process.env;
  const limiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });

  app.get(UNSUBSCRIBE_PATH, limiter, (req, res) => {
    const token = tokenFrom(req);
    if (!verifyUnsubscribeTokenFromEnv(token, env())) return invalidLink(res);
    page(
      res,
      200,
      "Unsubscribe from Digerati Experts email",
      `<p>Press the button to stop all marketing email from Digerati Experts to this address. Emails about your account, orders and support tickets will still arrive.</p>
<form method="post" action="${UNSUBSCRIBE_PATH}?t=${encodeURIComponent(token)}"><button type="submit">Unsubscribe</button></form>`,
    );
  });

  app.post(UNSUBSCRIBE_PATH, limiter, async (req, res) => {
    const address = verifyUnsubscribeTokenFromEnv(tokenFrom(req), env());
    if (!address) return invalidLink(res);
    const oneClick = req.body?.["List-Unsubscribe"] === "One-Click";
    try {
      await store.add(address, oneClick ? "one-click" : "unsubscribe-page");
    } catch (error: any) {
      logger.error("[MARKETING_EMAIL] opt-out not saved", error);
      return page(
        res,
        503,
        "We could not save that just now",
        `<p>Try the link again in a few minutes, or write to <a href="mailto:${HELP_ADDRESS}">${HELP_ADDRESS}</a> and we will remove you by hand.</p>`,
      );
    }
    logger.info(`[MARKETING_EMAIL] opt-out recorded (${oneClick ? "one-click" : "unsubscribe page"})`);
    page(res, 200, "You are unsubscribed", "<p>You will not get any more marketing email from Digerati Experts at this address.</p>");
  });

  app.get(OPT_OUT_EXPORT_PATH, ...deps.adminGuards, async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    let exported;
    try {
      exported = await exportSuppressions(store);
    } catch (error: any) {
      logger.error("[MARKETING_EMAIL] opt-out export failed", error);
      return res.status(503).json({ error: "The opt-out list could not be read. Do not send until it can." });
    }
    logger.info(`[MARKETING_EMAIL] opt-out list exported (${exported.count} addresses)`);
    if (req.query.format === "csv") {
      return res
        .type("text/csv")
        .set("Content-Disposition", 'attachment; filename="marketing-opt-outs.csv"')
        .send(suppressionsCsv(exported.records));
    }
    res.json(exported);
  });
}

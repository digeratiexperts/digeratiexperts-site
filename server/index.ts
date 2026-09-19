import dotenv from "dotenv";
dotenv.config();

import { enforceProductionConfig } from "./production.config";
// Fail closed before serving traffic: missing/unsafe required production
// config (JWT_SECRET, DATABASE_URL) terminates startup with a clear error.
enforceProductionConfig();

import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes, authMiddleware, requireRole } from "./routes";
import { registerSecureZohoStoreCheckout } from "./secureStoreCheckout";
import { isStagingReview, stagingReviewStatus } from "./stagingReviewGuard";
import { registerStoreSolutionRoutes } from "./storeSolutionRoutes";
import { registerPublicSolutionRoutes } from "./publicSolutionRoutes";
import { registerWarehouseGates } from "./warehouseRoutes";
import { registerPortalMarketplaceRoutes } from "./portalMarketplaceRoutes";
import { registerPublicSupportChat } from "./publicSupportChat";
import { isKnownSpaPath } from "./spaKnownPaths";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import compression from "compression";
import jwt from "jsonwebtoken";
import { zohoPayments } from "./zohoPayments";
import { evaluatePaymentSucceeded } from "./zohoPaymentWebhook";
import { getJwtSecretOrNull } from "./config/authSecrets";
import { setupCrossServiceHandlers } from "./crossServiceHandler";
import { eventBus, EventTypes } from "./eventBus";

process.on('unhandledRejection', (reason, promise) => {
  const errorStr = String(reason);
  if (errorStr.includes('endpoint has been disabled') ||
      errorStr.includes('Connection terminated') ||
      errorStr.includes('connection to server')) {
    // Tolerated (transient DB connection drops) but never silent.
    console.warn('⚠️ Unhandled rejection (database connection, tolerated):', errorStr.slice(0, 200));
    return;
  }
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  const errorStr = String(error.message);
  if (errorStr.includes('endpoint has been disabled') || 
      errorStr.includes('Connection terminated') ||
      errorStr.includes('connection to server')) {
    console.log('⚠️ Database error caught and handled (non-fatal)');
    return;
  }
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

const app = express();
const server = createServer(app);

// One reverse-proxy hop (OpenLiteSpeed/CyberPanel) in front of the app:
// required so express-rate-limit and req.ip see the real client address.
app.set("trust proxy", 1);

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

setupCrossServiceHandlers();

const log = (message: string) => {
  const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
  console.log(`[${timestamp}] ${message}`);
};

import { setSecurityHeaders } from "./middleware/security";
app.use(setSecurityHeaders);

app.use((req, _res, next) => {
  log(`→ ${req.method} ${req.originalUrl}`);
  next();
});

app.all("/api/health", async (_req, res) => {
  const port = process.env.REPLIT_SERVER_PORT || process.env.PORT || "unknown";
  let dbAvailable = false;
  try {
    const { pool } = await import("./db");
    if (pool) {
      const client = await pool.connect();
      client.release();
      dbAvailable = true;
    }
  } catch { dbAvailable = false; }
  const openaiConfigured = !!(
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_API ||
    (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY)
  );
  
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    env: app.get("env"),
    port,
    services: {
      database: dbAvailable ? "connected" : "fallback_memory",
      zohoPayments: zohoPayments.isConfigured() ? "configured" : "not_configured",
      openai: openaiConfigured ? "configured" : "not_configured",
    },
    // Lets a reviewer confirm outbound mutations are locked down.
    stagingReview: stagingReviewStatus(),
    uptime: process.uptime(),
  };
  
  res.status(200).json(health);
});

app.all("/healthz", (_req, res) => res.status(200).send("ok"));
app.all("/ready", (_req, res) => res.status(200).json({ ready: true }));

/**
 * Portal routing heal — Cloudflare on digeratexperts.com strips `/portal` when
 * bouncing to the portal host, producing portal…//login. Heal inbound broken
 * paths; never invent //login in app redirects.
 */
app.use((req, res, next) => {
  const host = String(req.headers.host || "")
    .toLowerCase()
    .split(":")[0];
  const rawUrl = req.url || "/";
  const pathOnly = rawUrl.split("?")[0] || "/";
  const qs = rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?")) : "";

  const isPortalHost =
    host === "portal.digeratiexperts.com" || host.startsWith("portal.");

  // CF currently emits portal…//login — collapse and land on canonical login
  if (isPortalHost) {
    const collapsed = "/" + pathOnly.replace(/^\/+/, "");
    if (collapsed === "/login" || collapsed === "/login/") {
      return res.redirect(301, `/portal/login${qs}`);
    }
  }

  if (pathOnly.startsWith("//")) {
    const collapsed = "/" + pathOnly.replace(/^\/+/, "");
    return res.redirect(301, `${collapsed}${qs}`);
  }

  if (isPortalHost && (pathOnly === "/login" || pathOnly === "/login/")) {
    return res.redirect(301, `/portal/login${qs}`);
  }

  if (
    (host === "digeratiexperts.com" || host === "www.digeratiexperts.com") &&
    (pathOnly === "/portal" || pathOnly.startsWith("/portal/"))
  ) {
    return res.redirect(301, `https://portal.digeratiexperts.com${pathOnly}${qs}`);
  }

  next();
});

if (zohoPayments.isConfigured()) {
  log("✅ Zoho Payments configured");
} else {
  log("⚠️ Zoho Payments not configured - set ZOHO_PAYMENTS_ACCOUNT_ID, OAuth refresh credentials, and ZOHO_PAYMENTS_SIGNING_KEY");
}

app.post(
  "/api/webhooks/zoho-payments",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature = req.headers["x-zoho-webhook-signature"] as string;
      if (!signature) {
        console.error("[ZOHO PAYMENTS WEBHOOK] Missing X-Zoho-Webhook-Signature header");
        return res.status(400).json({ error: "Missing webhook signature" });
      }

      const isValid = zohoPayments.verifyWebhookSignature(req.body, signature);
      if (!isValid) {
        console.error("[ZOHO PAYMENTS WEBHOOK] Invalid signature");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      const event = JSON.parse(req.body.toString("utf-8"));
      const parsed = zohoPayments.parseWebhookEvent(event);
      const metadata = Object.fromEntries(parsed.metadata.map((item) => [item.key, item.value]));
      let fulfillOrderId: string | null = null;

      if (parsed.eventType === "payment.succeeded") {
        const { db } = await import("./db");
        const { storeOrders } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        const metadataOrderId = metadata.orderId || null;
        const orderNumber = metadata.orderNumber || parsed.referenceNumber || parsed.invoiceNumber || null;
        let existingOrder: any = null;

        if (metadataOrderId) {
          [existingOrder] = await db.select().from(storeOrders)
            .where(eq(storeOrders.id, metadataOrderId)).limit(1);
        }
        if (!existingOrder && orderNumber) {
          [existingOrder] = await db.select().from(storeOrders)
            .where(eq(storeOrders.orderNumber, orderNumber)).limit(1);
        }

        if (existingOrder) {
          const oldStatus = existingOrder.status || "unknown";
          const decision = evaluatePaymentSucceeded(existingOrder, parsed);

          if (decision.action === "reject") {
            console.error("[SECURITY] PAYMENT_VERIFICATION_FAILED", {
              orderId: existingOrder.id,
              orderNumber: existingOrder.orderNumber,
              reason: decision.reason,
              expectedTotal: existingOrder.total,
              eventAmount: parsed.amount,
              eventCurrency: parsed.currency,
              paymentId: parsed.paymentId,
            });
            // Acknowledge receipt (the signature was valid) but do NOT
            // transition the order; it stays awaiting reconciliation.
            return res.json({ received: true });
          }

          if (decision.action === "mark_paid") {
            await db.update(storeOrders)
              .set({
                status: "paid",
                zohoPaymentId: parsed.paymentId || existingOrder.zohoPaymentId || null,
                paidAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(storeOrders.id, existingOrder.id));

            console.log("[SECURITY] ORDER_STATUS_CHANGED", {
              orderId: existingOrder.id,
              orderNumber: existingOrder.orderNumber,
              oldStatus,
              newStatus: "paid",
              triggeredBy: "zoho_payments_webhook",
            });
          } else if (!existingOrder.zohoPaymentId && parsed.paymentId) {
            await db.update(storeOrders)
              .set({
                zohoPaymentId: parsed.paymentId,
                paidAt: existingOrder.paidAt || new Date(),
                updatedAt: new Date(),
              })
              .where(eq(storeOrders.id, existingOrder.id));
          }

          console.log("[SECURITY] CHECKOUT_COMPLETED", {
            orderId: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
            paymentMethod: "zoho",
            total: existingOrder.total,
            zohoPaymentId: parsed.paymentId,
          });
          fulfillOrderId = existingOrder.id;
        } else {
          console.info("[ZOHO PAYMENTS WEBHOOK] Verified payment succeeded with no local store order", {
            paymentId: parsed.paymentId,
            referenceNumber: parsed.referenceNumber,
            invoiceNumber: parsed.invoiceNumber,
          });
        }
      } else if (parsed.eventType === "payment.failed" || parsed.eventType === "payment.pending") {
        console.info("[ZOHO PAYMENTS WEBHOOK] Payment attempt update", {
          eventType: parsed.eventType,
          paymentId: parsed.paymentId,
          referenceNumber: parsed.referenceNumber,
          status: parsed.status,
        });
      }

      res.json({ received: true });

      if (fulfillOrderId) {
        const orderId = fulfillOrderId;
        void import("./services/orderFulfillment")
          .then(({ fulfillPaidOrder }) => fulfillPaidOrder(orderId))
          .catch((error) => {
            console.error("[ZOHO PAYMENTS WEBHOOK FULFILLMENT ERROR]", error);
          });
      }
      return;
    } catch (error: any) {
      console.error("[ZOHO PAYMENTS WEBHOOK ERROR]", error);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

registerWarehouseGates(app);
registerSecureZohoStoreCheckout(app, authMiddleware as any, requireRole as any);
registerStoreSolutionRoutes(app, authMiddleware as any);
registerPublicSolutionRoutes(app);
registerPortalMarketplaceRoutes(app, authMiddleware as any);

app.use((req, res, next) => {
  if (req.path.toLowerCase() === "/solutions/proactive-ecosystem-packages") {
    return res.redirect(301, "/solutions/proactive-ecosystem");
  }
  if (req.path === "/about/mission") {
    return res.redirect(301, "/about/mission-values");
  }
  next();
});

// /internal/warehouse is gated in registerWarehouseGates. Other /internal paths stay destaged.

app.use((req, res, next) => {
  if (req.path === "/login") {
    const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    return res.redirect(301, `/portal/login${q}`);
  }
  if (req.path === "/signup") {
    const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    return res.redirect(301, `/portal/signup${q}`);
  }
  next();
});

app.use((req, res, next) => {
  if (req.path === "/" && Object.prototype.hasOwnProperty.call(req.query, "bbp_search")) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    return res
      .status(410)
      .type("text/plain")
      .send("Gone. This legacy WordPress search URL is no longer available.");
  }
  next();
});

/**
 * Internal commercial tools — defense in depth:
 * X-Robots-Tag + robots.txt Disallow + auth gate (portal session cookie).
 * Do not rely on client-side noindex alone.
 */
const INTERNAL_TOOL_PATHS = [
  "/official-network-planner",
  "/de-ecosystem-matrix-offical",
];

app.use((req, res, next) => {
  const isInternalTool = INTERNAL_TOOL_PATHS.some(
    (p) => req.path === p || req.path.startsWith(`${p}/`),
  );
  if (!isInternalTool) return next();

  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  // In local/dev, allow tooling without portal cookie so DE can iterate.
  if (app.get("env") !== "production") return next();

  const token =
    typeof req.cookies?.portalAuth === "string" ? req.cookies.portalAuth : "";
  const secret = getJwtSecretOrNull();
  if (!token || !secret) {
    const returnTo = encodeURIComponent(req.path);
    return res.redirect(
      302,
      `https://portal.digeratiexperts.com/portal/login?returnTo=${returnTo}`,
    );
  }

  try {
    jwt.verify(token, secret);
    return next();
  } catch {
    const returnTo = encodeURIComponent(req.path);
    return res.redirect(
      302,
      `https://portal.digeratiexperts.com/portal/login?returnTo=${returnTo}`,
    );
  }
});

const publicDir = path.resolve(process.cwd(), "public");
function sendSeoFile(res: import("express").Response, file: string, contentType: string) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  res.setHeader("CDN-Cache-Control", "max-age=300");
  res.setHeader("Cloudflare-CDN-Cache-Control", "max-age=300");
  return res.sendFile(path.join(publicDir, file));
}
app.get("/robots.txt", (_req, res) => sendSeoFile(res, "robots.txt", "text/plain; charset=utf-8"));
app.get("/sitemap.xml", (_req, res) => sendSeoFile(res, "sitemap.xml", "application/xml; charset=utf-8"));
app.get("/llms.txt", (_req, res) => sendSeoFile(res, "llms.txt", "text/plain; charset=utf-8"));
app.use(
  express.static(publicDir, {
    index: false,
    maxAge: "1h",
  }),
);

// Version B preview (PR #164, Joe-authorized go-live): the isolated Scrollcraft
// interpretation of the site, published additively at /v2. Static, committed
// under public/v2, X-Robots-Tag noindex so the preview never competes with the
// canonical pages in search.
app.use(
  "/v2",
  express.static(path.join(publicDir, "v2"), {
    maxAge: "1h",
    setHeaders(res) {
      res.setHeader("X-Robots-Tag", "noindex");
    },
  }),
);

// Scrollcraft lab (reference only, Joe's "URLs to see the Scrollcraft stuff"):
// the review pages, the diagram gallery and the rendered plans, published
// additively under /scrollcraft. Static, committed under public/scrollcraft
// (scripts/build-scrollcraft-lab.mjs); X-Robots-Tag noindex like /v2 and
// Disallow'd in robots.txt so none of it competes with the canonical pages.
app.use(
  "/scrollcraft",
  express.static(path.join(publicDir, "scrollcraft"), {
    maxAge: "5m",
    setHeaders(res) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    },
  }),
);

// Experience v1 (Joe, 2026-09-03: "published to another page until I approve
// it", then "show me it with the site"): the speakable address forwards to the
// React route that wraps the story in the site's own menu and footer; the
// standalone build stays at /scrollcraft/experience-v1/ for the lab.
app.get("/experience-v1", (_req, res) => {
  res.setHeader("X-Robots-Tag", "noindex");
  res.redirect(302, "/experience");
});

// Homepage version archive (client/src/pages/versions/README.md): version 2
// is the static Version B build above, so its numbered URL forwards there.
app.get("/version-2", (_req, res) => {
  res.setHeader("X-Robots-Tag", "noindex");
  res.redirect(302, "/v2");
});

function listEndpoints(): Array<{ method: string; path: string }> {
  const routes: Array<{ method: string; path: string }> = [];
  const stack: any[] = (app as any)?._router?.stack || [];
  const dig = (layer: any, prefix = "") => {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods || {}).map((m) =>
        m.toUpperCase(),
      );
      methods.forEach((m) =>
        routes.push({ method: m, path: prefix + layer.route.path }),
      );
    } else if (layer.name === "router" && layer.handle?.stack) {
      const newPrefix =
        layer.regexp && layer.regexp.fast_star
          ? prefix + "*"
          : prefix + (layer.regexp?.fast_slash ? "" : "");
      layer.handle.stack.forEach((l: any) => dig(l, prefix));
    }
  };
  stack.forEach((l) => dig(l, ""));
  return routes;
}

(async () => {
  await registerRoutes(app);
  registerPublicSupportChat(app);

  if (app.get("env") === "development") {
    app.use((req, _res, next) => {
      if (req.headers.host && req.headers.host.includes('.replit.dev')) {
        req.headers.host = 'localhost:5000';
      }
      next();
    });

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      configFile: path.resolve(process.cwd(), "vite.config.ts"),
    });
    
    app.use(vite.middlewares);
    log("✨ Vite development server middleware attached");
  } else {
    const distPath = path.resolve(process.cwd(), "dist/public");
    const indexPath = path.join(distPath, "index.html");
    
    app.use(express.static(distPath, {
      maxAge: '1y',
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        if (filePath.match(/\.(js|css|woff2?|ttf|eot)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        else if (filePath.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=2592000');
        }
        else if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));
    
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      
      if (fs.existsSync(indexPath)) {
        // Known SPA routes → 200; unknown paths still get the shell but HTTP 404.
        const status = isKnownSpaPath(req.path) ? 200 : 404;
        res.status(status).sendFile(indexPath);
      } else {
        log(`⚠️ Production build not found at ${distPath}`);
        res.status(404).send(`
          <h1>Production Build Not Found</h1>
          <p>Please run <code>npm run build</code> to create a production build.</p>
        `);
      }
    });
    
    log(`📦 Serving static files from ${distPath}`);
  }

  if (process.env.NODE_ENV !== "production") {
    app.get("/__debug/routes", (_req, res) =>
      res.json({ routes: listEndpoints() }),
    );
  }

  app.use((req, res) => {
    res.status(404).json({
      error: "Not Found",
      path: req.originalUrl,
      knownHealth: ["/api/health", "/healthz"],
    });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    log(`✖ ${status} ${err.message || "Internal Server Error"}`);
    res.status(status).json({ message: err.message || "Internal Server Error" });
  });

  const port = parseInt(
    process.env.REPLIT_SERVER_PORT || process.env.PORT || "8080",
    10,
  );
  const host = "0.0.0.0";

  // Staging review pre-flight: record the database identity and refuse to boot
  // if a locked-down review instance is pointed at the production database.
  // Identity is derived from the DSN host/name only — never the credentials.
  if (isStagingReview()) {
    const dsn = process.env.DATABASE_URL || "";
    let dbHost = "unset";
    let dbName = "unset";
    if (dsn) {
      try {
        const parsed = new URL(dsn);
        dbHost = parsed.host;
        dbName = parsed.pathname.replace(/^\//, "") || "unset";
      } catch {
        dbHost = "unparseable";
      }
    }
    log(`🔒 STAGING REVIEW MODE — outbound mutations disabled`);
    log(`🔒 Database identity: host=${dbHost} name=${dbName}`);

    const productionMarkers = (process.env.DE_PRODUCTION_DB_MARKERS || "")
      .split(",")
      .map((m) => m.trim().toLowerCase())
      .filter(Boolean);
    const identity = `${dbHost}/${dbName}`.toLowerCase();
    const collision = productionMarkers.find((marker) => identity.includes(marker));
    if (collision) {
      console.error(
        `[STAGING REVIEW] ABORT — DATABASE_URL resolves to a production marker ('${collision}'). ` +
          "A review instance must never share the production database.",
      );
      process.exit(1);
    }
  }

  log(
    `🌐 Using port: ${port} (PORT=${process.env.PORT || "unset"}, REPLIT_SERVER_PORT=${process.env.REPLIT_SERVER_PORT || "unset"})`,
  );

  server.listen(port, host, () => {
    log(`🚀 Running on http://${host}:${port}`);
    void import("./integrations/deSyncWorker")
      .then(({ startDeSyncWorker }) => startDeSyncWorker())
      .catch((error) => {
        log(`⚠️ de-sync worker not started: ${error?.message || error}`);
      });
    void import("./services/threat-intel/ingest")
      .then(({ startThreatIntelScheduler }) => startThreatIntelScheduler())
      .catch((error) => {
        log(`⚠️ Threat-intel scheduler not started: ${error?.message || error}`);
      });
    const slug = process.env.REPL_SLUG;
    const owner = process.env.REPL_OWNER;
    if (slug && owner) {
      log(`🌍 Try: https://${slug}-${owner}.replit.app/api/health`);
      if (process.env.NODE_ENV !== "production") {
        log(`🔎 Routes: https://${slug}-${owner}.replit.app/__debug/routes`);
      }
    }
  });
})();
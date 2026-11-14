import "dotenv/config";

import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes, authMiddleware, requireRole } from "./routes";
import { registerSecureZohoStoreCheckout } from "./secureStoreCheckout";
import { registerStoreSolutionRoutes } from "./storeSolutionRoutes";
import { registerPublicSupportChat } from "./publicSupportChat";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import compression from "compression";
import jwt from "jsonwebtoken";
import { zohoPayments } from "./zohoPayments";
import { enqueueZohoPaymentWebhook } from "./zohoPaymentWebhookInbox";
import { setupCrossServiceHandlers } from "./crossServiceHandler";
import { eventBus, EventTypes } from "./eventBus";
import { storageReady } from "./storage";
import { loadRuntimeConfig } from "./production.config";
import { assertPaymentSchemaReady } from "./paymentSchemaReadiness";

const runtimeConfig = loadRuntimeConfig(process.env);

process.on('unhandledRejection', (reason, promise) => {
  const errorStr = String(reason);
  if (errorStr.includes('endpoint has been disabled') || 
      errorStr.includes('Connection terminated') ||
      errorStr.includes('connection to server')) {
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
app.set("trust proxy", runtimeConfig.server.trustProxy ? 1 : false);

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
  const port = process.env.PORT || "unknown";
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
    status: dbAvailable ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    env: app.get("env"),
    port,
    services: {
      database: dbAvailable ? "connected" : "unavailable",
      zohoPayments: zohoPayments.isConfigured() ? "configured" : "not_configured",
      openai: openaiConfigured ? "configured" : "not_configured",
    },
    uptime: process.uptime(),
  };
  
  const status = runtimeConfig.environment === "production" && !dbAvailable ? 503 : 200;
  res.status(status).json(health);
});

app.all("/healthz", (_req, res) => res.status(200).send("ok"));
app.all("/ready", async (_req, res) => {
  if (runtimeConfig.environment !== "production") {
    return res.status(200).json({ ready: true });
  }

  try {
    const { pool } = await import("./db");
    if (!pool) throw new Error("Database pool is unavailable");
    const client = await pool.connect();
    client.release();
    return res.status(200).json({ ready: true });
  } catch {
    return res.status(503).json({ ready: false });
  }
});

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
    const startedAt = Date.now();
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

      const event = zohoPayments.parseWebhookPayload(req.body);
      const parsed = zohoPayments.parseWebhookEvent(event);
      const queued = await enqueueZohoPaymentWebhook(parsed);
      console.info("[ZOHO PAYMENTS WEBHOOK] durably accepted", {
        eventId: queued.eventId,
        eventType: parsed.eventType,
        duplicate: !queued.inserted,
      });
      return res.status(202).json({ received: true });
    } catch (error: any) {
      console.error("[ZOHO PAYMENTS WEBHOOK ERROR]", error);
      return res.status(500).json({ error: "Webhook processing failed" });
    } finally {
      const durationMs = Date.now() - startedAt;
      const details = { durationMs, statusCode: res.statusCode };
      if (durationMs >= 12_000) console.warn("[ZOHO PAYMENTS WEBHOOK] SLA risk", details);
      else console.info("[ZOHO PAYMENTS WEBHOOK] handled", details);
    }
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

registerSecureZohoStoreCheckout(app, authMiddleware as any, requireRole as any);
registerStoreSolutionRoutes(app, authMiddleware as any);

app.use((req, res, next) => {
  if (req.path.toLowerCase() === "/solutions/proactive-ecosystem-packages") {
    return res.redirect(301, "/solutions/proactive-ecosystem");
  }
  if (req.path === "/about/mission") {
    return res.redirect(301, "/about/mission-values");
  }
  next();
});

app.use((req, res, next) => {
  if (req.path === "/internal" || req.path.startsWith("/internal/")) {
    return res.redirect(301, "/");
  }
  next();
});

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
  const secret = process.env.JWT_SECRET;
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
  await storageReady;
  if (runtimeConfig.environment === "production") {
    const { pool, dbReady } = await import("./db");
    if (!dbReady || !pool) {
      throw new Error("Production database is unavailable; refusing to start.");
    }
    await assertPaymentSchemaReady(pool);
  }
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
        res.sendFile(indexPath);
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

  const port = runtimeConfig.server.port;
  const host = runtimeConfig.server.host;

  log(
    `🌐 Using port: ${port} (PORT=${process.env.PORT || "unset"})`,
  );

  server.listen(port, host, () => {
    log(`🚀 Running on http://${host}:${port}`);
    void import("./integrations/deSyncWorker")
      .then(({ startDeSyncWorker }) => startDeSyncWorker())
      .catch((error) => {
        log(`⚠️ de-sync worker not started: ${error?.message || error}`);
      });
    void import("./services/orderFulfillment")
      .then(({ startOrderFulfillmentReconciliation }) =>
        startOrderFulfillmentReconciliation(),
      )
      .catch((error) => {
        log(`⚠️ order-fulfillment reconciliation not started: ${error?.message || error}`);
      });
    void import("./zohoPaymentWebhookInbox")
      .then(({ startZohoPaymentWebhookInbox }) => startZohoPaymentWebhookInbox())
      .catch((error) => {
        log(`⚠️ Zoho payment inbox worker not started: ${error?.message || error}`);
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
})().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal startup error: ${message}`);
  process.exit(1);
});

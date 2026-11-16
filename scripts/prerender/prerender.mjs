import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prerenderRoutes, snapshotFileName } from "./routes.mjs";

/**
 * Build-time prerender of the public marketing pages (raw HTML for crawlers).
 *
 * The site is a React SPA: before this, every page's HTML body was an empty
 * <div id="root">, so crawlers that do not run JavaScript (many AI crawlers,
 * link previews) saw no H1, copy or links. After `vite build` + esbuild, this
 * starts the built server on a free local port with a throwaway, database-free
 * environment (the same shape as the CI smoke), opens each sitemap page in
 * headless Chromium, and saves the rendered body to dist/prerender/. The server
 * (server/prerender.ts) puts that body into the HTML it sends; the browser app
 * still renders itself and swaps the snapshot out (client/src/prerenderSwap.ts).
 *
 * Never fatal by default: if Chromium is missing or a page fails, that page is
 * simply served as before (empty shell). PRERENDER_STRICT=1 makes failures exit 1.
 * SKIP_PRERENDER=1 skips the step (for quick local builds).
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(root, "dist/prerender");
const STRICT = process.env.PRERENDER_STRICT === "1";
const CONCURRENCY = Math.max(1, Number(process.env.PRERENDER_CONCURRENCY || 4));

function log(msg) {
  console.log(`[prerender] ${msg}`);
}

function done(code, msg) {
  if (msg) log(msg);
  process.exit(STRICT ? code : 0);
}

if (process.env.SKIP_PRERENDER === "1") done(0, "SKIP_PRERENDER=1, skipping");
if (!existsSync(path.join(root, "dist/index.js")) || !existsSync(path.join(root, "dist/public/index.html"))) {
  done(1, "dist/ is missing; run the build first");
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  done(1, "playwright is not installed; pages will be served without prerendered HTML");
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const port = Number(process.env.PRERENDER_PORT) || (await freePort());
const base = `http://127.0.0.1:${port}`;

// A minimal environment on purpose: no DATABASE_URL, no Zoho or vendor credentials,
// so the throwaway server cannot touch production data or run replay workers.
const env = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE,
  NODE_ENV: "production",
  PORT: String(port),
  HOST: "127.0.0.1",
  JWT_SECRET: randomBytes(32).toString("hex"),
  MFA_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  DE_SMOKE_ALLOW_MEMORY_ONLY: "1",
  DE_PRERENDER: "1",
};

// Start from an empty output folder so a stale snapshot can never be served for a page that failed.
rmSync(OUT, { recursive: true, force: true });

const server = spawn(process.execPath, ["dist/index.js"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog = (serverLog + d).slice(-4000)));
server.stderr.on("data", (d) => (serverLog = (serverLog + d).slice(-4000)));
const stopServer = () => {
  try {
    server.kill();
  } catch {}
};
process.on("exit", stopServer);

// Ready when the shell is served. Not /healthz: it reports 503 without a database,
// and this server runs without one on purpose.
let ready = false;
for (let i = 0; i < 120 && !ready; i++) {
  if (server.exitCode !== null) break;
  try {
    const res = await fetch(`${base}/`);
    ready = res.ok;
  } catch {}
  if (!ready) await new Promise((r) => setTimeout(r, 1000));
}
if (!ready) {
  console.error(serverLog);
  stopServer();
  done(1, "the built server did not become healthy; skipping prerender");
}

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
} catch (error) {
  stopServer();
  done(1, `Chromium is not available (${String(error.message).split("\n")[0]}); skipping prerender`);
}

const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
// Third-party embeds (Zoho, analytics, fonts CDN) are not part of the page's own HTML.
await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
// No cookie banner in the snapshot: record a "necessary only" choice before any page loads.
await context.addInitScript(() => {
  try {
    localStorage.setItem(
      "de_cookie_consent_v2",
      JSON.stringify({ analytics: false, marketing: false, timestamp: new Date().toISOString() }),
    );
    localStorage.setItem("de_cookie_consent", "rejected");
  } catch {}
});

const routes = prerenderRoutes();
mkdirSync(OUT, { recursive: true });

const manifest = {};
const failures = [];

async function capture(route) {
  const page = await context.newPage();
  try {
    const res = await page.goto(base + route, { waitUntil: "load", timeout: 45_000 });
    if (!res || res.status() !== 200) throw new Error(`HTTP ${res ? res.status() : "no response"}`);
    // Lazy routes render after their chunk loads: wait for real content, not the loading skeleton.
    await page.waitForFunction(
      () => {
        const r = document.getElementById("root");
        return !!r && !!r.querySelector("h1") && !r.querySelector("[data-page-loading]");
      },
      null,
      { timeout: 30_000 },
    );
    // Let data-driven sections settle (pricing tables, reviews, insights).
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(300);
    const snap = await page.evaluate(() => {
      const r = document.getElementById("root").cloneNode(true);
      // Interactive-only or transient UI, and anything that must stay unique per document.
      r.querySelectorAll(
        "script, noscript, iframe, template, [data-page-loading], [data-prerender-skip], [role='dialog'], [aria-label='Cookie consent']",
      ).forEach((el) => el.remove());
      // The live app renders the same tree next to this one for a moment: ids and test ids
      // would be duplicated, so the snapshot carries neither.
      r.querySelectorAll("[id], [data-testid]").forEach((el) => {
        el.removeAttribute("id");
        el.removeAttribute("data-testid");
      });
      const styles = [...document.querySelectorAll('link[rel="stylesheet"][href^="/assets/"]')].map((l) =>
        l.getAttribute("href"),
      );
      return { html: r.innerHTML, styles, h1: r.querySelector("h1")?.textContent?.trim() || "" };
    });
    if (!snap.h1 || snap.html.length < 500) throw new Error("rendered page has no H1 or almost no content");
    const file = snapshotFileName(route);
    writeFileSync(path.join(OUT, file), snap.html);
    manifest[route] = { file, styles: [...new Set(snap.styles)], h1: snap.h1, bytes: snap.html.length };
  } catch (error) {
    failures.push(`${route}: ${String(error.message).split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

const started = Date.now();
const queue = [...routes];
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) await capture(queue.shift());
  }),
);
await browser.close();
stopServer();

writeFileSync(
  path.join(OUT, "manifest.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), routes: manifest }, null, 2),
);
const ok = Object.keys(manifest).length;
log(`${ok}/${routes.length} pages prerendered in ${Math.round((Date.now() - started) / 1000)}s -> dist/prerender/`);
if (failures.length) {
  log(`${failures.length} page(s) not prerendered (served as the plain shell):`);
  for (const f of failures) log(`  ${f}`);
  done(1);
}
done(0);

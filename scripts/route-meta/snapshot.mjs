import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Route metadata snapshot: what each sitemap page tells search engines.
 *
 * The site is a single-page app, so every route's HTML used to carry the same
 * <title>, description and social tags until JavaScript ran (2026-10-15 keyword
 * check: 118 sitemap URLs, one title). This script opens every sitemap URL in a
 * real browser against a running server, reads the title, description,
 * canonical, robots and og:image the page sets itself (useSEO / Helmet), and
 * records them in shared/routeMeta.json. server/routeMeta.ts puts those values
 * into index.html before it is sent. The pages stay the only source of the
 * wording; this file is a copy of it, and CI fails when the copy is stale.
 *
 * Usage (against a production build, e.g. the CI smoke server):
 *   ROUTE_META_BASE=http://127.0.0.1:3300 node scripts/route-meta/snapshot.mjs --write
 *   ROUTE_META_BASE=http://127.0.0.1:3300 node scripts/route-meta/snapshot.mjs --check
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SNAPSHOT = path.join(root, "shared/routeMeta.json");
const SITEMAP = path.join(root, "public/sitemap.xml");
const SITE = "https://digeratiexperts.com";

const mode = process.argv.includes("--write") ? "write" : process.argv.includes("--check") ? "check" : null;
if (!mode) {
  console.error("Usage: node scripts/route-meta/snapshot.mjs --write | --check");
  process.exit(2);
}
const base = (process.env.ROUTE_META_BASE || "http://127.0.0.1:3300").replace(/\/+$/, "");

function sitemapPaths(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    const p = new URL(m[1].trim()).pathname;
    return p.length > 1 ? p.replace(/\/+$/, "") : "/";
  });
}

const paths = [...new Set(sitemapPaths(readFileSync(SITEMAP, "utf8")))].sort();

// A pinned Playwright may want a browser build the machine lacks; CHROME points it at the installed one.
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
const context = await browser.newContext({ reducedMotion: "reduce" });
// Third-party embeds (Zoho, analytics) cannot change a page's own head tags; skip them for speed and determinism.
await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());

const fresh = {};
const failures = [];
try {
  for (const p of paths) {
    const page = await context.newPage();
    try {
      const res = await page.goto(base + p, { waitUntil: "load", timeout: 30_000 });
      if (!res || res.status() !== 200) throw new Error(`HTTP ${res ? res.status() : "no response"}`);
      // Lazy routes set their tags after the chunk loads: wait until the head stops changing.
      let last = "";
      for (let i = 0, stable = 0; i < 40 && stable < 3; i++) {
        await page.waitForTimeout(150);
        const now = await page.evaluate(() => document.title + "\n" + document.head.innerHTML.length);
        stable = now === last ? stable + 1 : 0;
        last = now;
      }
      fresh[p] = await page.evaluate((site) => {
        const attr = (sel, a) => document.querySelector(sel)?.getAttribute(a)?.trim() || undefined;
        const canonicals = [...document.querySelectorAll('link[rel="canonical"]')];
        const canonical = canonicals.at(-1)?.getAttribute("href") || undefined;
        return {
          title: document.title.trim(),
          description: attr('meta[name="description"]', "content"),
          canonical: canonical?.startsWith(site) ? canonical.slice(site.length) || "/" : canonical,
          robots: attr('meta[name="robots"]', "content"),
          ogImage: attr('meta[property="og:image"]', "content"),
        };
      }, SITE);
    } catch (err) {
      failures.push(`${p}: ${err.message}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`route-meta: ${failures.length} page(s) could not be read:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}

const json = JSON.stringify(fresh, null, 2) + "\n";
if (mode === "write") {
  writeFileSync(SNAPSHOT, json);
  console.log(`route-meta: wrote ${Object.keys(fresh).length} routes to shared/routeMeta.json`);
} else {
  let saved = {};
  try {
    saved = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  } catch {
    // Missing or unreadable file: every route is reported as changed below.
  }
  const changed = [];
  for (const p of new Set([...Object.keys(saved), ...Object.keys(fresh)])) {
    if (JSON.stringify(saved[p]) === JSON.stringify(fresh[p])) continue;
    changed.push(`${p}\n    saved: ${JSON.stringify(saved[p])}\n    page:  ${JSON.stringify(fresh[p])}`);
  }
  if (changed.length) {
    console.error(
      `route-meta: shared/routeMeta.json is out of date for ${changed.length} route(s):\n  ${changed.join("\n  ")}\n` +
        "Rebuild, start the server, then run: ROUTE_META_BASE=http://127.0.0.1:3300 npm run route-meta:write",
    );
    process.exit(1);
  }
  console.log(`route-meta: shared/routeMeta.json matches all ${paths.length} sitemap routes`);
}

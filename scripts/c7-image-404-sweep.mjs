#!/usr/bin/env node
/**
 * C7 acceptance: route sweep with image request collector.
 * Zero 404 image requests expected across the listed marketing/store routes.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3300 node scripts/c7-image-404-sweep.mjs
 *   OUT=qa/c7-cleanup/image-404-sweep.json ...
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = (process.env.BASE_URL || "http://127.0.0.1:3300").replace(/\/$/, "");
const OUT = process.env.OUT || path.join(ROOT, "qa/c7-cleanup/image-404-sweep.json");

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif|ico)(\?|$)/i;

function blogSlugs() {
  const p = path.join(ROOT, "client/src/data/resourceRegistry.v2.json");
  const j = JSON.parse(readFileSync(p, "utf8"));
  return (j.blogs || []).map((b) => b.slug).filter(Boolean);
}

function categories() {
  return [
    "comanaged_subscriptions",
    "digital_assessments",
    "digital_templates",
    "digital_training",
    "networking_managed",
    "networking_projects",
    "hardware_provisioning",
    "ucaas_subscriptions",
    "ucaas_setup",
    "contract_services",
    "professional_services",
    "comanaged_onboarding",
    "hardware_handling",
    "hardware_physical",
  ];
}

function outcomes() {
  return ["protect", "recover", "communicate", "operate", "compliance"];
}

function buildRoutes() {
  const blogs = blogSlugs();
  const cats = categories();
  const outs = outcomes();
  const locations = [
    "chandler-az",
    "phoenix-az",
    "gilbert-az",
    "tempe-az",
    "mesa-az",
    "scottsdale-az",
  ];
  const industries = [
    "healthcare",
    "accounting-finance",
    "law-firms",
    "real-estate",
    "nonprofits",
    "animal-hospitals",
  ];
  const productSkus = [
    "DE-SVC-MGD-OFFICE-MO",
    "DE-SVC-CM-ENDPOINT-EDR-MO",
    "DE-DIG-ASMT-CSRA-OT",
  ];

  const routes = new Set([
    "/",
    "/store",
    "/store?catalog=full",
    "/resources/videos",
    "/about/team",
    "/resources/blog",
  ]);

  for (const c of cats) routes.add(`/store?category=${c}`);
  for (const o of outs) routes.add(`/store?outcome=${o}`);
  // Public warehouse deep-links used by StoreLanding category/outcome cards
  for (const c of cats.slice(0, 6)) {
    routes.add(`/internal/warehouse/co-managed?category=${c}`);
  }
  for (const o of outs) {
    routes.add(`/internal/warehouse/co-managed?outcome=${o}`);
  }
  for (const sku of productSkus) {
    routes.add(`/internal/warehouse/product/${sku}`);
  }
  for (const ind of industries) routes.add(`/industries/${ind}`);
  for (const loc of locations) routes.add(`/locations/${loc}`);
  for (const slug of blogs.slice(0, 3)) {
    routes.add(`/resources/blog/${slug}`);
  }

  return [...routes];
}

const viewports = [
  { n: 390, w: 390, h: 844, mobile: true },
  { n: 1440, w: 1440, h: 900, mobile: false },
];

mkdirSync(path.dirname(OUT), { recursive: true });

const report = {
  at: new Date().toISOString(),
  base: BASE,
  routes: buildRoutes(),
  viewports: viewports.map((v) => v.n),
  entries: [],
  image404s: [],
  summary: {},
};

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  headless: true,
});

for (const route of report.routes) {
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    const image404s = [];
    const otherFails = [];

    page.on("response", (res) => {
      try {
        const url = res.url();
        const status = res.status();
        if (status < 400) return;
        const rt = res.request().resourceType();
        const isImg =
          rt === "image" || IMAGE_EXT.test(url) || /\/images\//.test(url) || /\/assets\//.test(url);
        if (isImg) {
          image404s.push({ url, status, resourceType: rt });
        } else if (status === 404) {
          otherFails.push({ url: url.slice(0, 180), status, resourceType: rt });
        }
      } catch {
        /* ignore closed-response races */
      }
    });

    const entry = { route, vp: vp.n };
    try {
      const resp = await page.goto(BASE + route, {
        waitUntil: "networkidle",
        timeout: 45000,
      });
      entry.status = resp?.status() ?? null;
      entry.final = page.url().replace(BASE, "");
      await page.waitForTimeout(500);
      // Broken <img> elements (naturalWidth 0)
      entry.brokenImgEls = await page.evaluate(() =>
        [...document.images]
          .filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith("data:"))
          .map((i) => i.currentSrc || i.src)
          .slice(0, 20),
      );
    } catch (e) {
      entry.error = String(e).slice(0, 200);
    }

    entry.image404s = image404s;
    entry.other404s = otherFails.slice(0, 10);
    entry.image404Count = image404s.length;
    report.entries.push(entry);
    for (const row of image404s) {
      report.image404s.push({ route, vp: vp.n, ...row });
    }

    const flag =
      (entry.image404Count ? ` img404=${entry.image404Count}` : "") +
      (entry.brokenImgEls?.length ? ` brokenEl=${entry.brokenImgEls.length}` : "") +
      (entry.error ? " ERROR" : "");
    console.log(`${route}@${vp.n} ${entry.status ?? "-"}${flag}`);
    await ctx.close();
  }
}

await browser.close();

const totalImg404 = report.image404s.length;
const brokenEls = report.entries.reduce((n, e) => n + (e.brokenImgEls?.length || 0), 0);
// Acceptance (REVIEW C4): zero HTTP 404 image requests. brokenImgEls is diagnostic
// only (lazy/timing races under SPA shells can false-positive).
report.summary = {
  routes: report.routes.length,
  entries: report.entries.length,
  image404Count: totalImg404,
  brokenImgElementCount: brokenEls,
  pass: totalImg404 === 0,
};

writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
console.log(`wrote ${OUT}`);
process.exit(report.summary.pass ? 0 : 1);

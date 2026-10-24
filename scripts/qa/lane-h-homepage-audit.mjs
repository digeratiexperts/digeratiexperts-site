#!/usr/bin/env node
/**
 * Lane H homepage audit (docs/plans/opencode/lane-h-homepage.md).
 *
 * Renders the homepage at 390 / 768 / 1024 / 1280 / 1440 and records:
 *   - horizontal overflow (measured, per width)
 *   - first-viewport fit of the hero (assessment card, CTA, reassurance) at 1280/1440
 *   - floating-layer overlap (cookie banner, Ask DE, bottom bar, sticky CTA) with
 *     the hero's interactive controls
 *   - a viewport shot per section id at every width (no 30k-px full-page images)
 *
 * Usage:
 *   node scripts/qa/lane-h-homepage-audit.mjs --base=http://127.0.0.1:8080 --out=artifacts/visual-qa/lane-h-homepage/after
 *   node scripts/qa/lane-h-homepage-audit.mjs --base=https://digeratiexperts.com --out=artifacts/visual-qa/lane-h-homepage/before
 *
 * The cookie banner is dismissed before the content shots; the overlap pass runs
 * first, with the banner on screen, because that is the state a visitor sees.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const base = arg("base", "http://127.0.0.1:8080").replace(/\/+$/, "");
const outDir = path.resolve(arg("out", "artifacts/visual-qa/lane-h-homepage/audit"));
mkdirSync(outDir, { recursive: true });

const WIDTHS = [390, 768, 1024, 1280, 1440];
const SECTIONS = [
  "hero", "stats", "challenges", "services", "pricing", "protection",
  "insights", "industries", "testimonials", "faq", "cta",
];

const report = { base, when: new Date().toISOString(), widths: {} };

const browser = await chromium.launch();

function overlaps(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

for (const width of WIDTHS) {
  const height = width >= 1280 ? 900 : width >= 1024 ? 800 : 844;
  const ctx = await browser.newContext({
    viewport: { width, height },
    isMobile: width <= 430,
    hasTouch: width <= 430,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // --- pass 1: floating layers as a visitor first sees them (cookie banner on) ---
  const layers = await page.evaluate(() => {
    const rectOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };
    const vis = (el) => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
    const q = (sel) => rectOf(vis(document.querySelector(sel)) ? document.querySelector(sel) : null);
    return {
      cookieBanner: q('[class*="cookie" i][class*="banner" i], [data-testid*="cookie" i]'),
      askDe: q('[data-testid="button-open-asap-widget"]'),
      bottomBar: q('[data-testid*="bottom-bar"], nav[aria-label*="bottom" i]'),
      stickyCta: q('[data-testid="sticky-cta-bar"]'),
      heroSchedule: q('[data-testid="button-hero-schedule"]'),
      heroPricing: q('[data-testid="button-hero-pricing"]'),
      assessmentCard: q('[data-testid="hero-assessment-card"]'),
      pronunciation: q('[data-testid="digerati-pronunciation-card"]'),
    };
  });
  const collisions = [];
  for (const [layerName, layer] of Object.entries(layers)) {
    if (!layer || ["heroSchedule", "heroPricing", "assessmentCard", "pronunciation"].includes(layerName)) continue;
    for (const [targetName, target] of Object.entries(layers)) {
      if (!target || !["heroSchedule", "heroPricing", "assessmentCard", "pronunciation"].includes(targetName)) continue;
      if (overlaps(layer, target)) collisions.push(`${layerName} overlaps ${targetName}`);
    }
  }

  await page.screenshot({ path: path.join(outDir, `${width}-00-arrival.jpg`), type: "jpeg", quality: 80 });

  // --- dismiss the cookie banner for the content shots ---
  for (const label of ["Accept All", "Reject All", "Accept all"]) {
    const btn = page.getByRole("button", { name: label, exact: true }).first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      break;
    }
  }
  await page.waitForTimeout(600);

  // --- overflow ---
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const over = doc.scrollWidth > window.innerWidth + 1;
    const offenders = [];
    if (over) {
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
          offenders.push(`${el.tagName.toLowerCase()}.${String(el.className || "").split(" ").slice(0, 3).join(".")}`);
          if (offenders.length > 6) break;
        }
      }
    }
    return { scrollWidth: doc.scrollWidth, innerWidth: window.innerWidth, over, offenders };
  });

  // --- hero first-viewport fit ---
  const fold = await page.evaluate(() => {
    const rectOf = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
    };
    return {
      viewportH: window.innerHeight,
      card: rectOf('[data-testid="hero-assessment-card"]'),
      cta: rectOf('[data-testid="button-hero-schedule"]'),
      checks: rectOf(".hero__checks") || rectOf(".hero__meta"),
    };
  });

  await page.screenshot({ path: path.join(outDir, `${width}-01-hero-fold.jpg`), type: "jpeg", quality: 80 });

  // --- one viewport shot per section id ---
  const found = [];
  for (const id of SECTIONS) {
    const el = page.locator(`#${id}`).first();
    if (!(await el.count())) {
      console.log(`${width}  #${id}   [id not found]`);
      continue;
    }
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    const name = `${width}-${String(found.length + 1).padStart(2, "0")}-${id}.jpg`;
    await page.screenshot({ path: path.join(outDir, name), type: "jpeg", quality: 80 });
    found.push(id);
    console.log(`${width}  ${name}`);
  }

  report.widths[width] = { overflow, fold, collisions, layers, sectionShots: found, pageErrors: errors };
  console.log(
    `${width}  overflow=${overflow.over ? `YES (${overflow.scrollWidth}>${overflow.innerWidth}) ${overflow.offenders.join(", ")}` : "none"}` +
      `  fold: card=${fold.card ? `${fold.card.top}..${fold.card.bottom}` : "n/a"} cta=${fold.cta ? `${fold.cta.top}..${fold.cta.bottom}` : "n/a"} vh=${fold.viewportH}` +
      (collisions.length ? `  COLLISIONS: ${collisions.join("; ")}` : ""),
  );

  await ctx.close();
}

await browser.close();
writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(`\nreport: ${path.join(outDir, "report.json")}`);

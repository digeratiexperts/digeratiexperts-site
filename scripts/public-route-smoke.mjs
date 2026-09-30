import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

/**
 * Smoke-test indexable marketing routes against a running server.
 * Includes rendered homepage/Ask DE/resources regression checks at 390 / 768 / 1440.
 * Usage: BASE_URL=http://127.0.0.1:3300 node scripts/public-route-smoke.mjs
 */
const BASE = process.env.BASE_URL || "http://127.0.0.1:3300";

const routes = [
  "/",
  "/solutions",
  "/solutions/proactive-it-ecosystem",
  "/solutions/proactive-office-ecosystem",
  "/solutions/proactive-business-ecosystem",
  "/solutions/proactive-enterprise-ecosystem",
  "/solutions/co-managed-it",
  "/solutions/standalone-services",
  "/solutions/managed-it-support",
  "/proactive-ecosystem-pricing",
  "/pricing",
  "/book",
  "/industries/healthcare",
  "/industries/law-firms",
  "/resources",
  "/resources/case-studies",
  "/resources/case-studies/healthcare-hipaa-readiness",
  "/resources/blog",
  "/resources/security-updates",
  "/about/client-bill-of-rights",
  "/trust",
  "/trust/trust-center",
  "/contact",
  "/store",
  "/about/press",
];

const fails = [];

for (const path of routes) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    // SPA client redirects may return 200 with shell; allow 3xx for /trust shorthand
    if (res.status >= 400) {
      fails.push(`${path} → HTTP ${res.status}`);
      continue;
    }
    const html = await res.text();
    if (/Something went wrong/i.test(html) && /ErrorBoundary|Try again/i.test(html)) {
      fails.push(`${path} → ErrorBoundary content`);
    }
    if (!/<h1[\s>]/i.test(html) && path !== "/") {
      // SPA shell may omit H1 until hydrate — warn only for empty shells without root
      if (!/<div id="root"/i.test(html)) fails.push(`${path} → missing root`);
    }
  } catch (err) {
    fails.push(`${path} → ${err.message}`);
  }
}

// API: Google reviews (soft trust — unconfigured is OK)
{
  try {
    const res = await fetch(`${BASE}/api/google-reviews`);
    if (!res.ok) fails.push(`/api/google-reviews → HTTP ${res.status}`);
    else {
      const data = await res.json();
      if (!data || !["ok", "unconfigured", "empty", "error"].includes(data.status)) {
        fails.push(`/api/google-reviews → unexpected payload`);
      }
    }
  } catch (err) {
    fails.push(`/api/google-reviews → ${err.message}`);
  }
}

{
  const publicStore = await fetch(`${BASE}/store`, { redirect: "manual" });
  if (publicStore.status !== 200) fails.push(`/store → expected public Store 200, got ${publicStore.status}`);

  const warehouse = await fetch(`${BASE}/internal/warehouse`, { redirect: "manual" });
  const staffSku = await fetch(`${BASE}/store/product/DE-SVC-CM-ENDPOINT-EDR-MO`, {
    redirect: "manual",
  });
  const unknownSku = await fetch(`${BASE}/store/product/not-a-real-sku`, { redirect: "manual" });
  if (warehouse.status !== 404) fails.push(`/internal/warehouse → expected 404, got ${warehouse.status}`);
  if (staffSku.status !== 404 || unknownSku.status !== 404) {
    fails.push(`legacy SKU destage → expected generic 404s, got ${staffSku.status}/${unknownSku.status}`);
  }
  if (warehouse.headers.get("location") || staffSku.headers.get("location")) {
    fails.push(`warehouse denial leaked Location`);
  }
}

// Legacy junk must be Gone
{
  const res = await fetch(`${BASE}/?bbp_search=ethos`, { redirect: "manual" });
  if (res.status !== 410) fails.push(`/?bbp_search= → expected 410, got ${res.status}`);
}

// Internal commercial tools must not be indexable
{
  try {
    const robots = await fetch(`${BASE}/robots.txt`);
    const robotsText = await robots.text();
    if (!/Disallow:\s*\/official-network-planner/i.test(robotsText)) {
      fails.push(`robots.txt → missing Disallow /official-network-planner`);
    }
    if (!/Disallow:\s*\/de-ecosystem-matrix-offical/i.test(robotsText)) {
      fails.push(`robots.txt → missing Disallow /de-ecosystem-matrix-offical`);
    }

    const planner = await fetch(`${BASE}/official-network-planner`, { redirect: "manual" });
    const robotsTag = planner.headers.get("x-robots-tag") || "";
    // Production may 302 to portal login; local/dev may 200 with X-Robots-Tag
    if (planner.status === 200 && !/noindex/i.test(robotsTag)) {
      fails.push(`/official-network-planner → missing X-Robots-Tag noindex (got status ${planner.status})`);
    }
    if (planner.status >= 400 && planner.status !== 401 && planner.status !== 403) {
      fails.push(`/official-network-planner → unexpected HTTP ${planner.status}`);
    }
  } catch (err) {
    fails.push(`internal-tool checks → ${err.message}`);
  }
}

// Render the real homepage at the required DE visual-review widths, exercise
// the single-pane Ask DE chooser, and verify the recovered pronunciation and
// resources flipbook surfaces. This is intentionally part of the canonical
// smoke gate so a later merge cannot silently restore source-correct but
// visually broken public UI.
{
  const widths = [390, 768, 1440];
  const screenshotDir = "tmp/public-visual-smoke";
  await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    for (const width of widths) {
      const height = width === 390 ? 844 : width === 768 ? 1024 : 900;
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      try {
        await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(250);

        const h1 = page.locator("h1").first();
        await h1.waitFor({ state: "visible", timeout: 10_000 });
        const headline = ((await h1.textContent()) || "").replace(/\s+/g, " ").trim();
        if (!headline.includes("Cybersecurity-First IT That Powers") || !headline.includes("Your Business")) {
          fails.push(`homepage ${width}px → unexpected H1: ${headline}`);
        }

        for (const testId of [
          "button-hero-schedule",
          "button-hero-pricing",
          "digerati-pronunciation-card",
          "button-play-digerati-pronunciation",
          "button-open-asap-widget",
        ]) {
          await page.locator(`[data-testid="${testId}"]`).waitFor({ state: "visible", timeout: 10_000 });
        }

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 2) fails.push(`homepage ${width}px → horizontal overflow ${overflow}px`);
        await page.screenshot({ path: `${screenshotDir}/homepage-${width}.png`, fullPage: true });

        await page.locator('[data-testid="button-open-asap-widget"]').click({ force: true });
        const chooser = page.locator('[data-testid="ask-de-quick-menu"]');
        await chooser.waitFor({ state: "visible", timeout: 5_000 });

        for (const testId of [
          "ask-de-choice-support",
          "ask-de-choice-help",
          "ask-de-choice-tools",
          "ask-de-choice-feedback",
        ]) {
          await page.locator(`[data-testid="${testId}"]`).waitFor({ state: "visible", timeout: 5_000 });
        }

        const chooserBox = await chooser.boundingBox();
        if (!chooserBox) {
          fails.push(`Ask DE ${width}px → chooser has no rendered box`);
        } else if (chooserBox.x < -1 || chooserBox.x + chooserBox.width > width + 1) {
          fails.push(`Ask DE ${width}px → chooser clips viewport`);
        }
        await page.screenshot({ path: `${screenshotDir}/ask-de-chooser-${width}.png`, fullPage: false });

        await page.locator('[data-testid="ask-de-choice-support"]').click({ force: true });
        await page.locator(".de-desk-shell").first().waitFor({ state: "visible", timeout: 7_500 });
        const deskOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (deskOverflow > 2) fails.push(`support desk ${width}px → horizontal overflow ${deskOverflow}px`);
        await page.screenshot({ path: `${screenshotDir}/support-desk-${width}.png`, fullPage: false });

        await page.goto(`${BASE}/resources#document-flipbook`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        const flipbookTitle = page.locator("#document-flipbook-title");
        await flipbookTitle.waitFor({ state: "visible", timeout: 10_000 });
        await page.getByRole("button", { name: "Choose document" }).waitFor({ state: "visible", timeout: 10_000 });
        await flipbookTitle.scrollIntoViewIfNeeded();
        const resourcesOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (resourcesOverflow > 2) fails.push(`resources flipbook ${width}px → horizontal overflow ${resourcesOverflow}px`);
        await page.screenshot({ path: `${screenshotDir}/resources-flipbook-${width}.png`, fullPage: false });

        if (pageErrors.length) fails.push(`public UI ${width}px → page errors: ${pageErrors.join(" | ")}`);
      } catch (err) {
        fails.push(`homepage/Ask DE/resources ${width}px → ${err.message}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

if (fails.length) {
  console.error("Public route smoke FAILED:");
  for (const f of fails) console.error(" -", f);
  process.exit(1);
}
console.log(
  `Public route smoke OK (${routes.length} routes + google-reviews + bbp_search 410 + internal-tool noindex + rendered homepage/Ask DE/resources 390/768/1440) against ${BASE}`,
);

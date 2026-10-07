#!/usr/bin/env node
/**
 * Read-only check of the live client portal with a test client account
 * (Joe, 2026-10-02, answer "3. a": a read-only test client login on
 * production, credentials added as environment secrets).
 *
 *   PORTAL_QA_EMAIL / PORTAL_QA_PASSWORD   the test account (never committed)
 *   PORTAL_QA_TOKEN                        optional fallback: the `portalAuth`
 *                                          cookie value from a browser signed
 *                                          in as the test account
 *   PORTAL_QA_BASE                         default https://digeratiexperts.com
 *   AXE_PATH                               optional path to axe-core's axe.min.js
 *
 * Signs in through the real login page (Cloudflare Turnstile stays on; this
 * script never bypasses it). If Turnstile does not pass an automated browser,
 * set PORTAL_QA_TOKEN instead. Then visits each portal route with GET only,
 * screenshots it at 390 and 1440, and reports page errors, failed requests,
 * horizontal overflow and (with AXE_PATH) WCAG 2.1 AA violations. Nothing is
 * created, changed or submitted.
 *
 * usage: node scripts/qa/portal-prod-check.mjs [outDir]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.PORTAL_QA_BASE || "https://digeratiexperts.com").replace(/\/$/, "");
const EMAIL = process.env.PORTAL_QA_EMAIL || "";
const PASSWORD = process.env.PORTAL_QA_PASSWORD || "";
const TOKEN = process.env.PORTAL_QA_TOKEN || "";
const AXE = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, "utf8") : null;
const OUT = process.argv[2] || "artifacts/visual-qa/portal-prod-check";
// Pinned Chromium path for sandboxes that ship one (/opt/pw-browsers). Anywhere
// else, including GitHub-hosted runners after `npx playwright install chromium`,
// this stays undefined and Playwright uses its own downloaded browser.
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

const ROUTES = [
  "/portal/dashboard", "/portal/tickets", "/portal/tickets/create", "/portal/forms", "/portal/infrastructure",
  "/portal/approvals", "/portal/kb", "/portal/company", "/portal/people", "/portal/contracts", "/portal/files",
  "/portal/billing", "/portal/invoices", "/portal/services", "/portal/orders", "/portal/questionnaires",
  "/portal/surveys", "/portal/learning", "/portal/roadmap", "/portal/qbr", "/portal/marketplace",
  "/portal/vpn", "/portal/cytracom", "/portal/ship-center", "/portal/agent", "/portal/status", "/portal/settings",
];

if (!TOKEN && !(EMAIL && PASSWORD)) {
  console.error("Set PORTAL_QA_EMAIL and PORTAL_QA_PASSWORD (or PORTAL_QA_TOKEN) in the environment.");
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
const host = new URL(BASE).hostname;

async function signIn() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (TOKEN) {
    await ctx.addCookies([{ name: "portalAuth", value: TOKEN, domain: host, path: "/", secure: true, httpOnly: true }]);
    return ctx;
  }
  const page = await ctx.newPage();
  await page.goto(`${BASE}/portal/login`, { waitUntil: "networkidle" });
  await page.fill('[data-testid="input-email"]', EMAIL);
  await page.fill('[data-testid="input-password"]', PASSWORD);
  // Turnstile fills a hidden cf-turnstile-response input when it passes.
  await page
    .waitForFunction(() => {
      const el = document.querySelector('input[name="cf-turnstile-response"]');
      if (el) return el instanceof HTMLInputElement && el.value.length > 0;
      // Widget mounted but its hidden input not injected yet: keep waiting.
      // No widget at all (test site key): nothing to wait for.
      return !document.querySelector('[data-testid="turnstile-widget"]');
    }, null, { timeout: 30_000 })
    .catch(() => {});
  await page.click('[data-testid="button-login"]');
  await page.waitForURL(/\/portal\/(dashboard|tickets|mfa|verify)/, { timeout: 30_000 }).catch(() => {});
  if (!/\/portal\/dashboard|\/portal\/tickets/.test(page.url())) {
    await page.screenshot({ path: path.join(OUT, "login-failed.png") });
    throw new Error(`Sign-in did not reach the dashboard (now at ${page.url()}). If Turnstile blocked the automated browser, set PORTAL_QA_TOKEN.`);
  }
  await page.close();
  return ctx;
}

const issues = [];
const summary = [];
const auth = await signIn();
const state = await auth.storageState();
await auth.close();

for (const width of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, storageState: state });
  const page = await ctx.newPage();
  // Read-only: refuse anything but GET/HEAD/OPTIONS from the page.
  await page.route("**/*", (route) =>
    ["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort(),
  );
  page.on("pageerror", (e) => issues.push({ width, route: page.url(), kind: "pageerror", detail: String(e).slice(0, 200) }));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(BASE)) issues.push({ width, route: page.url(), kind: `http ${r.status()}`, detail: r.url().replace(BASE, "") });
  });
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(800);
    const name = route.replace(/^\/portal\/?/, "").replace(/\//g, "_") || "root";
    await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) issues.push({ width, route, kind: "overflow", detail: "horizontal scroll" });
    let axe = null;
    if (AXE) {
      await page.addScriptTag({ content: AXE });
      axe = await page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
        return r.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }));
      });
      for (const v of axe) issues.push({ width, route, kind: `axe ${v.id}`, detail: `${v.nodes} node(s)` });
    }
    summary.push({ width, route, axeViolations: axe ? axe.length : "n/a" });
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), summary, issues }, null, 2));
console.log(`${summary.length} page views, ${issues.length} issues. Report: ${path.join(OUT, "report.json")}`);
for (const i of issues.slice(0, 40)) console.log(` - [${i.width}] ${i.route} ${i.kind}: ${i.detail}`);
process.exit(issues.some((i) => i.kind === "pageerror" || i.kind.startsWith("http 5")) ? 1 : 0);

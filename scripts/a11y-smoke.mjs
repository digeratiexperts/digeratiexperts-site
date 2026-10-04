import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Accessibility smoke: runs axe-core (WCAG 2.0/2.1/2.2 A + AA rules) against a
 * running server on one representative route per surface (website, Store,
 * Client Portal entry, blog) at 390 and 1440.
 *
 * Gate: any violation with impact "critical" fails the run. Everything else
 * ("serious", "moderate", "minor") is reported, and written to the JSON
 * report, but does not fail CI yet. Tighten A11Y_FAIL_ON to "serious" once
 * the reported backlog is cleared (docs/CONTENT-TOOLING-PLAN.md, step 1).
 *
 * Usage: A11Y_BASE=http://127.0.0.1:3300 node scripts/a11y-smoke.mjs
 */

const base = process.env.A11Y_BASE || "http://127.0.0.1:3300";
const outDir = process.env.A11Y_OUT || "tmp/a11y-qa";
const failOn = (process.env.A11Y_FAIL_ON || "critical").split(",").map((s) => s.trim());
mkdirSync(outDir, { recursive: true });

const routes = [
  "/",
  "/solutions/managed-it-support",
  "/pricing",
  "/contact",
  "/resources/blog",
  "/store",
  "/portal/login",
];

const viewports = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
];

// A pinned Playwright may want a browser build the machine lacks; CHROME points it at the installed one.
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
const report = [];
const failures = [];

try {
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 45_000 });
      await page.waitForSelector("main, [role='main'], h1", { timeout: 15_000 }).catch(() => {});
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      for (const v of violations) {
        const entry = {
          route,
          viewport: vp.name,
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.length,
          targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
        };
        report.push(entry);
        if (failOn.includes(v.impact)) failures.push(entry);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(`${outDir}/a11y-report.json`, JSON.stringify(report, null, 2));

const byImpact = report.reduce((acc, v) => ((acc[v.impact] = (acc[v.impact] || 0) + 1), acc), {});
console.log(`axe: ${report.length} violation groups across ${routes.length} routes x ${viewports.length} viewports`, byImpact);
for (const v of report) {
  console.log(`  [${v.impact}] ${v.route} @${v.viewport} ${v.id} (${v.nodes} nodes): ${v.help}`);
}

if (failures.length) {
  console.error(`Accessibility smoke FAILED: ${failures.length} violation group(s) at impact ${failOn.join("/")}`);
  process.exit(1);
}
console.log(`Accessibility smoke OK (gate: ${failOn.join("/")}) against ${base}`);

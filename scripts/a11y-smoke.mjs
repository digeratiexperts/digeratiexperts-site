import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { APP_ENTRY_ROUTES, PUBLIC_ROUTES } from "./public-routes.mjs";

/**
 * Accessibility smoke: runs axe-core (WCAG 2.0/2.1/2.2 A + AA rules) against a
 * running server on every public marketing route plus the Store, quote wizard
 * and Client Portal entry pages (scripts/public-routes.mjs), at 390 and 1440.
 *
 * Gate: any violation with impact "critical" or "serious" fails the run;
 * "moderate" and "minor" are reported and written to the JSON report.
 *
 * The page is scanned settled, with prefers-reduced-motion: reduce. With
 * motion on, axe reads scroll-reveal text mid-fade (and reads opacity on
 * `display: contents` wrappers the browser never paints), which produced 6
 * "serious" color-contrast groups that no visitor sees. Measured 2026-10-05:
 * reduced motion 0 violations; motion on, every section scrolled into view
 * and settled, only the display:contents artefact remained.
 *
 * Cross-origin iframes (the Zoho Bookings calendar on /book, from
 * meet.digerati-experts.com) are third-party code DE cannot change. They are
 * excluded from the gated scan and scanned separately, report-only, so their
 * issues stay visible without blocking DE's own pages. CI on 2026-10-05
 * reported 6 critical aria-required-attr nodes on /book that a run without
 * the calendar (blocked network) did not; that is the vendor embed.
 *
 * Usage: A11Y_BASE=http://127.0.0.1:3300 node scripts/a11y-smoke.mjs
 */

const base = process.env.A11Y_BASE || "http://127.0.0.1:3300";
const outDir = process.env.A11Y_OUT || "tmp/a11y-qa";
const failOn = (process.env.A11Y_FAIL_ON || "critical,serious").split(",").map((s) => s.trim());
mkdirSync(outDir, { recursive: true });

const routes = [...PUBLIC_ROUTES, ...APP_ENTRY_ROUTES];

const viewports = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
];

// A pinned Playwright may want a browser build the machine lacks; CHROME points it at the installed one.
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const report = [];
const failures = [];
const thirdPartyReport = [];

const toEntry = (route, viewport, v) => ({
  route,
  viewport,
  id: v.id,
  impact: v.impact,
  help: v.help,
  nodes: v.nodes.length,
  targets: v.nodes.slice(0, 5).map((n) => n.target.flat().join(" >>> ")),
});

try {
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 45_000 });
      await page.waitForSelector("main, [role='main'], h1", { timeout: 15_000 }).catch(() => {});
      const thirdParty = await page.evaluate(() => {
        let n = 0;
        for (const f of document.querySelectorAll("iframe[src]")) {
          try {
            if (new URL(f.src, location.href).origin !== location.origin) {
              f.setAttribute("data-a11y-third-party", "");
              n++;
            }
          } catch {}
        }
        return n;
      });
      const builder = () => new AxeBuilder({ page }).withTags(TAGS);
      const own = await builder().exclude("[data-a11y-third-party]").analyze();
      for (const v of own.violations) {
        const entry = toEntry(route, vp.name, v);
        report.push(entry);
        if (failOn.includes(v.impact)) failures.push(entry);
      }
      if (thirdParty) {
        const vendor = await builder().include("[data-a11y-third-party]").analyze();
        for (const v of vendor.violations) thirdPartyReport.push(toEntry(route, vp.name, v));
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(`${outDir}/a11y-report.json`, JSON.stringify({ own: report, thirdParty: thirdPartyReport }, null, 2));

const byImpact = report.reduce((acc, v) => ((acc[v.impact] = (acc[v.impact] || 0) + 1), acc), {});
console.log(`axe: ${report.length} violation groups across ${routes.length} routes x ${viewports.length} viewports`, byImpact);
for (const v of report) {
  console.log(`  [${v.impact}] ${v.route} @${v.viewport} ${v.id} (${v.nodes} nodes): ${v.help}`);
  for (const t of v.targets) console.log(`      ${t}`);
}
if (thirdPartyReport.length) {
  console.log(`third-party embeds (report only, not gated): ${thirdPartyReport.length} violation groups`);
  for (const v of thirdPartyReport) {
    console.log(`  [${v.impact}] ${v.route} @${v.viewport} ${v.id} (${v.nodes} nodes): ${v.help}`);
    for (const t of v.targets) console.log(`      ${t}`);
  }
}

if (failures.length) {
  console.error(`Accessibility smoke FAILED: ${failures.length} violation group(s) at impact ${failOn.join("/")}`);
  process.exit(1);
}
console.log(`Accessibility smoke OK (gate: ${failOn.join("/")}) against ${base}`);

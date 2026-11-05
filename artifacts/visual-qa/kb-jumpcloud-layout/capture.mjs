// Visual QA for the knowledge-base docs layout (issue #960).
// Captures the public KB index and the portal KB index + one long article at
// 390 / 768 / 1440, in the portal's light and black (dark) themes, runs axe
// (WCAG 2.0/2.1/2.2 A+AA) and checks for horizontal overflow.
//
// Needs a local dev server with the development-only portal bootstrap admin:
//   PORT=5055 ENABLE_DEV_PORTAL_BOOTSTRAP=true DEV_PORTAL_ADMIN_PASSWORD_HASH=<bcrypt> npm run dev
// Usage: node artifacts/visual-qa/kb-jumpcloud-layout/capture.mjs <before|after> <baseUrl> <password>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [phase = "after", base = "http://127.0.0.1:5055", password] = process.argv.slice(2);
if (!password) throw new Error("password argument required");
const out = path.join(path.dirname(new URL(import.meta.url).pathname), phase);
mkdirSync(out, { recursive: true });
const axe = readFileSync(path.resolve("node_modules/axe-core/axe.min.js"), "utf8");
const ARTICLE = "KB0000013";
const WIDTHS = [390, 768, 1440];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ reducedMotion: "reduce" });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("de_cookie_consent_v2", JSON.stringify({ necessary: true, analytics: false, marketing: false, ts: Date.now() }));
  } catch {}
});
const page = await ctx.newPage();
const login = await page.request.post(`${base}/api/portal/login`, { data: { email: "admin@digeratiexperts.com", password } });
if (!login.ok()) throw new Error(`login ${login.status()} ${await login.text()}`);

async function audit(label) {
  const facts = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] });
    return r.violations.map((v) => ({ id: v.id, n: v.nodes.length, targets: v.nodes.slice(0, 3).map((x) => x.target.join(" ")) }));
  });
  console.log(label, facts.overflow ? `OVERFLOW ${facts.scrollWidth}` : "no-overflow", violations.map((v) => `${v.id}(${v.n})`).join(" ") || "axe clean");
  return { label, ...facts, axe: violations };
}

const results = [];
// Public index: the marketing site has one theme (dark hero, paper body).
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.goto(`${base}/support/knowledge-base`, { waitUntil: "load" });
  await page.waitForSelector("#kb-search");
  await page.waitForTimeout(1200);
  const file = `public-index-${width}.png`;
  await page.screenshot({ path: path.join(out, file), fullPage: true });
  results.push({ file, ...(await audit(file)) });
}

for (const theme of ["light", "black"]) {
  for (const [name, route] of [
    ["portal-index", "/portal/kb"],
    ["portal-article", `/portal/kb/${ARTICLE}`],
  ]) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(`${base}${route}`);
      await page.evaluate((t) => localStorage.setItem("de-portal-theme", t), theme);
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector(`.de-portal[data-theme="${theme}"] main`, { timeout: 20000 });
      if (new URL(page.url()).hostname !== new URL(base).hostname) throw new Error(`left the local server: ${page.url()}`);
      await page.waitForTimeout(1500);
      const file = `${name}-${theme}-${width}.png`;
      await page.screenshot({ path: path.join(out, file), fullPage: true });
      results.push({ file, ...(await audit(file)) });
    }
  }
}

if (phase === "after") {
  // Keyboard: the "On this page" links and the category drawer.
  const kb = {};
  await page.evaluate(() => localStorage.setItem("de-portal-theme", "light"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/portal/kb/${ARTICLE}`, { waitUntil: "load" });
  await page.waitForSelector("[data-kb-toc] a");
  const tocLinks = page.locator("[data-kb-toc] a");
  await tocLinks.nth(2).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  kb.tocHash = await page.evaluate(() => location.hash);
  kb.tocTargetInView = await page.evaluate(() => {
    const el = document.getElementById(location.hash.slice(1));
    const r = el?.getBoundingClientRect();
    return Boolean(r && r.top >= 0 && r.top < window.innerHeight / 2);
  });
  await page.waitForTimeout(300);
  kb.activeAfterJump = await page.locator("[data-kb-toc] a[aria-current='true']").first().textContent().catch(() => null);
  await page.screenshot({ path: path.join(out, "keyboard-toc-1440.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/portal/kb/${ARTICLE}`, { waitUntil: "load" });
  await page.waitForSelector("[data-kb-drawer-toggle]");
  const toggle = page.locator("[data-kb-drawer-toggle]");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  kb.drawerExpanded = await toggle.getAttribute("aria-expanded");
  kb.focusInDrawer = await page.evaluate(() => Boolean(document.activeElement?.closest("[data-kb-drawer]")));
  await page.screenshot({ path: path.join(out, "drawer-open-390.png") });
  results.push({ file: "drawer-open-390.png", ...(await audit("drawer-open-390.png")) });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  kb.drawerClosedOnEscape = (await toggle.getAttribute("aria-expanded")) === "false";
  kb.focusReturnedToToggle = await page.evaluate(() => document.activeElement?.hasAttribute("data-kb-drawer-toggle") ?? false);
  console.log("keyboard", JSON.stringify(kb));
  results.push({ keyboard: kb });

  // Retina hero shots for the PR body.
  // Same session (cookies) as above: the dev login is rate limited.
  const hi = await browser.newContext({ deviceScaleFactor: 2, reducedMotion: "reduce", storageState: await ctx.storageState() });
  const hp = await hi.newPage();
  for (const theme of ["light", "black"]) {
    await hp.setViewportSize({ width: 1440, height: 900 });
    await hp.goto(`${base}/portal/kb/${ARTICLE}`);
    await hp.evaluate((t) => localStorage.setItem("de-portal-theme", t), theme);
    await hp.reload({ waitUntil: "load" });
    await hp.waitForSelector("[data-kb-toc] a");
    await hp.waitForTimeout(600);
    await hp.screenshot({ path: path.join(out, `hero-article-${theme}-1440@2x.png`) });
  }
  await hi.close();
}

writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
await browser.close();

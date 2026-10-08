// Visual QA for DE Desk archive / delete / swipe / long-press (2026-10-08).
// usage: node qa.mjs  (dev server on :8080, dev admin login)
import { chromium } from "/home/user/digeratiexperts-site/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:8080";
const out = path.dirname(new URL(import.meta.url).pathname);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const seed = await browser.newContext();
const login = await seed.request.post(`${BASE}/api/portal/login`, {
  data: { email: "admin@digeratiexperts.com", password: "DevPortal!2026", turnstileToken: "dev-bypass-token" },
});
const body = await login.json();
if (!body.user) throw new Error("login failed: " + JSON.stringify(body));
const cookies = await seed.cookies();
await seed.close();
const report = {};

async function open(width, touch) {
  const ctx = await browser.newContext({
    viewport: { width, height: width < 700 ? 844 : 900 },
    hasTouch: touch, isMobile: touch && width < 700,
  });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/portal/login`);
  await page.evaluate((u) => {
    localStorage.setItem("portalUser", JSON.stringify(u));
    localStorage.setItem("portalUserId", u.id);
    localStorage.setItem("cookie-consent", "accepted");
  }, body.user);
  await page.goto(`${BASE}/portal/chat`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}

/** Drive a touch swipe on a row with CDP touch events, optionally pausing mid-way for a screenshot. */
async function swipe(page, locator, dx, shotAt) {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(200);
  const box = await locator.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width / 2;
  const tp = (x) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(x0) });
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(x0 + (dx * i) / steps) });
    await page.waitForTimeout(16);
  }
  if (shotAt) await page.screenshot({ path: shotAt });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(600);
}

const row = (page, name) => page.locator("aside button", { hasText: name }).first();

// 390 phone: swipe right to archive, swipe left to delete (confirm), long-press menu.
{
  const { ctx, page, errors } = await open(390, true);
  await page.screenshot({ path: `${out}/390-live.png`, fullPage: false });
  await row(page, "Dana Ruiz").scrollIntoViewIfNeeded();
  await swipe(page, row(page, "Dana Ruiz"), 160, `${out}/390-swipe-right-archive.png`);
  report.archivedBySwipe = (await row(page, "Dana Ruiz").count()) === 0;
  await page.screenshot({ path: `${out}/390-after-archive-toast.png` });

  await page.waitForTimeout(5500); // let the toast clear
  await swipe(page, row(page, "Don"), -170, `${out}/390-swipe-left-delete.png`);
  report.deleteDialog = await page.getByRole("alertdialog").isVisible();
  await page.screenshot({ path: `${out}/390-delete-confirm.png` });
  await page.getByRole("button", { name: "Cancel" }).click();

  // Long-press = right-click on touch.
  await row(page, "Sam Ortiz").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(200);
  const box = await row(page, "Sam Ortiz").boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const pt = [{ x: box.x + 60, y: box.y + 20, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${out}/390-long-press-menu.png` });
  report.longPressMenu = await page.locator("[data-desk-session-menu]").isVisible();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.locator("[data-desk-session-menu] button", { hasText: "Archive all from Bluebird Dental" }).click();
  await page.waitForTimeout(700);

  // Archive view: company folders.
  await page.getByRole("tab", { name: /Archive/ }).click();
  await page.waitForTimeout(700);
  for (const f of await page.locator("aside button[aria-expanded]").all()) await f.click();
  await page.screenshot({ path: `${out}/390-archive-folders.png`, fullPage: true });
  report.folders = await page.locator("aside button[aria-expanded]").allInnerTexts();
  report.overflowX390 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  report.errors390 = errors;
  await ctx.close();
}

// 1440 desktop: right-click menu.
for (const width of [768, 1440]) {
  const { ctx, page, errors } = await open(width, false);
  await row(page, "Lee Park").click({ button: "right" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${width}-context-menu.png` });
  report[`menu${width}`] = await page.getByRole("menuitem").allInnerTexts();
  await page.keyboard.press("Escape");
  report[`errors${width}`] = errors;
  report[`overflowX${width}`] = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

// Visual QA: starter kits + JumpCloud panel (2026-10-10). Dev server on :8080, dev admin.
import { chromium } from "/home/user/digeratiexperts-site/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:8080";
const out = path.join(path.dirname(new URL(import.meta.url).pathname), "kits");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const seed = await browser.newContext();
const body = await (await seed.request.post(`${BASE}/api/portal/login`, {
  data: { email: "admin@digeratiexperts.com", password: "DevPortal!2026", turnstileToken: "dev-bypass-token" },
})).json();
const cookies = await seed.cookies();
await seed.close();
const report = {};

async function open(width, url) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, hasTouch: width < 700, isMobile: width < 700 });
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
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  return { ctx, page, errors };
}

{
  const { ctx, page, errors } = await open(1440, "/portal/admin/license-board?company=client-1");
  await page.screenshot({ path: `${out}/1440-company-empty.png`, fullPage: true });
  const kit = page.locator("div", { hasText: /^Regular business/ }).first();
  await page.getByRole("button", { name: "Use this kit" }).first().click();
  await page.getByRole("button", { name: /Apply to Acme Corp/ }).click();
  await page.waitForTimeout(1500);
  report.kitResult = await page.locator("section[aria-label='Starter kits']").innerText();
  await page.getByLabel("JumpCloud device group id").fill("grp9a8b7c6d");
  await page.getByRole("button", { name: "Save link" }).click();
  await page.waitForTimeout(1200);
  report.jumpcloud = await page.locator("section[aria-label='JumpCloud installs']").innerText();
  report.everyMachine = await page.locator('[data-patch-card="device:device:*"]').innerText();
  await page.screenshot({ path: `${out}/1440-company-kit-applied.png`, fullPage: true });
  report.errors1440 = errors;
  report.overflow1440 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await ctx.close();
}
for (const w of [390, 768]) {
  const { ctx, page, errors } = await open(w, "/portal/admin/license-board?company=client-1");
  await page.screenshot({ path: `${out}/${w}-company.png`, fullPage: true });
  report[`overflow${w}`] = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  report[`errors${w}`] = errors;
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

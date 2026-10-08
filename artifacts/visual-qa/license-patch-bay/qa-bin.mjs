// Visual QA: parts bin, apps and "Every machine" (2026-10-08). Dev server on :8080, dev admin.
import { chromium } from "/home/user/digeratiexperts-site/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:8080";
const out = path.join(path.dirname(new URL(import.meta.url).pathname), "bin");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const seed = await browser.newContext();
const login = await seed.request.post(`${BASE}/api/portal/login`, {
  data: { email: "admin@digeratiexperts.com", password: "DevPortal!2026", turnstileToken: "dev-bypass-token" },
});
const body = await login.json();
const cookies = await seed.cookies();
await seed.close();
const report = {};

async function open(width, touch, url = "/portal/admin/license-board") {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, hasTouch: touch, isMobile: touch && width < 700 });
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
const center = async (loc) => {
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
async function drag(page, from, to) {
  await from.scrollIntoViewIfNeeded();
  const a = await center(from);
  const b = await center(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 14, a.y + ((b.y - a.y) * i) / 14);
  await page.mouse.up();
  await page.waitForTimeout(1200);
}

{
  const { ctx, page, errors } = await open(1440, false);
  await page.waitForSelector('[aria-label="Parts bin"]');
  await page.screenshot({ path: `${out}/1440-bin-productivity.png`, fullPage: true });
  // Productivity: Business Premium with 3 seats.
  const bp = page.locator("li", { hasText: "Microsoft 365 Business Premium" }).first();
  await bp.getByRole("spinbutton").fill("3");
  await bp.getByRole("button", { name: "Add", exact: false }).click();
  await page.waitForTimeout(800);
  // Baseline apps shelf.
  await page.getByRole("tab", { name: /Baseline apps/ }).click();
  await page.waitForTimeout(300);
  for (const name of ["7-Zip", "Adobe Acrobat Reader", "Google Chrome"]) {
    await page.locator("li", { hasText: name }).first().getByRole("button", { name: "Add", exact: false }).click();
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${out}/1440-bin-baseline.png`, fullPage: true });
  // A line-of-business app made by hand.
  await page.getByRole("button", { name: /Make a part/ }).click();
  await page.getByLabel("Vendor", { exact: true }).fill("Sage");
  await page.getByLabel("Product", { exact: true }).fill("Sage 100 Contractor");
  await page.locator("form", { hasText: "Make a part" }).getByRole("button", { name: "Add", exact: false }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Close bin" }).click();
  await page.waitForTimeout(500);
  // Patch 7-Zip and Sage to Acme Corp.
  await drag(page, page.getByRole("button", { name: /cable for 7-Zip/ }), page.locator('[data-patch-card="client:client-1"]'));
  await drag(page, page.getByRole("button", { name: /cable for Sage 100 Contractor/ }), page.locator('[data-patch-card="client:client-1"]'));
  await drag(page, page.getByRole("button", { name: /cable for Microsoft 365 Business Premium/ }), page.locator('[data-patch-card="client:client-1"]'));
  report.acme = await page.locator('[data-patch-card="client:client-1"]').innerText();
  await page.screenshot({ path: `${out}/1440-pool-with-apps.png`, fullPage: true });

  // Company level: 7-Zip to Every machine, Sage to John Smith, BP cannot go to Every machine.
  await page.locator('[data-patch-card="client:client-1"] button', { hasText: "Acme Corp" }).click();
  await page.waitForTimeout(1200);
  const every = page.locator('[data-patch-card="device:device:*"]');
  await drag(page, page.getByRole("button", { name: /cable for 7-Zip/ }), every);
  await drag(page, page.getByRole("button", { name: /cable for Sage 100 Contractor/ }), page.locator('[data-patch-card="user:user-001"]'));
  report.every = await every.innerText();
  report.john = await page.locator('[data-patch-card="user:user-001"]').innerText();
  // Business Premium jack: "Every machine" must not offer "Patch here".
  await page.getByRole("button", { name: /cable for Microsoft 365 Business Premium/ }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  report.bpEveryMachineTarget = await page.getByRole("button", { name: "Patch Microsoft 365 Business Premium to Every machine" }).count();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${out}/1440-company-apps.png`, fullPage: true });
  report.errors1440 = errors;
  report.overflow1440 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await ctx.close();
}
for (const [w, url, name] of [[390, "/portal/admin/license-board", "390-pool"], [390, "/portal/admin/license-board?company=client-1", "390-company"], [768, "/portal/admin/license-board", "768-pool"]]) {
  const { ctx, page, errors } = await open(w, w < 700, url);
  if (name.endsWith("pool")) {
    await page.getByRole("button", { name: /Open the parts bin/ }).click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  report[`overflow-${name}`] = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  report[`errors-${name}`] = errors;
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

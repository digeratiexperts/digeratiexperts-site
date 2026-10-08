// Visual QA: License Patch Bay (2026-10-08). Dev server on :8080 with the dev admin.
import { chromium } from "/home/user/digeratiexperts-site/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:8080";
const API = `${BASE}/api/portal/admin/license-board`;
const out = path.dirname(new URL(import.meta.url).pathname);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const seed = await browser.newContext();
const login = await seed.request.post(`${BASE}/api/portal/login`, {
  data: { email: "admin@digeratiexperts.com", password: "DevPortal!2026", turnstileToken: "dev-bypass-token" },
});
const body = await login.json();
if (!body.user) throw new Error("login failed");
const cookies = await seed.cookies();
const api = async (method, p, data) => (await seed.request.fetch(`${API}${p}`, { method, data })).json();

// Seed: three pool licences and a few seats.
const bp = (await api("POST", "/items", { catalogKey: "ms_m365_bp", quantity: 3 })).item;
const edr = (await api("POST", "/items", { vendor: "Huntress", product: "Managed EDR", quantity: 25 })).item;
const pdf = (await api("POST", "/items", { vendor: "Adobe", product: "Acrobat Pro", quantity: 0 })).item;
await api("POST", "/allocate", { itemId: bp.id, clientId: "client-1", quantity: 2 });
await api("POST", "/allocate", { itemId: edr.id, clientId: "client-1", quantity: 4 });
await api("POST", "/allocate", { itemId: edr.id, clientId: "client-5", quantity: 6 });
await api("POST", "/allocate", { itemId: pdf.id, clientId: "client-2", quantity: 2 });
await api("POST", "/clients/client-1/assign", { itemId: edr.id, targetType: "device", label: "ACME-FRONT-01" });
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

// 1440 mouse drag: Huntress → Desert Law Partners.
{
  const { ctx, page, errors } = await open(1440, false);
  await page.screenshot({ path: `${out}/1440-pool.png`, fullPage: true });
  const jack = page.getByRole("button", { name: /cable for Managed EDR/ });
  const target = page.locator('[data-patch-card="client:client-3"]');
  const a = await center(jack);
  const b = await center(target);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 15; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 15, a.y + ((b.y - a.y) * i) / 15);
  await page.screenshot({ path: `${out}/1440-dragging.png` });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  report.dragDesk = await page.locator('[data-patch-card="client:client-3"]').innerText();
  await page.screenshot({ path: `${out}/1440-after-drag.png`, fullPage: true });

  // Click-to-patch with the empty Acrobat pool → recorded to order.
  await page.getByRole("button", { name: /cable for Acrobat Pro/ }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/1440-carrying.png` });
  await page.getByRole("button", { name: "Patch Acrobat Pro to Alamo Industries" }).click();
  await page.waitForTimeout(1200);
  report.orderAlamo = await page.locator('[data-patch-card="client:client-5"]').innerText();

  // Level 2: Acme.
  await page.locator('[data-patch-card="client:client-1"] button', { hasText: "Acme Corp" }).click();
  await page.waitForTimeout(1200);
  const pj = page.getByRole("button", { name: /cable for Microsoft 365 Business Premium/ });
  const person = page.locator('[data-patch-card="user:user-001"]');
  const p1 = await center(pj);
  const p2 = await center(person);
  await page.mouse.move(p1.x, p1.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(p1.x + ((p2.x - p1.x) * i) / 12, p1.y + ((p2.y - p1.y) * i) / 12);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  report.personAfter = await person.innerText();
  await page.screenshot({ path: `${out}/1440-company.png`, fullPage: true });
  report.errors1440 = errors;
  report.overflow1440 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await ctx.close();
}

// 390 touch drag: BP → Desert Law Partners (pool has 1 left; target kept out of the auto-scroll edge).
{
  const { ctx, page, errors } = await open(390, true);
  await page.screenshot({ path: `${out}/390-pool.png`, fullPage: true });
  const jack = page.getByRole("button", { name: /cable for Microsoft 365 Business Premium/ });
  await jack.scrollIntoViewIfNeeded();
  const target = page.locator('[data-patch-card="client:client-3"]');
  const a = await center(jack);
  const b = await center(target);
  const cdp = await ctx.newCDPSession(page);
  const tp = (x, y) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(a.x, a.y) });
  for (let i = 1; i <= 15; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(a.x + ((b.x - a.x) * i) / 15, a.y + ((b.y - a.y) * i) / 15) });
    await page.waitForTimeout(16);
  }
  await page.screenshot({ path: `${out}/390-dragging.png` });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(1200);
  report.touchDrop = await target.innerText();
  report.overflow390 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  report.errors390 = errors;
  await ctx.close();
}
for (const [w, url, name] of [[768, "/portal/admin/license-board", "768-pool"], [390, "/portal/admin/license-board?company=client-1", "390-company"], [768, "/portal/admin/license-board?company=client-1", "768-company"]]) {
  const { ctx, page, errors } = await open(w, w < 700, url);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  report[`overflow-${name}`] = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  report[`errors-${name}`] = errors;
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

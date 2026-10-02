#!/usr/bin/env node
// Homepage Version 7 check: renders /version-7 on a served production build at
// 390 / 768 / 1440, captures each section, and drives the bottom-bar autohide
// with real wheel, pointer, keyboard and focus input.
//
//   npm run build
//   NODE_ENV=production DE_SMOKE_ALLOW_MEMORY_ONLY=1 JWT_SECRET=$(openssl rand -hex 32) \
//     MFA_ENCRYPTION_KEY=$(openssl rand -hex 32) SESSION_SECRET=$(openssl rand -hex 32) \
//     PORT=4177 node dist/index.js &
//   node scripts/qa/homepage-v7-check.mjs --url http://localhost:4177/version-7 --out artifacts/visual-qa/homepage-v7
//
// Exit code 1 on any failed check. Frames are for a human to look at; the
// checks cannot say whether the page reads well.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const url = opt("--url", "http://localhost:4177/version-7");
const out = path.resolve(opt("--out", "artifacts/visual-qa/homepage-v7"));
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SECTIONS = ["hero", "stats", "challenges", "services", "protection", "testimonials", "trust", "team", "industries", "pricing", "insights", "faq", "cta", "contact"];

const results = [];
let failed = 0;
const check = (label, ok, detail = "") => { results.push(`${ok ? "PASS" : "FAIL"} | ${label}${detail ? ` | ${detail}` : ""}`); if (!ok) failed++; };

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const consent = () => { try { localStorage.setItem("de_cookie_consent_v2", JSON.stringify({ necessary: true, analytics: false, marketing: false, ts: Date.now() })); } catch {} };

// Server header
{
  const res = await fetch(url);
  check("server: 200", res.status === 200, `status ${res.status}`);
  check("server: X-Robots-Tag noindex", /noindex/i.test(res.headers.get("x-robots-tag") || ""), res.headers.get("x-robots-tag") || "missing");
}

for (const [name, width, height] of [["phone", 390, 844], ["tablet", 768, 1024], ["desktop", 1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", isMobile: width < 768, hasTouch: width < 768 });
  await ctx.addInitScript(consent);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error" && !/googletagmanager|cloudflareinsights|ERR_TUNNEL|net::ERR/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 600) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(60); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const info = await page.evaluate((ids) => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    sw: document.documentElement.scrollWidth,
    missing: ids.filter((id) => !document.getElementById(id)),
    h1: document.querySelector("h1")?.textContent?.trim().replace(/\s+/g, " "),
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") || "",
    images: Array.from(document.images).filter((i) => i.getBoundingClientRect().width > 0).map((i) => ({ src: i.currentSrc.split("/").pop(), ok: i.complete && i.naturalWidth > 0, alt: i.hasAttribute("alt") })),
  }), SECTIONS);
  check(`${name}: no horizontal scroll`, !info.overflow, `scrollWidth ${info.sw}`);
  check(`${name}: every live section id present`, info.missing.length === 0, info.missing.join(","));
  check(`${name}: H1 is the live headline`, /Cybersecurity-First IT That Powers Your Business/.test(info.h1 || ""), info.h1);
  check(`${name}: robots meta noindex`, /noindex/.test(info.robots), info.robots);
  const broken = info.images.filter((i) => !i.ok || !i.alt);
  check(`${name}: images load and carry alt`, broken.length === 0, broken.map((b) => b.src).join(","));
  check(`${name}: no console errors`, errors.length === 0, errors.slice(0, 2).join(" / "));
  await page.screenshot({ path: path.join(out, `${name}-full.png`), fullPage: true });
  if (name !== "tablet") {
    for (const id of SECTIONS) {
      const box = await page.evaluate((id) => { const el = document.getElementById(id); if (!el) return null; const r = el.getBoundingClientRect(); return { y: Math.round(r.top + window.scrollY), h: Math.round(r.height) }; }, id);
      if (!box || box.h < 10) continue;
      await page.evaluate((y) => window.scrollTo(0, y), box.y);
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(out, `${name}-${String(SECTIONS.indexOf(id) + 1).padStart(2, "0")}-${id}.png`), fullPage: true, clip: { x: 0, y: box.y, width, height: Math.min(box.h, 8000) } });
    }
  }
  await ctx.close();
}

// Bottom-bar autohide on the real page (desktop, motion allowed).
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(consent);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1400);
  await page.mouse.move(700, 300);
  const state = () => page.evaluate(() => {
    const bar = document.querySelector('[data-testid="site-bottom-bar"]');
    const dock = document.querySelector('[data-testid="homepage-section-dock"]');
    const wrap = dock?.closest("[aria-hidden]");
    return { auto: bar?.getAttribute("data-autohide"), expanded: !!wrap && wrap.getAttribute("aria-hidden") === "false", y: Math.round(window.scrollY), askDE: !!document.querySelector('[data-testid="button-open-asap-widget"]') };
  });
  const wheel = async (dy, step = 100) => { const n = Math.ceil(Math.abs(dy) / step); for (let i = 0; i < n; i++) { await page.mouse.wheel(0, Math.sign(dy) * step); await page.waitForTimeout(60); } await page.waitForTimeout(600); };
  let s = await state();
  check("bar: opening screen shows Ask DE, not tucked", s.askDE && s.auto === "shown", JSON.stringify(s));
  await wheel(600); s = await state();
  check("bar: once the hero scrolls, the chapter dock opens", s.expanded && s.auto === "shown", JSON.stringify(s));
  await wheel(1200); s = await state();
  check("bar: reading down tucks to the Ask DE button", s.auto === "tucked" && !s.expanded && s.askDE, JSON.stringify(s));
  await wheel(-60, 30); await wheel(120, 40); s = await state();
  check("bar: after a flick up, a 120px read does not tuck it again", s.auto === "shown" && s.expanded, JSON.stringify(s));
  await wheel(400); s = await state();
  await page.screenshot({ path: path.join(out, "bar-tucked.png") });
  await wheel(-20, 10); s = await state();
  check("bar: a 20px wobble up stays tucked", s.auto === "tucked", JSON.stringify(s));
  await wheel(-60, 30); s = await state();
  check("bar: a deliberate flick up brings it back", s.auto === "shown" && s.expanded, JSON.stringify(s));
  await page.screenshot({ path: path.join(out, "bar-shown.png") });
  const prog = await page.evaluate(() => !!document.querySelector('[data-testid="nav-dock-progress"]'));
  check("bar: active chapter shows read progress", prog);
  await wheel(800); await page.mouse.move(700, 880); await page.waitForTimeout(500); s = await state();
  check("bar: pointer resting near the bottom edge brings it back", s.auto === "shown", JSON.stringify(s));
  await page.mouse.move(900, 860); await wheel(600); s = await state();
  check("bar: pointer over the bar holds it", s.auto === "shown", JSON.stringify(s));
  await page.mouse.move(700, 300);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(400); await wheel(100); s = await state();
  check("bar: end of page shows it", s.auto === "shown", JSON.stringify(s));
  await ctx.close();
}
// Phone: typing steps the bar aside.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(consent);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1400);
  const field = page.locator('#assessment-form input[type="email"], #assessment-form input').first();
  await field.scrollIntoViewIfNeeded(); await field.focus(); await page.waitForTimeout(500);
  const s = await page.evaluate(() => ({ auto: document.querySelector('[data-testid="site-bottom-bar"]')?.getAttribute("data-autohide"), h: getComputedStyle(document.documentElement).getPropertyValue("--de-unified-bar-h").trim() }));
  check("bar (phone): typing in a field steps the bar aside", s.auto === "typing" && s.h === "0px", JSON.stringify(s));
  await page.screenshot({ path: path.join(out, "bar-phone-typing.png") });
  await ctx.close();
}

await browser.close();
const report = `# Homepage Version 7 check\n\nURL: ${url}\n\n| Result | Check | Detail |\n| --- | --- | --- |\n${results.map((r) => `| ${r.split(" | ").join(" | ")} |`).join("\n")}\n\n${results.length - failed}/${results.length} checks passed.\n`;
fs.writeFileSync(path.join(out, "REPORT.md"), report);
console.log(results.join("\n"));
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

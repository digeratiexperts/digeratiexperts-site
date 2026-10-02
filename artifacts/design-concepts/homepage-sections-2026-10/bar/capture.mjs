#!/usr/bin/env node
// Drives bar/dock-prototype.html with real wheel / pointer / focus input and captures each
// autohide state, asserting the state machine at every step. Writes bar/frames/*.png.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from '/home/user/digeratiexperts-site/node_modules/playwright-core/index.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)); const repo = path.resolve(here, '../../../..');
const out = path.join(here, 'frames'); fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const server = http.createServer((q, r) => { const f = path.join(repo, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(repo) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const url = `http://127.0.0.1:${port}/artifacts/design-concepts/homepage-sections-2026-10/bar/dock-prototype.html`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const results = []; let fail = 0;
const check = (label, cond, detail) => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '  (' + detail + ')' : ''}`); if (!cond) fail++; };
const wheel = async (page, total, step = 100) => { const n = Math.ceil(Math.abs(total) / step); for (let i = 0; i < n; i++) { await page.mouse.wheel(0, Math.sign(total) * step); await page.waitForTimeout(60); } await page.waitForTimeout(450); };
const state = (page) => page.evaluate(() => ({ ...window.__dock.state(), y: Math.round(scrollY), cls: document.getElementById('dock').className, active: document.querySelector('.dock__chapter.is-active')?.textContent.trim(), barH: getComputedStyle(document.documentElement).getPropertyValue('--de-unified-bar-h') }));

// ---- desktop 1440 ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1300);
  await page.mouse.move(700, 300);
  let s = await state(page); check('top of page: compact (Ask DE only), not tucked', !s.expanded && !s.tucked, s.cls);
  await page.screenshot({ path: `${out}/d1-top.png` });
  await wheel(page, 1300); s = await state(page);
  check('after leaving the hero: expanded chapter dock', s.expanded, `y=${s.y}`);
  await wheel(page, -60, 30); await wheel(page, 120, 40); s = await state(page);
  check('short read down (120px, under the 160px threshold) does not tuck', !s.tucked, `y=${s.y}`);
  await page.screenshot({ path: `${out}/d2-expanded.png` });
  await wheel(page, 1200); s = await state(page);
  check('reading down >=160px: tucked to the Ask DE button', s.tucked, `y=${s.y} active=${s.active}`);
  await page.screenshot({ path: `${out}/d3-tucked.png` });
  await wheel(page, -20, 10); s = await state(page);
  check('20px trackpad wobble up: stays tucked', s.tucked);
  await wheel(page, -60, 30); s = await state(page);
  check('deliberate flick up (>=32px): back, active chapter + progress', !s.tucked && s.expanded, `active=${s.active}`);
  await page.screenshot({ path: `${out}/d4-revealed.png` });
  await wheel(page, 800); s = await state(page); check('reading down again: tucked', s.tucked);
  await page.mouse.move(700, 880); await page.waitForTimeout(400); s = await state(page);
  check('pointer rests near the bottom edge: back', !s.tucked);
  await page.screenshot({ path: `${out}/d5-reach.png` });
  await page.mouse.move(900, 875); await wheel(page, 600); s = await state(page);
  check('pointer over the bar while scrolling: held, never tucks', !s.tucked);
  await page.mouse.move(700, 300);
  await page.click('.dock__chapter[data-ch="pricing"]'); await page.waitForTimeout(1400); s = await state(page);
  check('chapter click: jump scroll does not tuck the bar you just used', !s.tucked, `active=${s.active}`);
  await page.keyboard.press('Tab'); await wheel(page, 600); s = await state(page);
  await page.evaluate(() => document.activeElement.blur());
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(500); await wheel(page, 100); s = await state(page);
  check('end of page: shown', !s.tucked, `active=${s.active}`);
  await page.screenshot({ path: `${out}/d6-end.png` });
  const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const rp = await reduced.newPage();
  await rp.goto(url, { waitUntil: 'networkidle' }); const tr = await rp.evaluate(() => getComputedStyle(document.querySelector('.dock__capsule')).transitionProperty);
  check('reduced motion: opacity only', tr === 'opacity', tr); await reduced.close();
  await ctx.close();
}
// ---- phone 390 ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }); const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForTimeout(1300);
  await page.evaluate(() => scrollTo(0, 2400)); await page.waitForTimeout(100);
  for (let y = 2400; y <= 3200; y += 80) { await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(40); }
  await page.waitForTimeout(400); let s = await state(page);
  check('phone reading down: tucked to the Ask DE button', s.tucked, `y=${s.y}`);
  await page.screenshot({ path: `${out}/p1-tucked.png` });
  for (let y = 3200; y >= 3120; y -= 20) { await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(40); }
  await page.waitForTimeout(400); s = await state(page);
  check('phone flick up: Ask DE + back-to-top back', !s.tucked);
  await page.screenshot({ path: `${out}/p2-revealed.png` });
  await page.evaluate(() => document.getElementById('demo-email').scrollIntoView({ block: 'center' })); await page.focus('#demo-email'); await page.waitForTimeout(400);
  s = await state(page); check('phone typing in a field: bar steps aside, --de-unified-bar-h 0px', s.cls.includes('is-typing') && s.barH.trim() === '0px', s.barH);
  await page.screenshot({ path: `${out}/p3-typing.png` });
  await ctx.close();
}
await browser.close(); server.close();
fs.writeFileSync(path.join(here, 'BEHAVIOR-CHECKS.txt'), results.join('\n') + '\n');
console.log(results.join('\n')); process.exit(fail ? 1 : 0);

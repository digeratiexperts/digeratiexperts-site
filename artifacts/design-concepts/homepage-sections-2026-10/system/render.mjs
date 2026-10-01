#!/usr/bin/env node
// Render section mockups to PNG. Serves the repository root on a local port so
// mockups can reference /client/public/fonts, /brand, /attached_assets, then
// screenshots each page full-height at the requested widths.
//
//   node system/render.mjs sections/01-hero.html            # 1440 only
//   node system/render.mjs --all --widths 1440,390           # every section
//   node system/render.mjs sections/03-stats.html --scale 2  # 2x PNG
//
// Prints one JSON line per render: height, horizontal overflow, console errors,
// whether the three brand fonts resolved. Overflow or errors = not done.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/home/user/digeratiexperts-site/node_modules/playwright-core/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const conceptDir = path.resolve(here, '..');
const repoRoot = path.resolve(conceptDir, '../../..');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const widths = String(opt('--widths', '1440')).split(',').map(Number);
const scale = Number(opt('--scale', '1'));
const outDir = path.resolve(conceptDir, opt('--out', 'renders'));
const all = args.includes('--all');
// --state <name> --add-class <selector>=<class>: apply a demo state (e.g. hover) before capture; output gets -<name> suffix.
const stateName = opt('--state', '');
const addClass = opt('--add-class', '');
let files = args.filter(a => a.endsWith('.html'));
if (all) files = fs.readdirSync(path.join(conceptDir, 'sections')).filter(f => f.endsWith('.html') && !f.startsWith('_')).sort().map(f => path.join('sections', f));
if (!files.length) { console.error('no section html given'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(repoRoot, urlPath));
  if (!file.startsWith(repoRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let failures = 0;
for (const file of files) {
  const rel = path.relative(repoRoot, path.resolve(conceptDir, file)).split(path.sep).join('/');
  const base = path.basename(file, '.html');
  for (const width of widths) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: scale, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('requestfailed', r => errors.push('requestfailed ' + r.url().slice(0, 120)));
    page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`); });
    await page.goto(`http://127.0.0.1:${port}/${rel}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const info = await page.evaluate(() => ({
      height: Math.ceil(Math.max(...Array.from(document.body.children).filter(e => !['SCRIPT','STYLE','LINK'].includes(e.tagName)).map(e => e.getBoundingClientRect().bottom + window.scrollY), 1)),
      content: Math.floor(document.body.getBoundingClientRect().height),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      fonts: { grotesk: document.fonts.check('600 20px "Space Grotesk"'), inter: document.fonts.check('400 16px Inter'), oxanium: document.fonts.check('600 16px Oxanium') },
      title: document.title,
    }));
    if (addClass) { const [sel, cls] = addClass.split('='); await page.evaluate(([sel, cls]) => document.querySelectorAll(sel).forEach(e => e.classList.add(cls)), [sel, cls]); await page.waitForTimeout(700); }
    const out = path.join(outDir, `${base}-${width}${stateName ? '-' + stateName : ''}.png`);
    // Sections shorter than the 900px viewport are clipped to their own height
    // so the PNG does not end in a band of empty page background.
    if (info.content > 0 && info.content < 900) await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height: info.content } });
    else await page.screenshot({ path: out, fullPage: true, clip: { x: 0, y: 0, width, height: info.height } });
    const ok = !info.overflow && errors.length === 0 && info.fonts.grotesk && info.fonts.inter && info.fonts.oxanium;
    if (!ok) failures++;
    console.log(JSON.stringify({ file, width, out: path.relative(conceptDir, out), height: info.height, overflow: info.overflow, fonts: info.fonts, errors, ok }));
    await ctx.close();
  }
}
await browser.close();
server.close();
process.exit(failures ? 1 : 0);

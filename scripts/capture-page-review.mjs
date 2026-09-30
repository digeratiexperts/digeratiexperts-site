#!/usr/bin/env node
// Capture a route for visual review, then compress the shots for a review board.
//
// The homepage runs FullPageScrollProvider with enableOnMobile={false}: desktop
// scroll-snaps one section per viewport, mobile scrolls freely. One full-page
// screenshot therefore misrepresents desktop and produces an unusable 34,000px
// image on mobile. So this captures desktop per scroll stop, and slices the
// mobile/tablet page into segments a reviewer can actually read.
//
//   node scripts/capture-page-review.mjs [--route=/] [--port=5199] [--out=<dir>]
//                                        [--sections=hero,stats,...] [--no-compress]
//
// Expects a dev or production server already listening on --port.
// Compression needs ffmpeg; without it the PNGs are still written.

import { mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const CHROME_CANDIDATES = [
  process.env.DE_CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
].filter(Boolean);

const FFMPEG_CANDIDATES = [
  process.env.DE_FFMPEG_PATH,
  '/root/.cache/scrollcraft/node_modules/ffmpeg-static/ffmpeg',
  'ffmpeg',
].filter(Boolean);

// Homepage scroll stops, in the order DigeratiHomepage.tsx renders them.
const DEFAULT_SECTIONS = [
  'hero', 'stats', 'challenges', 'services', 'protection', 'testimonials',
  'trust', 'team', 'industries', 'pricing', 'insights', 'faq', 'cta', 'contact',
];

const WEBP_MAX_EDGE = 16383; // libwebp refuses anything larger

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

const route = arg('route', '/');
const port = Number(arg('port', '5199'));
const sections = arg('sections', DEFAULT_SECTIONS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const slug = route === '/' ? 'homepage' : route.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
const outDir = path.resolve(arg('out', `artifacts/visual-qa/${slug}-review`));
const webDir = path.join(outDir, 'web');
const base = `http://127.0.0.1:${port}`;

function firstUsable(candidates, probe) {
  for (const c of candidates) {
    try { if (probe(c)) return c; } catch { /* keep looking */ }
  }
  return null;
}

const chrome = firstUsable(CHROME_CANDIDATES, (p) => existsSync(p));
if (!chrome) {
  console.error('No Chromium found. Set DE_CHROME_PATH to a Chrome/Chromium binary.');
  process.exit(1);
}

const ffmpeg = has('no-compress') ? null : firstUsable(FFMPEG_CANDIDATES, (p) => {
  execFileSync(p, ['-version'], { stdio: 'ignore' });
  return true;
});

mkdirSync(outDir, { recursive: true });
if (ffmpeg) mkdirSync(webDir, { recursive: true });

const { chromium } = await import('playwright-core');
const browser = await chromium.launch({
  executablePath: chrome,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const pageErrors = [];
const written = [];

try {
  // Desktop: one shot per scroll stop, because the page snaps.
  const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dp = await dctx.newPage();
  dp.on('pageerror', (e) => pageErrors.push(`1440 ${String(e).slice(0, 160)}`));
  await dp.goto(base + route, { waitUntil: 'networkidle', timeout: 60_000 });
  await dp.waitForTimeout(2500);

  let i = 0;
  for (const id of sections) {
    i += 1;
    const found = await dp.evaluate((sid) => {
      const el = document.getElementById(sid);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
      return true;
    }, id);
    await dp.waitForTimeout(1200);
    const name = `1440-${String(i).padStart(2, '0')}-${id}.png`;
    await dp.screenshot({ path: path.join(outDir, name) });
    written.push(name);
    console.log(`1440  ${name}${found ? '' : '   [section id not found — blank stop]'}`);
  }
  await dctx.close();

  // Narrow widths: free scroll, so one tall page, recorded with its height.
  const heights = {};
  for (const width of [390, 768]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: width <= 430,
      hasTouch: width <= 430,
    });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => pageErrors.push(`${width} ${String(e).slice(0, 160)}`));
    await p.goto(base + route, { waitUntil: 'networkidle', timeout: 60_000 });
    await p.waitForTimeout(2000);
    await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
    });
    await p.waitForTimeout(1200);
    const h = await p.evaluate(() => document.body.scrollHeight);
    heights[width] = h;
    const name = `${width}-fullpage.png`;
    await p.screenshot({ path: path.join(outDir, name), fullPage: true });
    written.push(name);
    console.log(`${width}   ${name}   documentHeight=${h}px  (~${(h / 844).toFixed(1)} viewport screens)`);
    await ctx.close();
  }

  if (ffmpeg) {
    for (const name of written.filter((n) => n.startsWith('1440-'))) {
      execFileSync(ffmpeg, [
        '-y', '-loglevel', 'error', '-i', path.join(outDir, name),
        '-vf', 'scale=1100:-2', '-quality', '82',
        path.join(webDir, name.replace(/\.png$/, '.webp')),
      ]);
    }
    // A tall page exceeds libwebp's max edge, so slice it into segments.
    for (const [width, h] of Object.entries(heights)) {
      const w = Number(width);
      const parts = Math.max(1, Math.ceil(h / WEBP_MAX_EDGE), w === 390 ? 8 : 6);
      const seg = Math.ceil(h / parts);
      for (let k = 0; k < parts; k += 1) {
        const y = k * seg;
        const sliceH = Math.min(seg, h - y);
        if (sliceH <= 0) continue;
        execFileSync(ffmpeg, [
          '-y', '-loglevel', 'error', '-i', path.join(outDir, `${w}-fullpage.png`),
          '-vf', `crop=${w}:${sliceH}:0:${y},scale=${w === 390 ? 320 : 560}:-2`,
          '-quality', '80',
          path.join(webDir, `${w}-part${String(k + 1).padStart(2, '0')}.webp`),
        ]);
      }
      console.log(`${w}   sliced into ${parts} webp segments`);
    }
    const bytes = readdirSync(webDir).reduce((sum, f) => sum + statSync(path.join(webDir, f)).size, 0);
    console.log(`\ncompressed set: ${(bytes / 1024 / 1024).toFixed(1)} MB in ${webDir}`);
  } else {
    console.log('\nffmpeg not found (or --no-compress): PNGs only, no web/ set written.');
  }
} finally {
  await browser.close();
}

if (pageErrors.length) {
  console.log(`\n${pageErrors.length} page error(s) during capture:`);
  for (const e of pageErrors.slice(0, 20)) console.log('  ' + e);
  process.exitCode = 1;
}

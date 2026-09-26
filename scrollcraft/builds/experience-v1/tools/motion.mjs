/**
 * The motion gate. Joe's rule, 2026-09-06:
 *
 *   "you must always scroll at different speeds and test if it has any type of
 *    thing that looks off. right now you would have a red fail."
 *
 * He was right that the previous gate would pass a page that only breaks in
 * motion: it sampled static positions and waited ~320 ms at each one for
 * everything to settle. Anything that only goes wrong WHILE the page is moving
 * — copy caught mid-fade, the world frozen because a frame never scheduled, a
 * movement neither on nor off across a boundary — was invisible to it.
 *
 * This walks the page at four speeds with a real wheel, samples frames with a
 * single rAF of settle (so it sees what a human eye sees mid-flick), and fails
 * on:
 *
 *   BLANK      no readable copy in the viewport during the motion
 *   FROZEN     the world's timeline did not advance while the page moved
 *   STALE      the world's timeline is far behind where the scroll already is
 *   FLASH      a large brightness swing between consecutive sampled frames
 *
 * It writes every sampled frame so the frames can actually be looked at, which
 * is the part no assertion covers.
 *
 *   node scrollcraft/builds/experience-v1/tools/motion.mjs
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:4501/";
const OUT = process.env.OUT || "scrollcraft/builds/experience-v1/lab/motion";
const FFMPEG = process.env.FFMPEG || "/root/.cache/scrollcraft/node_modules/ffmpeg-static/ffmpeg";
mkdirSync(OUT, { recursive: true });

// Real wheel deltas. A trackpad glide is ~10-40 px per event; a mouse notch is
// ~100; a hard flick lands 400+ and arrives in bursts.
const SPEEDS = [
  { name: "crawl", delta: 12, burst: 1 },
  { name: "read", delta: 60, burst: 1 },
  { name: "brisk", delta: 180, burst: 2 },
  { name: "fling", delta: 420, burst: 3 },
];
const RUNS = [
  { name: "desktop-1440", w: 1440, h: 900 },
  { name: "phone-390", w: 390, h: 844, mobile: true },
];

const meanLuma = (png) => {
  const g = execFileSync(FFMPEG, ["-loglevel", "error", "-f", "png_pipe", "-i", "pipe:0", "-vf", "scale=48:30", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"], { input: png, maxBuffer: 32 * 1024 * 1024 });
  let s = 0; for (const b of g) s += b; return s / g.length;
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const report = [];
let failed = 0;

for (const run of RUNS) {
  const ctx = await browser.newContext({ viewport: { width: run.w, height: run.h }, deviceScaleFactor: 1, isMobile: !!run.mobile, hasTouch: !!run.mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
  await page.goto(BASE, { waitUntil: "load", timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("x-flow") || document.documentElement.classList.contains("sc-ready"), null, { timeout: 30000 });
  const live = await page.waitForFunction(() => document.getElementById("world")?.classList.contains("live"), null, { timeout: 30000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(500);
  const mode = await page.evaluate(() => (document.documentElement.classList.contains("x-flow") ? "flow" : "pin"));
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);

  for (const sp of SPEEDS) {
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; scrollTo({ top: 0, behavior: "instant" }); });
    await page.waitForTimeout(500);
    const fails = [];
    let prevLuma = null, prevT = null, prevY = 0, n = 0, samples = 0;
    // enough wheel events to cross the whole page at this speed
    const events = Math.ceil(max / (sp.delta * sp.burst)) + 2;
    // sample often enough to catch a transient, but not so often the run crawls
    const every = Math.max(1, Math.round(events / 26));

    for (let i = 0; i < events; i++) {
      for (let b = 0; b < sp.burst; b++) await page.mouse.wheel(0, sp.delta);
      if (i % every !== 0) continue;
      // ONE animation frame only: this is the whole point. No settle.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      samples++;
      const s = await page.evaluate(() => {
        const vh = innerHeight;
        const eff = (el) => { let o = 1; for (let n = el; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.visibility === "hidden" || cs.display === "none" || n.inert) return 0; o *= parseFloat(cs.opacity); } return o; };
        let readable = 0, best = "";
        for (const el of document.querySelectorAll("main h1, main h2, main p, main blockquote, main li, main .x-block, main .x-band, main .x-rail > div, main .x-rows > div")) {
          const t = (el.innerText || "").trim(); if (t.length < 12) continue;
          const r = el.getBoundingClientRect(); if (r.height === 0) continue;
          const inter = Math.min(r.bottom, vh) - Math.max(r.top, 0); if (inter / r.height < 0.6) continue;
          if (eff(el) < 0.9) continue;
          readable++; if (!best) best = t.slice(0, 44);
        }
        return { y: scrollY, readable, best, t: window.__xT ?? null };
      });
      const png = await page.screenshot();
      writeFileSync(path.join(OUT, `${run.name}-${sp.name}-${String(samples).padStart(2, "0")}.png`), png);
      const luma = meanLuma(png);

      if (!s.readable) fails.push(`BLANK at y=${Math.round(s.y)} (${sp.name})`);
      if (s.t !== null && prevT !== null && s.y > prevY + 40 && Math.abs(s.t - prevT) < 0.0005) {
        fails.push(`FROZEN world at y=${Math.round(s.y)}: t stuck at ${s.t.toFixed(3)} while scroll advanced ${Math.round(s.y - prevY)}px`);
      }
      if (prevLuma !== null && Math.abs(luma - prevLuma) > 46) {
        fails.push(`FLASH between samples near y=${Math.round(s.y)}: mean luma ${prevLuma.toFixed(0)} -> ${luma.toFixed(0)}`);
      }
      prevLuma = luma; prevT = s.t; prevY = s.y; n++;
    }

    // STALE: after the fastest motion stops, the world must be where the scroll is
    await page.waitForTimeout(260);
    const rest = await page.evaluate(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      return { y: scrollY, max, t: window.__xT ?? null };
    });
    if (rest.t !== null && rest.y >= rest.max - 4 && rest.t < 4.6) {
      fails.push(`STALE at the foot of the page: t=${rest.t.toFixed(2)} (expected ≈5 at the end)`);
    }

    if (fails.length) failed++;
    report.push({ run: run.name, mode, speed: sp.name, samples, fails });
    console.log(`${run.name} · ${sp.name} (${sp.delta}px x${sp.burst}) — ${samples} frames sampled mid-motion: ${fails.length ? "FAIL\n    - " + fails.slice(0, 6).join("\n    - ") : "pass"}`);
  }
  if (errors.length) { console.log(`  console errors: ${errors.slice(0, 3).join(" | ")}`); failed++; }
  report.push({ run: run.name, mode, live, errors });
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(failed ? `\n${failed} speed run(s) failed` : "\nall speeds passed");
process.exit(failed ? 1 : 0);

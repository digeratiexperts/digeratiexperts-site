/**
 * Render the poster stills from the world itself (asset bible S01–S03).
 *
 * Serves the build, opens ?t=<value> for each movement, waits for the world to
 * render that single frame, screenshots the canvas, and encodes WebP with the
 * repo's ffmpeg. Two shapes: landscape (s0N, the poster behind the pinned
 * story and the figure on wide flow pages) and portrait (m0N, the figure on
 * phones). Reproducible: the same t values always give the same frames.
 *
 *   node scrollcraft/builds/experience-v1/tools/render-stills.mjs
 *
 * Needs the served build at BASE (default http://127.0.0.1:4501/), Chromium at
 * CHROME_BIN, and ffmpeg-static from the scrollcraft cache.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:4501/";
const OUT = path.resolve("scrollcraft/builds/experience-v1/assets/stills");
const FFMPEG = process.env.FFMPEG || "/root/.cache/scrollcraft/node_modules/ffmpeg-static/ffmpeg";
const BEATS = [
  ["01", 0.45], // movement 1: the whole floor, nothing quite lined up
  ["02", 1.6],  // movement 2: glass floor, relationships, weak points
  // movement 3: level, joined, one boundary. Sampled just before the evidence
  // tail begins dimming the world at t 3.02, because under reduced motion and
  // without WebGL these stills are the only picture of it anyone gets.
  ["03", 2.95],
];
const SHAPES = [["s", 1600, 1000], ["m", 800, 1000]];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const [prefix, width, height] of SHAPES) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const [n, t] of BEATS) {
    await page.goto(`${BASE}?t=${t}`, { waitUntil: "load", timeout: 60000 });
    await page.waitForSelector("html[data-still-ready]", { state: "attached", timeout: 30000 });
    await page.waitForTimeout(250);
    const name = `${prefix}${n}`;
    const png = path.join(OUT, `${name}.png`);
    await page.locator("#stage").screenshot({ path: png });
    const webp = path.join(OUT, `${name}.webp`);
    execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", png, "-c:v", "libwebp", "-q:v", "78", "-compression_level", "6", webp]);
    unlinkSync(png);
    console.log(`${name}  t=${t}  ${width}x${height}  ${(statSync(webp).size / 1024).toFixed(1)} KB`);
  }
  await ctx.close();
}
await browser.close();

#!/usr/bin/env node
// Screenshot a served page (web-design-rules skill).
//   node .claude/skills/web-design-rules/scripts/screenshot.mjs <url> [label] [--width 1440] [--height 900] [--full] [--out "temporary screenshots"]
// Saves temporary screenshots/screenshot-N[-label].png, auto-incremented, never overwritten.
// Browser: $SCROLLCRAFT_CHROME, else the Playwright-managed Chromium, else common system paths.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && args[i - 1] !== "--full"));
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const url = positional[0];
if (!url) { console.error('usage: screenshot.mjs <url> [label] [--width 1440] [--height 900] [--full] [--out dir]'); process.exit(1); }
const label = positional[1] ? "-" + positional[1].replace(/[^\w-]+/g, "-") : "";
const W = parseInt(flag("--width", "1440"), 10), H = parseInt(flag("--height", "900"), 10);
const OUT = path.resolve(flag("--out", "temporary screenshots"));
fs.mkdirSync(OUT, { recursive: true });
const n = fs.readdirSync(OUT).map(f => /^screenshot-(\d+)/.exec(f)).filter(Boolean).reduce((m, x) => Math.max(m, +x[1]), 0) + 1;
const file = path.join(OUT, `screenshot-${n}${label}.png`);

function findChrome() {
  const cands = [process.env.SCROLLCRAFT_CHROME, process.env.CHROME_PATH];
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (fs.existsSync(pw)) for (const d of fs.readdirSync(pw).filter(x => /^chromium-\d+$/.test(x)).sort().reverse())
    cands.push(path.join(pw, d, "chrome-linux", "chrome"), path.join(pw, d, "chrome-mac", "Chromium.app/Contents/MacOS/Chromium"), path.join(pw, d, "chrome-win", "chrome.exe"));
  cands.push("/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe");
  return cands.find(c => c && fs.existsSync(c));
}
let chromium;
outer: for (const from of [process.cwd() + "/package.json", import.meta.url]) {
  for (const mod of ["playwright", "playwright-core"]) {
    try { chromium = createRequire(from)(mod).chromium; break outer; } catch {}
  }
}
if (!chromium) { console.error("Neither `playwright` nor `playwright-core` is installed. Run `npm install` in the project first."); process.exit(1); }
const executablePath = findChrome();
if (!executablePath) { console.error("No Chrome/Chromium found. Set SCROLLCRAFT_CHROME to a browser binary."); process.exit(1); }

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(500);
await page.screenshot({ path: file, fullPage: args.includes("--full") });
await browser.close();
console.log(file);

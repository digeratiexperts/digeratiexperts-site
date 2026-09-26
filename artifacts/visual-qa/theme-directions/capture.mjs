#!/usr/bin/env node
// Re-capture the three theme directions in index.html at 1440 / 768 / 390.
// The raw PNGs under shots/ are gitignored; the committed evidence is web/.
//
//   node .claude/skills/web-design-rules/scripts/serve.mjs \
//     --root artifacts/visual-qa/theme-directions --port 3007 &
//   node artifacts/visual-qa/theme-directions/capture.mjs
//
// Then compress with ffmpeg into web/ (see the loop at the bottom of the PR).

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const OUT = 'artifacts/visual-qa/theme-directions/shots';
const PORT = Number(process.env.DE_PORT || 3007);
const CHROME = process.env.DE_CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const errors = [];
for (const width of [1440, 768, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${width}: ${e}`));
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  // Webfonts change every measurement on this page, so wait for them.
  await page.evaluate(() => document.fonts.ready);
  for (const dir of ['A', 'B', 'C']) {
    await page.click(`.switch button[data-go="${dir}"]`);
    await page.waitForTimeout(700);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: `${OUT}/${width}-${dir}.png`, fullPage: true });
    console.log(`${width} ${dir}  height=${h}px  (~${(h / 900).toFixed(1)} screens)`);
  }
  await ctx.close();
}
await browser.close();

if (errors.length) {
  console.log(`\n${errors.length} page error(s):`);
  for (const e of errors) console.log('  ' + e);
  process.exitCode = 1;
}

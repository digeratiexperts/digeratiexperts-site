#!/usr/bin/env node
// Capture the page-flip prototype, including mid-turn frames.
//
// A flip engine cannot be verified from a static screenshot of a closed book —
// the whole claim is about what happens between two states. So this drives a real
// pointer drag and shoots the leaf partway over, which exercises the drag path at
// the same time.
//
//   node .claude/skills/web-design-rules/scripts/serve.mjs \
//     --root artifacts/design-concepts/page-flip --port 3011 &
//   node artifacts/design-concepts/page-flip/capture.mjs

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const OUT = 'artifacts/design-concepts/page-flip/shots';
const PORT = Number(process.env.DE_PORT || 3011);
const CHROME = process.env.DE_CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const errors = [];

/** Drag the right-hand page part-way across and hold, so the turn can be shot. */
async function holdMidTurn(page, fraction) {
  const box = await page.locator('.pf-book').boundingBox();
  const y = box.y + box.height / 2;
  const startX = box.x + box.width * 0.88;        // the outer third, like a hand
  await page.mouse.move(startX, y);
  await page.mouse.down();
  // Travel across the active half; the engine maps that to 0..1 of a turn.
  const reach = box.width * (box.width > 700 ? 0.5 : 1);
  await page.mouse.move(startX - reach * fraction, y, { steps: 12 });
  await page.waitForTimeout(140);
}

for (const [width, height, label] of [[1440, 1000, '1440'], [768, 1024, '768'], [390, 844, '390']]) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${label}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`); });

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  await page.screenshot({ path: `${OUT}/${label}-01-closed.png` });

  // Three points through a single turn. 0.5 is the money shot: the leaf is
  // edge-on, so the fold and both shadow layers are at full strength.
  for (const [frac, name] of [[0.28, '02-early'], [0.5, '03-mid'], [0.78, '04-late']]) {
    await holdMidTurn(page, frac);
    await page.screenshot({ path: `${OUT}/${label}-${name}.png` });
    await page.mouse.up();
    await page.waitForTimeout(700);                // let it settle before the next
    if (name !== '04-late') await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(700);
  }

  await page.screenshot({ path: `${OUT}/${label}-05-turned.png` });

  // Reduced motion must have no half-state at all: the leaf stays hidden.
  await ctx.close();
  const rm = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const rmPage = await rm.newPage();
  rmPage.on('pageerror', (e) => errors.push(`${label} rm: ${e}`));
  await rmPage.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  await rmPage.evaluate(() => document.fonts.ready);
  await rmPage.click('#next');
  await rmPage.waitForTimeout(300);
  const leafVisible = await rmPage.evaluate(() => {
    const leaf = document.querySelector('.pf-leaf');
    return getComputedStyle(leaf).visibility !== 'hidden';
  });
  await rmPage.screenshot({ path: `${OUT}/${label}-06-reduced-motion.png` });
  console.log(`${label}  reduced-motion leaf hidden: ${!leafVisible ? 'PASS' : 'FAIL'}`);

  // No horizontal overflow at any width (Tier 0 responsive operability).
  const overflow = await rmPage.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(`${label}  horizontal overflow: ${overflow ? 'FAIL' : 'none'}`);
  await rm.close();
}

await browser.close();

if (errors.length) {
  console.log(`\n${errors.length} page error(s):`);
  for (const e of errors) console.log('  ' + e);
  process.exitCode = 1;
} else {
  console.log('\nno page errors');
}

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

/**
 * Browser smoke for the DE Desk (Ask DE / Get Support / Client Tools).
 *
 * Asserts what unit tests cannot see, in a real browser:
 * - the Desk opens from the launcher and its chooser, as exactly one dialog;
 * - it fits the viewport at 390 / 768 / 1440 and on short screens (a phone held
 *   sideways, 200% zoom): header and close button never leave the screen;
 * - no horizontal overflow and no page errors;
 * - keyboard: focus opens inside the Desk, Tab and Shift+Tab never leave it and
 *   never stop on the pointer-only resize handles, Escape closes it and returns
 *   focus to the Ask DE launcher;
 * - the first-visit hints: the text box hint plays, the full-screen hint only
 *   follows once it has ended (never both at once), and typing ends the text
 *   box hint;
 * - a few polish invariants (the empty send button is not half-transparent, the
 *   Details box shows its whole prompt, full screen keeps a centred column).
 *
 * Network calls the Desk makes are answered by the browser (route stubs), so
 * the run is deterministic and never reaches Zoho or the advisor.
 */

const base = process.env.DESK_BASE || "http://127.0.0.1:3300";
const outDir = process.env.DESK_OUT || "tmp/desk-qa";
mkdirSync(outDir, { recursive: true });

const MODAL = '[data-testid="desk-modal"]';
const COMPOSER = '[data-testid="desk-composer"]';
const LAUNCHER = '[data-testid="button-open-asap-widget"]';
const CHOOSER = '[data-testid="ask-de-quick-menu"]';

// A pinned Playwright may want a browser build the machine lacks; CHROME points it at the installed one.
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
const results = [];

function check(group, name, ok, detail = "") {
  results.push({ group, name, ok: !!ok, ...(detail ? { detail } : {}) });
}

async function newPage({ width, height }, { freshHints = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (!freshHints) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("de-desk-expand-hint", JSON.stringify({ used: true, shown: 3 }));
        localStorage.setItem("de-desk-composer-hint", JSON.stringify({ used: true, shown: 3 }));
      } catch {}
    });
  }
  await page.route("**/api/portal/me", (route) => route.fulfill({ status: 401, json: { error: "Not signed in" } }));
  await page.route("**/api/zoho/desk/status", (route) => route.fulfill({ json: { connected: true } }));
  await page.route("**/api/public/advisor/chat", (route) =>
    route.fulfill({ json: { sessionId: "smoke", reply: "Smoke reply." } }),
  );
  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(500);
  const reject = page.getByRole("button", { name: "Reject All" });
  if (await reject.count()) await reject.first().click().catch(() => {});
  return { context, page, errors };
}

async function openFromChooser(page) {
  await page.locator(LAUNCHER).first().click({ timeout: 10000 });
  await page.waitForSelector(CHOOSER, { timeout: 10000 });
  await page.locator('[data-testid="ask-de-choice-help"]').click();
  await page.waitForSelector(MODAL, { timeout: 15000 });
  await page.waitForTimeout(600);
}

const geometry = (page) =>
  page.evaluate(() => {
    const desk = document.querySelector('[data-testid="desk-modal"]')?.getBoundingClientRect();
    const close = document.querySelector('[data-testid="button-close-widget"]')?.getBoundingClientRect();
    return {
      dialogs: document.querySelectorAll('[data-testid="desk-modal"]').length,
      top: desk ? Math.round(desk.top) : -999,
      bottom: desk ? Math.round(desk.bottom) : 99999,
      closeTop: close ? Math.round(close.top) : -999,
      viewport: innerHeight,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

const focusInfo = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return {
      inDesk: !!el?.closest?.('[data-testid="desk-modal"]'),
      isLauncher: !!el?.matches?.('[data-testid="button-open-asap-widget"]'),
      isResize: !!el?.closest?.(".de-desk-resize, .de-desk-resize-edge"),
      label: el?.getAttribute?.("aria-label") || el?.getAttribute?.("data-testid") || el?.tagName || "none",
    };
  });

// 1. Fit, overflow and one dialog at the usual widths and on short screens.
for (const viewport of [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
  { name: "landscape-844x390", width: 844, height: 390 },
  { name: "zoom200-720x450", width: 720, height: 450 },
]) {
  const { context, page, errors } = await newPage(viewport);
  await openFromChooser(page);
  for (const tab of ["Ask DE", "Get Support", "Client Tools"]) {
    await page.getByRole("tab", { name: tab }).first().click();
    await page.waitForTimeout(300);
    const g = await geometry(page);
    const where = `${viewport.name} ${tab}`;
    check("fit", `${where}: exactly one Desk dialog`, g.dialogs === 1, `found ${g.dialogs}`);
    check("fit", `${where}: Desk inside the viewport`, g.top >= 0 && g.bottom <= g.viewport, `top ${g.top} bottom ${g.bottom} of ${g.viewport}`);
    check("fit", `${where}: close button on screen`, g.closeTop >= 0, `close top ${g.closeTop}`);
    check("fit", `${where}: no horizontal overflow`, g.overflowX <= 2, `${g.overflowX}px`);
  }
  await page.screenshot({ path: `${outDir}/desk-${viewport.name}.png` });
  check("errors", `${viewport.name}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await context.close();
}

// 2. Keyboard at 1440: open, trap, no resize stops, Escape returns to the launcher.
{
  const { context, page } = await newPage({ width: 1440, height: 900 });
  await page.locator(LAUNCHER).first().focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(CHOOSER, { timeout: 10000 });
  await page.waitForTimeout(300);
  const chooserFocus = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") || "");
  check("keyboard", "chooser opens with focus on the first choice", chooserFocus === "ask-de-choice-support", chooserFocus);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.waitForSelector(MODAL, { timeout: 15000 });
  await page.waitForTimeout(700);
  const opened = await focusInfo(page);
  check("keyboard", "focus opens inside the Desk", opened.inDesk, opened.label);
  let left = 0;
  let resizeStops = 0;
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const f = await focusInfo(page);
    if (!f.inDesk) left++;
    if (f.isResize) resizeStops++;
  }
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Shift+Tab");
    const f = await focusInfo(page);
    if (!f.inDesk) left++;
    if (f.isResize) resizeStops++;
  }
  check("keyboard", "Tab and Shift+Tab never leave the Desk", left === 0, `${left} stops outside`);
  check("keyboard", "Tab never stops on a resize handle", resizeStops === 0, `${resizeStops} stops`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const closed = (await page.locator(MODAL).count()) === 0;
  const after = await focusInfo(page);
  check("keyboard", "Escape closes the Desk", closed);
  check("keyboard", "focus returns to the Ask DE launcher", after.isLauncher, after.label);
  await context.close();
}

// 3. First-visit hints at 1440 with fresh storage.
{
  const { context, page } = await newPage({ width: 1440, height: 900 }, { freshHints: true });
  await openFromChooser(page);
  const composerShown = await page
    .waitForSelector(`${COMPOSER}.is-hinting`, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  check("hints", "the text box hint plays on Ask DE", composerShown);
  const overlapAtStart = await page.locator('[data-testid="desk-expand-hint"]').count();
  check("hints", "the full-screen hint is not showing while the text box hint plays", overlapAtStart === 0);
  await page.waitForSelector(`${COMPOSER}:not(.is-hinting)`, { timeout: 9000 }).catch(() => {});
  const expandShown = await page
    .waitForSelector('[data-testid="desk-expand-hint"]', { timeout: 6000 })
    .then(() => true)
    .catch(() => false);
  const composerDuringExpand = await page.locator(`${COMPOSER}.is-hinting`).count();
  check("hints", "the full-screen hint follows once the text box hint has ended", expandShown && composerDuringExpand === 0);
  await context.close();
}
{
  const { context, page } = await newPage({ width: 390, height: 844 }, { freshHints: true });
  await openFromChooser(page);
  await page.waitForSelector(`${COMPOSER}.is-hinting`, { timeout: 15000 }).catch(() => {});
  await page.locator("#desk-chat-input").type("help", { delay: 20 });
  await page.waitForTimeout(200);
  check("hints", "typing ends the text box hint at once", (await page.locator(`${COMPOSER}.is-hinting`).count()) === 0);
  check("hints", "no full-screen hint on a phone", (await page.locator('[data-testid="desk-expand-hint"]').count()) === 0);
  await context.close();
}

// 4. Polish invariants.
{
  const { context, page } = await newPage({ width: 1440, height: 900 });
  await openFromChooser(page);
  const sendOpacity = await page.locator(".de-desk-send").evaluate((el) => getComputedStyle(el).opacity);
  check("polish", "the empty send button is not half-transparent", sendOpacity === "1", `opacity ${sendOpacity}`);
  await page.getByRole("tab", { name: "Get Support" }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Email problem/ }).first().click();
  await page.waitForTimeout(400);
  const detailsHeight = await page.locator(".de-desk-ta").first().evaluate((el) => parseFloat(getComputedStyle(el).minHeight));
  check("polish", "the Details box is tall enough for its whole prompt", detailsHeight >= 148, `${detailsHeight}px`);
  await page.locator('[data-testid="button-expand-desk"]').click();
  await page.waitForTimeout(500);
  const tabsLeft = await page.locator(".de-desk-tabs").evaluate((el) => Math.round(el.getBoundingClientRect().left));
  check("polish", "full screen keeps a centred column", tabsLeft > 200, `tabs start at ${tabsLeft}px`);
  await context.close();
}

await browser.close();

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\nDE Desk browser smoke: ${results.length - failed.length}/${results.length} checks passed.`);
for (const f of failed) console.log(`FAIL [${f.group}] ${f.name}${f.detail ? ` (${f.detail})` : ""}`);
if (failed.length) process.exit(1);

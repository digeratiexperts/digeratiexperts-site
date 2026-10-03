/**
 * Acceptance walk for the /quote-wizard quiz room (issue 419).
 *
 * Drives the real page at 390 / 768 / 1440, screenshots every screen and checks
 * what tests in node cannot: the skip link lands in <main>, no MegaMenu / sticky
 * bar / exit-intent popup competes with the question, a tile tap answers and
 * advances, arrow keys never answer, Back (in-page and browser) keeps answers,
 * the POST /api/lead-quote payload keeps its pre-quiz keys plus `context`, the
 * hand-off reaches /quote-confirmation, nothing overflows sideways, and (with
 * AXE_PATH) axe finds no serious or critical WCAG 2.1 AA issue on any screen.
 * The lead POST is answered in the browser, so nothing reaches the CRM.
 *
 * usage: QUIZ_BASE=http://localhost:5000 [AXE_PATH=.../axe.min.js] \
 *        node scripts/qa/quote-wizard-quiz-check.mjs [outDir]
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.QUIZ_BASE || "http://localhost:5000").replace(/\/$/, "");
const OUT = process.argv[2] || "artifacts/visual-qa/quote-wizard-quiz/after";
const AXE = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, "utf8") : null;
const EXECUTABLE =
  process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const PRE_QUIZ_KEYS = [
  "seats", "enterpriseToggle", "connectivity", "devices", "recommendedPlan", "firstName", "lastName",
  "company", "email", "consent", "source", "pageUrl", "timestamp",
];

fs.mkdirSync(OUT, { recursive: true });
const failures = [];
const report = { base: BASE, checked: new Date().toISOString(), widths: {} };
const check = (width, name, ok, detail = "") => {
  report.widths[width].checks.push({ name, ok, ...(detail ? { detail } : {}) });
  if (!ok) failures.push(`${width}: ${name}${detail ? ` (${detail})` : ""}`);
};

const browser = await chromium.launch({ executablePath: EXECUTABLE });

for (const viewport of VIEWPORTS) {
  const w = viewport.width;
  report.widths[w] = { checks: [], axe: {} };
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    try {
      localStorage.setItem(
        "de_cookie_consent_v2",
        JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: Date.now(), version: 2 }),
      );
    } catch {
      /* ignore */
    }
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  let posted = null;
  await page.route("**/api/lead-quote", async (route) => {
    posted = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' });
  });

  const step = () => page.locator("[data-testid^='quiz-step-']").getAttribute("data-testid");
  const settle = () => page.waitForTimeout(450);
  const shot = async (name) => {
    await settle();
    await page.screenshot({ path: path.join(OUT, `${name}-${w}.png`), fullPage: true });
    if (AXE) {
      await page.addScriptTag({ content: AXE });
      const result = await page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
        return r.violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => `${v.id}: ${v.nodes.length}`);
      });
      report.widths[w].axe[name] = result;
      check(w, `axe serious/critical on ${name}`, result.length === 0, result.join(", "));
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(w, `no sideways overflow on ${name}`, !overflow);
  };

  await page.goto(`${BASE}/quote-wizard`, { waitUntil: "networkidle" });
  await settle();

  // Chrome: the room's own, nothing competing.
  check(w, "MegaMenu absent", (await page.locator("[data-testid='logo-header']").count()) === 0);
  check(w, "sticky CTA bar absent", !(await page.locator("[data-testid='sticky-cta-bar']").isVisible().catch(() => false)));
  const canonical = await page.locator("link[rel='canonical']").getAttribute("href").catch(() => null);
  check(w, "canonical is /quote-wizard", !!canonical && /\/quote-wizard$/.test(canonical), String(canonical));
  check(w, "talk link goes to /book", (await page.getByTestId("quiz-talk").getAttribute("href")) === "/book");

  // Skip link: first Tab, then Enter lands in <main id="main-content">.
  await page.keyboard.press("Tab");
  const firstFocus = await page.evaluate(() => document.activeElement?.textContent?.trim() || "");
  check(w, "first Tab reaches the skip link", /skip/i.test(firstFocus), firstFocus);
  await page.keyboard.press("Enter");
  const landed = await page.evaluate(() => {
    const main = document.querySelector("main#main-content");
    return !!main && (document.activeElement === main || main.contains(document.activeElement));
  });
  check(w, "skip link lands in main#main-content", landed);

  await shot("1-seats");
  await page.getByTestId("seat-chip-100plus").click();
  check(w, "100+ shows 100+", (await page.getByTestId("seat-count").textContent())?.trim() === "100+");
  await page.getByRole("button", { name: "20", exact: true }).click();
  await page.getByTestId("quiz-continue").click();
  await settle();
  check(w, "Continue moves to connectivity", (await step()) === "quiz-step-connectivity");
  check(w, "focus moves to the new question", await page.evaluate(() => document.activeElement?.tagName === "H1"));

  // Arrow keys never answer.
  await page.getByTestId("tile-connectivity-no").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(400);
  check(w, "arrow keys do not answer", (await step()) === "quiz-step-connectivity");
  await shot("2-connectivity");

  // A tap answers and advances.
  await page.getByTestId("tile-connectivity-yes").click();
  await settle();
  check(w, "tile tap advances", (await step()) === "quiz-step-devices");

  // In-page Back keeps the answer.
  await page.getByTestId("quiz-back").click();
  await settle();
  check(
    w,
    "Back keeps the answer",
    (await step()) === "quiz-step-connectivity" &&
      (await page.getByTestId("tile-connectivity-yes").getAttribute("aria-pressed")) === "true",
  );

  // Keyboard: Enter on a focused tile answers.
  await page.getByTestId("tile-connectivity-yes").focus();
  await page.keyboard.press("Enter");
  await settle();
  check(w, "Enter on a tile advances", (await step()) === "quiz-step-devices");
  await shot("3-devices");
  await page.getByTestId("tile-devices-yes").click();
  await settle();

  // Browser Back walks the screens instead of leaving.
  await page.goBack();
  await settle();
  check(w, "browser Back stays in the quiz", page.url().endsWith("/quote-wizard") && (await step()) === "quiz-step-devices");
  await page.getByTestId("tile-devices-yes").click();
  await settle();

  await shot("4-it-today");
  await page.getByTestId("tile-itToday-provider").click();
  await settle();
  await shot("5-trigger");
  await page.getByTestId("tile-trigger-insurance").click();
  await settle();
  await shot("6-frameworks");
  await page.getByTestId("tile-frameworks-hipaa").click();
  await page.getByTestId("tile-frameworks-pci").click();
  await page.getByTestId("quiz-continue").click();
  await settle();

  check(w, "match shown before email", (await step()) === "quiz-step-match");
  check(w, "20 seats + remote + managed devices matches Business", (await page.getByTestId("match-plan").textContent())?.trim() === "Business");
  await shot("7-match");
  await page.getByTestId("quiz-continue").click();
  await settle();

  // Empty submit shows errors and does not post.
  await page.getByTestId("quiz-submit").click();
  await settle();
  check(w, "empty submit does not post", posted === null);
  await shot("8-contact-errors");

  await page.getByLabel("Work email").fill("quiz.tester@example-co.test");
  await page.getByLabel("First name").fill("Quiz");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Company").fill("Example Co");
  await page.locator("[data-testid='quiz-contact-form'] input[type='checkbox']").check();
  await shot("8-contact");
  await page.getByTestId("quiz-submit").click();
  await page.waitForURL("**/quote-confirmation", { timeout: 10_000 }).catch(() => {});
  check(w, "hand-off reaches /quote-confirmation", page.url().endsWith("/quote-confirmation"), page.url());

  const keys = posted ? Object.keys(posted) : [];
  check(w, "payload keeps every pre-quiz key", PRE_QUIZ_KEYS.every((k) => keys.includes(k)), keys.join(","));
  check(w, "payload adds only context", keys.every((k) => PRE_QUIZ_KEYS.includes(k) || k === "context"), keys.join(","));
  check(
    w,
    "payload values",
    posted?.seats === 20 && posted?.enterpriseToggle === false && posted?.connectivity === "yes" && posted?.devices === "yes" &&
      posted?.recommendedPlan === "Business" && posted?.source === "header-instant-quote" && posted?.consent === true,
    JSON.stringify(posted),
  );
  check(
    w,
    "context answers sent",
    JSON.stringify(posted?.context) === JSON.stringify({ itToday: "provider", trigger: "insurance", frameworks: ["hipaa", "pci"] }),
    JSON.stringify(posted?.context),
  );
  await settle();
  await page.screenshot({ path: path.join(OUT, `9-confirmation-${w}.png`), fullPage: true });
  check(w, "confirmation names the plan", (await page.locator("main").textContent())?.includes("Business") ?? false);

  check(w, "no runtime errors", pageErrors.length === 0, pageErrors.join(" | "));
  await context.close();
}

await browser.close();
report.failures = failures;
fs.writeFileSync(path.join(OUT, "check.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(failures.length ? `FAIL\n${failures.join("\n")}` : "PASS");
process.exit(failures.length ? 1 : 0);

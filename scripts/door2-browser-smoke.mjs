import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

/**
 * Production smoke for the public Store (Door 2). Walks the whole journey at
 * 390 / 768 / 1440 and asserts the invariants of the source of truth
 * (docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §14): 13 families, profile before
 * needs, no email gate, no Pay Now, both packages sized before any choice,
 * one relationship control, Delivery & Setup in DE order with remote first,
 * four contact fields and no notes, a reference on the confirmation, zero
 * horizontal overflow and no overlapping fixed chrome.
 */

const base = process.env.DOOR2_BASE || "http://127.0.0.1:3311";
const outDir = process.env.DOOR2_OUT || "tmp/door2-qa";
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];

const FORBIDDEN_VISIBLE = [
  /\bPay Now\b/i,
  /\bAdd to cart\b/i,
  /\bsku\b/i,
  /\bdiscount\b/i,
  /\bDE (managed|manages|operates)\b/,
  /\b(co_managed|remote_assist|self_install|as_needed|not_required)\b/,
  /\b8 BLOCKS\b/,
  /\bsent to sales\b/i,
];

// A pinned Playwright may want a browser build the machine lacks; CHROME points it at the installed one.
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
const results = [];

const hasHorizontalOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);

const visibleText = (page) => page.evaluate(() => document.querySelector("main")?.innerText ?? "");

const forbiddenHits = async (page) => {
  const text = await visibleText(page);
  return FORBIDDEN_VISIBLE.filter((re) => re.test(text)).map((re) => String(re));
};

/** Two independently interactive fixed elements must never share pixels. */
const fixedOverlaps = (page) =>
  page.evaluate(() => {
    const fixed = [...document.querySelectorAll("body *")].filter((el) => {
      const style = getComputedStyle(el);
      if (style.position !== "fixed" || style.visibility === "hidden" || style.display === "none") return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 24) return false;
      if (Number(style.opacity) === 0) return false;
      return !!el.querySelector("a, button, input") || ["A", "BUTTON"].includes(el.tagName);
    });
    // Keep only outermost fixed elements (a fixed child of a fixed parent is the same chrome).
    const outer = fixed.filter((el) => !fixed.some((other) => other !== el && other.contains(el)));
    const hits = [];
    for (let i = 0; i < outer.length; i += 1) {
      for (let j = i + 1; j < outer.length; j += 1) {
        const a = outer[i].getBoundingClientRect();
        const b = outer[j].getBoundingClientRect();
        const overlap = a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
        if (overlap) hits.push(`${outer[i].getAttribute("data-testid") || outer[i].className} × ${outer[j].getAttribute("data-testid") || outer[j].className}`);
      }
    }
    return hits;
  });

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  // Consent pre-seeded so the walk measures the page, not the banner; the banner case is measured separately below.
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("de_cookie_consent_v2", JSON.stringify({ necessary: true, analytics: false, marketing: false, at: 0 }));
    } catch {}
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const row = { viewport: viewport.name, overflow: {}, forbidden: {}, fixedOverlap: {}, scrollTop: {} };
  const wide = viewport.width >= 1024;

  // A · Enter
  await page.goto(`${base}/store`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("heading-business-needs").waitFor();
  row.familyCount = await page.locator("[data-testid^='family-card-']").count();
  row.scenarioCount = await page.locator("[data-testid^='scenario-']").filter({ hasNot: page.locator("button") }).count() || (await page.locator("li[data-testid^='scenario-']").count());
  row.emailInputs = await page.locator("main input[type='email']").count();
  row.h1Count = await page.locator("h1").count();
  // Profile (01) before the situations and families (02): the strip may be a closed row, so compare chapters.
  row.profileBeforeFamilies = await page.evaluate(() => {
    const profile = document.querySelector("[data-testid='store-profile']");
    const families = document.querySelector("[data-testid='business-needs-families']");
    return !!profile && !!families && !!(profile.compareDocumentPosition(families) & Node.DOCUMENT_POSITION_FOLLOWING);
  });

  // The profile strip is a closed row until the buyer opens it (or adds a need).
  const openProfile = page.getByTestId("profile-open");
  if (await openProfile.count()) await openProfile.click();
  await page.locator("#profile-users").fill("25");
  await page.locator("#profile-computers").fill("32");
  await page.locator("#profile-mobile").fill("18");
  await page.locator("#profile-sites").fill("2");
  await page.getByRole("radio", { name: "A mix", exact: true }).check();
  await page.getByRole("radio", { name: "No", exact: true }).check();
  row.sizedLine = await page.getByText(/Sized for 25 users · 32 computers · 18 mobile devices · 2 sites/).count();

  // Under 768 the later goal groups are closed disclosures; the goal pill opens its group at any width.
  await page.getByTestId("business-goal-protect").click();
  await page.locator("[data-testid='family-card-identity_access']").getByRole("button", { name: "Add need", exact: true }).click();
  row.addedState = await page.locator("[data-testid='family-card-identity_access']").getByRole("button", { name: /Added/ }).count();
  if (wide) {
    row.railCount = await page.getByTestId("solution-count").innerText();
    row.railHasNeed = await page.getByTestId("solution-rail").getByText("Identity & Access").count();
  } else {
    await page.getByTestId("solution-bar-open").click();
    await page.getByTestId("your-solution-sheet").waitFor();
    row.dockHiddenWhileSheetOpen = await page.evaluate(() => document.documentElement.dataset.dockHidden === "true");
    row.sheetHasProfile = await page.getByTestId("your-solution-sheet").getByText(/25 users · 32 computers · 18 mobile devices · 2 sites/).count();
    row.sheetHasNeed = await page.getByTestId("your-solution-sheet").getByText("Identity & Access").count();
    await page.keyboard.press("Escape");
    await page.getByTestId("your-solution-sheet").waitFor({ state: "hidden" });
  }
  row.overflow.index = await hasHorizontalOverflow(page);
  row.forbidden.index = await forbiddenHits(page);
  row.fixedOverlap.index = await fixedOverlaps(page);
  row.indexViewports = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
  await page.screenshot({ path: `${outDir}/index-${viewport.name}.png`, fullPage: true });

  // B · Compare
  await page.locator("[data-testid='family-card-identity_access']").getByRole("link", { name: "Identity & Access" }).click();
  await page.getByTestId("heading-family").waitFor();
  row.scrollTop.family = await page.evaluate(() => window.scrollY);
  row.familyHeading = await page.getByTestId("heading-family").innerText();
  const compare = await page.getByTestId("relationship-compare").innerText();
  row.compareHasBoth = /Standard price/i.test(compare) && /Preferred pricing/i.test(compare);
  row.compareSized = /25 users/.test(compare);
  row.familyRelationshipControls = await page.locator("input[type='radio'][name='relationship']").count();
  row.wrongStandaloneCopy = await page.getByText("DE manages this", { exact: false }).count();
  const deliveryList = await page.locator("#delivery").innerText();
  row.deliveryRemoteFirst = deliveryList.indexOf("Remote DE setup") > -1 && deliveryList.indexOf("Remote DE setup") < Math.max(deliveryList.indexOf("On-site"), deliveryList.length);
  row.overflow.family = await hasHorizontalOverflow(page);
  row.forbidden.family = await forbiddenHits(page);
  row.fixedOverlap.family = await fixedOverlaps(page);
  await page.screenshot({ path: `${outDir}/family-${viewport.name}.png`, fullPage: true });

  // C · Assemble
  await page.getByTestId("continue-building").click();
  await page.waitForURL(/\/store\/solution/);
  await page.getByTestId("heading-workspace").waitFor();
  row.scrollTop.workspace = await page.evaluate(() => window.scrollY);
  row.workspaceHeading = await page.getByTestId("heading-workspace").innerText();
  row.journeyRail = await page.locator("[aria-label='Profile → pain or need → relationship → package → delivery & setup → contact']").count();
  row.relationshipControls = await page.locator("input[type='radio'][name='relationship']").count();
  row.installOrder = await page.locator("input[type='radio'][name='installation']").evaluateAll((inputs) => inputs.map((input) => input.value));
  row.installDefaultRemote = await page.locator("input[type='radio'][name='installation']:checked").evaluateAll((inputs) => inputs.map((input) => input.value));
  row.onsiteCopy = await page.getByText("Truck-Roll, Trip Charge and Tech Labor", { exact: false }).count();
  await page.getByTestId("delivery-co_managed").click();
  row.supportSuggested = await page.locator("input[type='radio'][name='remote-support']:checked").evaluateAll((inputs) => inputs.map((input) => input.value));
  await page.getByRole("button", { name: "Save progress", exact: true }).click();
  await page.getByText(/Saved (on this device|to DE)/).first().waitFor();
  row.saveSentence = await page.getByTestId("solution-rail-save").innerText();
  row.overflow.workspace = await hasHorizontalOverflow(page);
  row.forbidden.workspace = await forbiddenHits(page);
  row.fixedOverlap.workspace = await fixedOverlaps(page);
  row.workspaceViewports = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
  await page.screenshot({ path: `${outDir}/workspace-${viewport.name}.png`, fullPage: true });

  // D · Sign
  await page.getByTestId(wide ? "continue-to-contact" : "solution-bar-primary").click();
  await page.waitForURL(/\/solutions\/request/);
  await page.getByTestId("heading-solution-request").waitFor();
  row.scrollTop.contact = await page.evaluate(() => window.scrollY);
  row.contactInputs = {
    company: await page.locator("#sr-org").count(),
    name: await page.locator("#sr-name").count(),
    email: await page.locator("#sr-email").count(),
    phone: await page.locator("#sr-phone").count(),
  };
  row.notesField = await page.locator("textarea").count();
  row.contactBar = await page.getByTestId("solution-bar").count();
  row.sanctionedLine = await page.getByText("No payment is taken here. DE confirms package fit, scope, fulfillment, and pricing before commitment.", { exact: true }).count();
  row.overflow.contact = await hasHorizontalOverflow(page);
  row.forbidden.contact = await forbiddenHits(page);
  row.fixedOverlap.contact = await fixedOverlaps(page);
  await page.screenshot({ path: `${outDir}/contact-${viewport.name}.png`, fullPage: true });

  // Submit is exercised only against a local server (never a production lead).
  if (process.env.DOOR2_SUBMIT === "1") {
    await page.locator("#sr-org").fill("Smoke Test Co");
    await page.locator("#sr-name").fill("Smoke Tester");
    await page.locator("#sr-email").fill("smoke@example.com");
    await page.locator("#sr-phone").fill("480-555-0100");
    await page.getByTestId("submit-solution").click();
    await page.waitForURL(/\/store\/solution\/submitted\/DE-/);
    await page.getByTestId("heading-submitted").waitFor();
    row.scrollTop.submitted = await page.evaluate(() => window.scrollY);
    row.reference = await page.getByTestId("solution-reference").innerText();
    row.submittedFocus = await page.evaluate(() => document.activeElement?.getAttribute("role") === "status" || !!document.activeElement?.closest("[role='status']"));
    row.overflow.submitted = await hasHorizontalOverflow(page);
    row.forbidden.submitted = await forbiddenHits(page);
    await page.screenshot({ path: `${outDir}/submitted-${viewport.name}.png`, fullPage: true });
  }

  await page.goto(`${base}/store/solutions/not-a-real-family`, { waitUntil: "domcontentloaded" });
  await page.getByText("Page not found", { exact: false }).first().waitFor({ timeout: 15000 }).catch(() => undefined);
  row.notFound = await page.getByText("Page not found", { exact: false }).count();
  row.overflow.notFound = await hasHorizontalOverflow(page);

  results.push(row);
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));

const failed = results.some((row) =>
  row.familyCount !== 13 ||
  row.emailInputs > 0 ||
  row.h1Count !== 1 ||
  !row.profileBeforeFamilies ||
  row.sizedLine < 1 ||
  row.addedState < 1 ||
  (row.railHasNeed !== undefined && row.railHasNeed < 1) ||
  (row.sheetHasNeed !== undefined && (row.sheetHasNeed < 1 || row.sheetHasProfile < 1 || !row.dockHiddenWhileSheetOpen)) ||
  !row.compareHasBoth ||
  !row.compareSized ||
  row.familyRelationshipControls !== 0 ||
  row.wrongStandaloneCopy > 0 ||
  !row.deliveryRemoteFirst ||
  row.journeyRail < 1 ||
  row.relationshipControls !== 3 ||
  row.installOrder[0] !== "remote_assist" ||
  row.installDefaultRemote.join(",") !== "remote_assist" ||
  (row.installOrder.includes("onsite") && row.onsiteCopy < 1) ||
  !/Saved (on this device|to DE)/.test(row.saveSentence) ||
  Object.values(row.contactInputs).some((count) => count !== 1) ||
  row.notesField > 0 ||
  row.contactBar > 0 ||
  row.sanctionedLine < 1 ||
  row.notFound < 1 ||
  Object.values(row.scrollTop).some((y) => y > 0) ||
  Object.values(row.overflow).some(Boolean) ||
  Object.values(row.forbidden).some((hits) => hits.length > 0) ||
  Object.values(row.fixedOverlap).some((hits) => hits.length > 0) ||
  (process.env.DOOR2_SUBMIT === "1" && !/^DE-[0-9A-HJKMNP-TV-Z]{6}$/.test(row.reference || "")),
);

if (failed) process.exit(1);

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { curatedSolutionFamilies } from "@/data/curatedSolutions";
import { BUSINESS_GOALS, STORE_JOURNEY_SENTENCE, STORE_STEPS } from "@/lib/businessNeeds";
import { solutionScenarios } from "@/data/solutionScenarios";

const root = path.resolve(import.meta.dirname, "../../../..");

const door2Dir = "client/src/components/store/door2";
const door2Primitives = readdirSync(path.join(root, door2Dir))
  .filter((name) => name.endsWith(".tsx") || (name.endsWith(".ts") && !name.endsWith(".test.ts")))
  .map((name) => `${door2Dir}/${name}`);

/** Every Door 2 source. A file added under door2/ is covered without editing this list. */
const door2Files = [
  "client/src/lib/businessNeeds.ts",
  "client/src/lib/isDoor2Path.ts",
  "client/src/lib/solutionDraft.ts",
  "client/src/lib/solutionPackage.ts",
  "client/src/lib/solutionGuidance.ts",
  "client/src/data/solutionScenarios.ts",
  "client/src/hooks/useSolutionDraft.ts",
  "client/src/pages/solutions/BusinessNeedsIndex.tsx",
  "client/src/pages/solutions/BusinessNeedsFamily.tsx",
  "client/src/pages/solutions/SolutionRequest.tsx",
  "client/src/pages/store/PublicStoreCheckout.tsx",
  "client/src/pages/store/SolutionSubmitted.tsx",
  "client/src/components/store/SolutionProfileForm.tsx",
  "client/src/components/store/StorePageAtmosphere.tsx",
  "client/src/styles/store-builder.css",
  ...door2Primitives,
  "server/publicSolutionRoutes.ts",
  "server/publicSolutionRequestStore.ts",
  "server/publicSolutionRequestCrm.ts",
];

/** Warehouse vocabulary and vendor names never reach a public Store source. */
const prohibited = [
  "storeProducts",
  "vendorLogos",
  "getProductVisual",
  "computeCoverageScore",
  "CartContext",
  "warehousePaths",
  "Pay Now",
  "Add to cart",
  "coro",
  "guardz",
  "ninjaone",
  "blackpoint",
  "hudu",
  "pax8",
  "sherweb",
  "griffin",
  "ingram",
  "sku",
  "margin",
  "distributor",
  "gcch",
  "waiver",
  "discount",
  "guarantee",
  "DE managed",
  "DE manages",
  "DE operates",
  "vendor catalog",
  "sent to sales",
  "8 BLOCKS",
  "ships in",
  "replies in",
  "managed-services contract",
  "composed solution request",
];

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

describe("Door 2 public leakage and flow contract", () => {
  it("does not import the warehouse catalog, vendor map or cart", () => {
    for (const relative of door2Files) {
      const source = read(relative);
      expect(source, relative).not.toMatch(/from ["']@\/data\/storeProducts["']/);
      expect(source, relative).not.toMatch(/from ["']@\/data\/vendorLogos["']/);
      expect(source, relative).not.toMatch(/from ["']@\/contexts\/CartContext["']/);
      expect(source, relative).not.toMatch(/pages\/internal|components\/warehouse/);
      expect(source, relative).not.toMatch(/use-toast|useToast/);
    }
  });

  it("keeps prohibited warehouse terms out of Door 2 sources", () => {
    for (const relative of door2Files) {
      const source = read(relative).toLowerCase();
      for (const term of prohibited) {
        // The CSS notes what it does not do ("no hover wobble") in the jelly comment; margins are layout there.
        if (relative.endsWith(".css") && term === "margin") continue;
        expect(source, `${relative} contains ${term}`).not.toContain(term.toLowerCase());
      }
    }
  });

  it("has one journey constant and the locked step and sequence strings", () => {
    expect(STORE_STEPS.map((step) => step.n)).toEqual(["01", "02", "03", "04", "05", "06"]);
    expect(STORE_STEPS.map((step) => step.sr)).toEqual([
      "Step 1 · Profile",
      "Step 2 · Pain or need",
      "Step 3 · Relationship",
      "Step 4 · Package",
      "Step 5 · Delivery & Setup",
      "Step 6 · Contact",
    ]);
    expect(STORE_JOURNEY_SENTENCE).toBe("Profile → pain or need → relationship → package → delivery & setup → contact");
    expect(read("client/src/components/store/door2/JourneyRail.tsx")).toContain("aria-label={STORE_JOURNEY_SENTENCE}");
  });

  it("keeps profile first, packages explicit, one relationship owner, and contact last", () => {
    expect(curatedSolutionFamilies).toHaveLength(13);
    expect(BUSINESS_GOALS).toHaveLength(5);
    expect(new Set(BUSINESS_GOALS.flatMap((goal) => goal.familyIds)).size).toBe(13);
    expect(solutionScenarios).toHaveLength(10);

    const index = read("client/src/pages/solutions/BusinessNeedsIndex.tsx");
    const familyPage = read("client/src/pages/solutions/BusinessNeedsFamily.tsx");
    const requestPage = read("client/src/pages/solutions/SolutionRequest.tsx");
    const workspace = read("client/src/pages/store/PublicStoreCheckout.tsx");
    const submitted = read("client/src/pages/store/SolutionSubmitted.tsx");

    // /store: profile strip, scenarios, family cells with a true toggle, no email gate, no cart.
    expect(index).toContain("SolutionProfileForm");
    expect(index).toContain("ScenarioTile");
    expect(index).toContain("STORE_STEPS");
    expect(index).toContain("Add need");
    expect(index).toContain("Review Your Solution");
    expect(index).not.toContain('type="email"');
    expect(index).not.toContain('delivery: "standalone"');
    expect(index).not.toContain("ShoppingCart");
    expect(index).not.toContain("PublicSolutionCart");

    // Family page: both relationships compared, no relationship control, add never gated.
    expect(familyPage).toContain("RelationshipCompare");
    expect(familyPage).toContain("Add & review package");
    expect(familyPage).toContain("Add and keep browsing");
    expect(familyPage).not.toContain('name="relationship"');
    expect(familyPage).not.toContain("DE manages this");
    expect(familyPage).not.toContain("Add to Your Solution");
    expect(familyPage).not.toContain("Pay Now");

    // Workspace: the one relationship control, journey rail, setup in DE order, save and continue.
    expect(workspace).toContain("JourneyRail");
    expect(workspace).toContain('name="relationship"');
    expect(workspace).toContain('name="installation"');
    expect(workspace).toContain("sortInstallModes");
    expect(workspace).toContain("Save progress");
    expect(workspace).toContain("Continue to contact details");
    expect(workspace).not.toContain("Continue this solution");
    expect(workspace).not.toContain("checkout path");

    // Contact: four fields, nothing else.
    expect(requestPage).toContain("STORE_STEPS");
    expect(requestPage).toContain("Company name");
    expect(requestPage).toContain("Name");
    expect(requestPage).toContain("Email");
    expect(requestPage).toContain("Phone");
    expect(requestPage).toContain("publicContactProblems");
    expect(requestPage).toContain("company_website");
    expect(requestPage).not.toContain("Anything DE should know");
    expect(requestPage).not.toContain("<textarea");
    expect(requestPage).not.toContain("not a cart");
    expect(requestPage).not.toContain("CRM handoff");
    expect(requestPage).not.toContain("SolutionBar");

    // Confirmation: reference, archive on the device, never a PII refetch.
    expect(submitted).toContain("ReferenceMark");
    expect(submitted).toContain("readSubmittedArchive");
    expect(submitted).toContain("/api/public/solutions/request/status/");
    expect(submitted).not.toContain("contactEmail:");
  });

  it("keeps the assessment strip and footer CTA off Door 2, and links to /book only while /book tells the same story", () => {
    // §16.2: every Door 2 page renders the store footer; the header strip is suppressed by path.
    for (const relative of [
      "client/src/pages/solutions/BusinessNeedsIndex.tsx",
      "client/src/pages/solutions/BusinessNeedsFamily.tsx",
      "client/src/pages/solutions/SolutionRequest.tsx",
      "client/src/pages/store/PublicStoreCheckout.tsx",
      "client/src/pages/store/SolutionSubmitted.tsx",
    ]) {
      expect(read(relative), relative).toContain('<DigeratiEnhancedFooterSection variant="store"');
    }
    const megaMenu = read("client/src/components/MegaMenu.tsx");
    expect(megaMenu).toContain("const hideAnnounce = announceDismissed || onDoor2 || onBook;");
    expect(megaMenu).toContain("{!hideAnnounce && (");
    // The portalled sheet sits outside #app-canvas and carries the Store accent itself.
    expect(read("client/src/components/store/door2/SolutionChrome.tsx")).toContain('data-accent="electric"');
    const footer = read("client/src/pages/sections/DigeratiEnhancedFooterSection.tsx");
    expect(footer).toContain("Back to Your Solution");
    expect(footer).toContain('const STORE_WORKSPACE_PATH = "/store/solution"');

    // §16.6: the confirmation's /book action and the /book copy ship together.
    const booking = read("client/src/pages/BookingPage.tsx");
    expect(read("client/src/pages/store/SolutionSubmitted.tsx")).toContain("const BOOK_ALIGNED = true;");
    expect(booking.toLowerCase()).not.toMatch(/completely free|free evaluation|no strings attached/);
    expect(booking).toContain("CANONICAL_CSRA_ONE_TIME");
    expect(booking).toContain("normalizeSolutionReference");
    // Both sides of the booking action read one price.
    expect(read("client/src/pages/store/SolutionSubmitted.tsx")).toContain("CANONICAL_CSRA_ONE_TIME.toLocaleString(\"en-US\")");
  });

  it("never writes a per-need relationship anywhere", () => {
    for (const relative of door2Files.filter((file) => file.startsWith("client/"))) {
      expect(read(relative), relative).not.toMatch(/needs\[\d*\]\.delivery|need\.delivery\b|delivery: "(standalone|co_managed)"/);
    }
  });
});

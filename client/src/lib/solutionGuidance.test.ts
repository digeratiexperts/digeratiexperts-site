import { describe, expect, it } from "vitest";
import { curatedSolutionFamilies } from "@/data/curatedSolutions";
import { emptyDraft, type SolutionDraft } from "./solutionDraft";
import {
  FAMILY_SECURITY_BLOCKS,
  HINT_RULES,
  MAX_HINTS,
  SECURITY_BLOCKS,
  coverageForFamilies,
  nextHints,
  solutionAdvisorSeed,
  suggestRelationship,
} from "./solutionGuidance";

function draftWith(partial: Partial<SolutionDraft>): SolutionDraft {
  return { ...emptyDraft(), ...partial };
}

const sized = {
  userCount: "25",
  workstationCount: "30",
  mobileDeviceCount: "15",
  siteCount: "2",
  deviceOwnership: "company" as const,
  internalIt: "no" as const,
  deviceMix: "",
  complianceNeeds: "",
  currentProvider: "",
  urgency: "",
};

describe("eight security blocks as structure", () => {
  it("names the canonical eight exactly once, Risk & Exposure as the continuous layer", () => {
    expect(SECURITY_BLOCKS.map((block) => block.label)).toEqual([
      "Identity & Access",
      "Endpoint",
      "Email & Collaboration",
      "Browser & Web",
      "Network",
      "Detection & Response",
      "Human Risk",
      "Risk & Exposure",
    ]);
    expect(SECURITY_BLOCKS.filter((block) => block.layer === "continuous").map((block) => block.id)).toEqual(["risk_exposure"]);
  });

  it("maps every family, only to real blocks, and Browser & Web to no family", () => {
    const blockIds = new Set(SECURITY_BLOCKS.map((block) => block.id));
    for (const family of curatedSolutionFamilies) {
      expect(FAMILY_SECURITY_BLOCKS[family.id], family.id).toBeDefined();
      for (const block of FAMILY_SECURITY_BLOCKS[family.id]) expect(blockIds.has(block), `${family.id} → ${block}`).toBe(true);
    }
    const coversBrowser = curatedSolutionFamilies.filter((family) => FAMILY_SECURITY_BLOCKS[family.id].includes("browser_web"));
    expect(coversBrowser).toHaveLength(0);
  });

  it("renders touched / available / Handle Our IT states and is never complete on Door 2", () => {
    const view = coverageForFamilies(["identity_access", "backup_continuity"]);
    const byId = Object.fromEntries(view.cells.map((cell) => [cell.id, cell]));
    expect(byId.identity_access.state).toBe("in_solution");
    expect(byId.identity_access.coveredBy).toEqual(["identity_access"]);
    expect(byId.endpoint.state).toBe("available");
    expect(byId.endpoint.addFamilyId).toBe("endpoint_devices");
    expect(byId.browser_web.state).toBe("handle_our_it");
    expect(view.outsideBlocks).toEqual(["backup_continuity"]);
    expect(view.complete).toBe(false);
    const everything = coverageForFamilies(curatedSolutionFamilies.map((family) => family.id));
    expect(everything.complete).toBe(false);
  });
});

describe("relationship suggestion", () => {
  it("follows internal IT and is silent when unsure", () => {
    expect(suggestRelationship({ ...sized, internalIt: "yes" })?.value).toBe("co_managed");
    expect(suggestRelationship({ ...sized, internalIt: "no" })?.value).toBe("standalone");
    expect(suggestRelationship({ ...sized, internalIt: "unsure" })).toBeNull();
    expect(suggestRelationship({ ...sized, internalIt: "" })).toBeNull();
    for (const status of ["yes", "no"] as const) {
      const suggestion = suggestRelationship({ ...sized, internalIt: status })!;
      expect(suggestion.reason).not.toMatch(/%|discount|DE managed/i);
    }
  });
});

describe("DE recommends next", () => {
  it("names the profile first when needs exist and the profile is incomplete", () => {
    const hints = nextHints(draftWith({ needs: [{ familyId: "identity_access" }] }));
    expect(hints[0].id).toBe("profile-incomplete");
    expect(hints[0].action).toEqual({ type: "edit_profile" });
  });

  it("derives add-family hints from boundaries and prerequisites, capped and dismissable", () => {
    const draft = draftWith({
      environment: sized,
      deliveryPreference: "standalone",
      needs: [{ familyId: "it_operations" }, { familyId: "hardware_lifecycle" }, { familyId: "business_communications" }],
    });
    const hints = nextHints(draft);
    expect(hints.length).toBeLessThanOrEqual(MAX_HINTS);
    expect(hints.map((hint) => hint.id)).toEqual(["it-ops-excludes-security", "it-ops-excludes-backup", "hardware-without-endpoint"]);
    for (const hint of hints) {
      expect(hint.action.type).toBe("add_family");
      expect(hint.reason.length).toBeGreaterThan(30);
      expect(hint.sourceFamilyId).toBeDefined();
    }
    const afterDismiss = nextHints(draft, ["it-ops-excludes-security", "it-ops-excludes-backup"]);
    expect(afterDismiss.map((hint) => hint.id)).toEqual(["hardware-without-endpoint", "communications-without-network"]);
    // Adding the suggested family silences the hint.
    const added = draftWith({ ...draft, needs: [...draft.needs, { familyId: "cybersecurity_operations" }] });
    expect(nextHints(added).map((hint) => hint.id)).not.toContain("it-ops-excludes-security");
  });

  it("explains a required assessment without adding a universal one", () => {
    const required = nextHints(draftWith({ environment: sized, deliveryPreference: "standalone", needs: [{ familyId: "cybersecurity_operations" }] }));
    expect(required.map((hint) => hint.id)).toContain("assessment-required");
    const notRequired = nextHints(draftWith({ environment: sized, deliveryPreference: "standalone", needs: [{ familyId: "email_collaboration" }] }));
    expect(notRequired.map((hint) => hint.id)).not.toContain("assessment-required");
  });

  it("flags Co-Managed without an internal IT owner and offers DE's recommendation instead", () => {
    const hints = nextHints(draftWith({ environment: sized, deliveryPreference: "co_managed", needs: [{ familyId: "identity_access" }] }));
    expect(hints[0].id).toBe("co-managed-without-internal-it");
    expect(hints[0].action).toEqual({ type: "set_relationship", value: "unsure" });
  });

  it("steers an on-site choice back to remote-first, naming Truck-Roll, Trip Charge and Tech Labor", () => {
    const draft = draftWith({
      environment: sized,
      deliveryPreference: "standalone",
      needs: [{ familyId: "network_connectivity" }],
      fulfillment: { installation: "onsite", remoteSupport: "" },
    });
    const hint = nextHints(draft).find((entry) => entry.kind === "setup")!;
    expect(hint.reason).toMatch(/Truck-Roll, Trip Charge and Tech Labor/);
    expect(hint.action).toEqual({ type: "set_setup", familyId: "network_connectivity", value: "remote_assist" });
  });

  it("every rule has a stable id and every hint is overridable", () => {
    expect(new Set(HINT_RULES.map((rule) => rule.id)).size).toBe(HINT_RULES.length);
    for (const rule of HINT_RULES) expect(rule.id).toMatch(/^[a-z-]+$/);
  });
});

describe("Ask DE seed", () => {
  it("speaks in public words only", () => {
    const seed = solutionAdvisorSeed(draftWith({ environment: sized, deliveryPreference: "co_managed", needs: [{ familyId: "identity_access" }] }));
    expect(seed).toContain("Identity & Access");
    expect(seed).toContain("Co-Managed");
    expect(seed).toContain("25 users");
    expect(seed).not.toMatch(/co_managed|identity_access|catalog|cart/);
    expect(solutionAdvisorSeed(emptyDraft(), { reference: "DE-4K7Q2M" })).toMatch(/^I submitted solution DE-4K7Q2M/);
    expect(solutionAdvisorSeed(emptyDraft(), { familyLabel: "Network & Connectivity" })).toMatch(/looking at Network & Connectivity/);
  });
});

import { describe, expect, it } from "vitest";
import {
  FAMILY_IDS,
  emptyDraft,
  isProfileComplete,
  parseDraft,
  patchEnvironment,
  patchFulfillment,
  profileGaps,
  profileSummary,
  recommendedIntent,
  removeNeed,
  resolvedPackages,
  summarizeForArchive,
  toRequestNeeds,
  toggleNeed,
  upsertNeed,
} from "./solutionDraft";

const sized = {
  userCount: "25",
  workstationCount: "32",
  mobileDeviceCount: "18",
  siteCount: "2",
  deviceOwnership: "hybrid" as const,
  internalIt: "no" as const,
  deviceMix: "",
  complianceNeeds: "",
  currentProvider: "",
  urgency: "",
};

describe("SolutionDraft", () => {
  it("derives the family set from the canonical data", () => {
    expect(FAMILY_IDS.size).toBe(13);
    expect(FAMILY_IDS.has("identity_access")).toBe(true);
    expect(FAMILY_IDS.has("warehouse")).toBe(false);
  });

  it("does not assign a relationship when a need is toggled on", () => {
    const draft = toggleNeed(emptyDraft(), "identity_access");
    expect(draft.needs).toEqual([{ familyId: "identity_access" }]);
    expect(draft.deliveryPreference).toBe("");
  });

  it("keeps the scenario that composed a need and never writes a per-need relationship", () => {
    const draft = upsertNeed(emptyDraft(), { familyId: "backup_continuity", source: "ransomware-recovery" });
    expect(draft.needs[0]).toEqual({ familyId: "backup_continuity", source: "ransomware-recovery" });
    expect(JSON.stringify(upsertNeed(draft, { familyId: "backup_continuity" }).needs)).not.toContain("delivery");
    expect(removeNeed(draft, "backup_continuity").needs).toEqual([]);
  });

  it("composes multiple families into one request and routes required assessment work", () => {
    const withNeeds = ["identity_access", "backup_continuity", "cybersecurity_operations", "email_collaboration", "network_connectivity"].reduce(
      (draft, familyId) => toggleNeed(draft, familyId as "identity_access"),
      emptyDraft(),
    );
    const ready = { ...withNeeds, deliveryPreference: "standalone" as const, environment: sized };
    const payload = toRequestNeeds(ready);
    expect(payload).toHaveLength(5);
    expect(payload.map((need) => need.familyId)).toEqual([
      "identity_access",
      "backup_continuity",
      "cybersecurity_operations",
      "email_collaboration",
      "network_connectivity",
    ]);
    expect(payload.every((need) => need.deliveryModel === "standalone")).toBe(true);
    expect(payload.every((need) => typeof need.offerId === "string")).toBe(true);
    // The one buyer preference is resolved per package and never left blank.
    expect(payload.every((need) => need.installation === "remote_assist")).toBe(true);
    expect(recommendedIntent(ready)).toBe("assessment");
  });

  it("derives intent from policy: quote by default, DE's recommendation when the relationship is left with DE", () => {
    const base = { ...toggleNeed(emptyDraft(), "email_collaboration"), environment: sized };
    expect(recommendedIntent({ ...base, deliveryPreference: "standalone" })).toBe("quote");
    expect(recommendedIntent({ ...base, deliveryPreference: "unsure" })).toBe("consultation");
    expect(recommendedIntent({ ...base, deliveryPreference: "" })).toBe("quote");
    expect(recommendedIntent(emptyDraft())).toBe("request");
    expect(toRequestNeeds({ ...base, deliveryPreference: "unsure" })[0]).toMatchObject({ deliveryModel: "unsure", offerId: null });
  });

  it("resolves both packages while the relationship is open and one once it is chosen", () => {
    const open = { ...toggleNeed(emptyDraft(), "identity_access"), environment: sized };
    const both = resolvedPackages(open)[0].package;
    expect("standalone" in both && "coManaged" in both).toBe(true);
    const chosen = resolvedPackages({ ...open, deliveryPreference: "co_managed" })[0].package;
    expect("offerName" in chosen && chosen.offerName).toBe("DE Co-Managed Identity Operations");
  });

  it("migrates a version-one draft and lifts a unanimous per-need relationship into the one owner", () => {
    const parsed = parseDraft({
      version: 1,
      needs: [
        { familyId: "not_a_family" },
        { familyId: "identity_access", delivery: "standalone" },
        { familyId: "backup_continuity", delivery: "standalone" },
      ],
      environment: { userCount: "12", siteCount: "2", deviceOwnership: "hybrid", internalIt: "no" },
    });
    expect(parsed.version).toBe(2);
    expect(parsed.needs).toEqual([{ familyId: "identity_access" }, { familyId: "backup_continuity" }]);
    expect(parsed.deliveryPreference).toBe("standalone");
    expect(parsed.environment.userCount).toBe("12");
    expect(parsed.environment.workstationCount).toBe("");
    expect(parsed.fulfillment).toEqual({ installation: "", remoteSupport: "" });
    expect(parsed.acceptedHints).toEqual([]);
    expect(parsed.serverDraftId).toBeNull();
  });

  it("drops mixed per-need relationships instead of guessing", () => {
    const parsed = parseDraft({
      version: 2,
      needs: [
        { familyId: "identity_access", delivery: "standalone" },
        { familyId: "backup_continuity", delivery: "co_managed" },
      ],
    });
    expect(parsed.deliveryPreference).toBe("");
    expect(parseDraft({ version: 2, needs: [{ familyId: "identity_access", delivery: "standalone" }], deliveryPreference: "co_managed" }).deliveryPreference).toBe("co_managed");
  });

  it("treats sizing profile and fulfillment as first-class saved state, and names gaps in buyer words", () => {
    let draft = emptyDraft();
    expect(profileGaps(draft.environment)).toEqual(["users", "computers", "mobile devices", "sites", "device ownership", "internal IT"]);
    draft = patchEnvironment(draft, { userCount: "25", workstationCount: "32", mobileDeviceCount: "18", siteCount: "2", deviceOwnership: "hybrid", internalIt: "no" });
    draft = patchFulfillment(draft, { installation: "remote_assist", remoteSupport: "as_needed" });
    expect(isProfileComplete(draft.environment)).toBe(true);
    expect(profileSummary(draft.environment)).toBe("25 users · 32 computers · 18 mobile devices · 2 sites");
    expect(profileSummary({ ...draft.environment, siteCount: "1", mobileDeviceCount: "0" })).toBe("25 users · 32 computers · 0 mobile devices · 1 site");
    expect(draft.fulfillment).toEqual({ installation: "remote_assist", remoteSupport: "as_needed" });
    expect(profileGaps({ ...draft.environment, siteCount: "1,000" })).toEqual(["sites"]);
  });

  it("archives a submitted solution in public words with the buyer's own contact", () => {
    const draft = { ...toggleNeed(emptyDraft(), "hardware_lifecycle"), environment: sized, deliveryPreference: "standalone" as const };
    const archive = summarizeForArchive(
      draft,
      { organizationName: "Acme", contactName: "Jo", contactEmail: "jo@acme.test", contactPhone: "480-555-0100" },
      { reference: "DE-7K3M2Q", correlationId: "corr", durable: "database", nextStep: "quote", replayed: false },
    );
    expect(archive.packages[0]).toMatchObject({ familyLabel: "Hardware & Lifecycle", installation: "remote_assist", shipmentMode: "physical", pricingLabel: "Standard price" });
    expect(archive.packages[0].lineItems[1].quantity).toBe("32 computers");
    expect(JSON.stringify(archive)).not.toMatch(/co_managed|self_install|remote_assist"?:/);
    // The device keeps a masked contact only: no raw email, no run of seven or more digits.
    expect(archive.contact).toEqual({ organizationName: "Acme", contactName: "Jo", emailMasked: "j***@acme.test", phoneLast4: "···-0100" });
    const stored = JSON.stringify(archive);
    expect(stored).not.toContain("jo@acme.test");
    expect(stored.replace(/j\*\*\*@acme\.test/, "")).not.toContain("@");
    expect(stored).not.toMatch(/\d{7,}/);
  });
});

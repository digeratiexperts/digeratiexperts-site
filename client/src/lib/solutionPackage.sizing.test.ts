import { describe, expect, it } from "vitest";
import { curatedSolutionFamilies } from "@/data/curatedSolutions";
import {
  FAMILY_PACKAGE_POLICY,
  LINE_BASIS,
  LINE_BASIS_LABELS,
  buildSolutionPackage,
  formatQuantity,
  installModeDetail,
  remoteSupportOptions,
  resolveInstallMode,
} from "./solutionPackage";

const profile = { userCount: "25", workstationCount: "32", mobileDeviceCount: "18", siteCount: "2" };

function lines(id: string) {
  for (const family of curatedSolutionFamilies) {
    const offer = family.offers.find((entry) => entry.id === id);
    if (offer) return buildSolutionPackage(family, offer.deliveryModel, profile).lineItems;
  }
  throw new Error(id);
}

describe("package line sizing is explicit per line (source of truth §6.3)", () => {
  it("has a basis for every line of every offer, in order, and nothing extra", () => {
    const offerIds = new Set<string>();
    for (const family of curatedSolutionFamilies) {
      for (const offer of family.offers) {
        offerIds.add(offer.id);
        const bases = LINE_BASIS[offer.id];
        expect(bases, `${offer.id} has no LINE_BASIS entry`).toBeDefined();
        expect(bases.length, `${offer.id}: basis count must equal includes count`).toBe(offer.includes.length);
        for (const basis of bases) expect(Object.keys(LINE_BASIS_LABELS)).toContain(basis);
      }
    }
    for (const id of Object.keys(LINE_BASIS)) expect(offerIds.has(id), `stale LINE_BASIS entry ${id}`).toBe(true);
  });

  it("matches the decided golden cells", () => {
    expect(lines("de-it-operations-standalone")[0]).toEqual({ label: "Helpdesk intake and triage", quantity: "25 users", basis: "user" });
    expect(lines("de-it-operations-standalone")[1]).toMatchObject({ label: "Routine workstation support", quantity: "32 computers", basis: "computer" });
    expect(lines("de-it-operations-standalone")[2]).toMatchObject({ quantity: "32 computers + 18 mobile devices", basis: "device" });
    expect(lines("de-identity-standalone")[0]).toMatchObject({ label: "Multi-factor authentication policy", quantity: "25 users" });
    expect(lines("de-identity-standalone")[3]).toMatchObject({ label: "Privileged-access review", quantity: "Included once", basis: "once" });
    expect(lines("de-cybersecurity-standalone")[1]).toMatchObject({ label: "Threat monitoring and triage", basis: "device" });
    expect(lines("de-network-standalone")[0]).toMatchObject({ label: "Network monitoring", quantity: "2 sites", basis: "site" });
    expect(lines("de-documentation-standalone")[1]).toMatchObject({ label: "Network and system diagrams", quantity: "2 sites" });
    expect(lines("de-awareness-standalone")[1]).toMatchObject({ label: "Phishing exercises", quantity: "25 users" });
    expect(lines("de-hardware-standalone")[0]).toMatchObject({ label: "Requirements-based selection", quantity: "Included once", basis: "once" });
    expect(lines("de-hardware-standalone")[1]).toMatchObject({ label: "Secure provisioning", quantity: "32 computers", basis: "computer" });
    expect(lines("de-hardware-standalone")[2]).toMatchObject({ label: "Deployment coordination", quantity: "2 sites", basis: "site" });
    expect(lines("de-continuity-standalone")[0]).toMatchObject({ label: "Backup policy and monitoring", quantity: "32 computers", basis: "computer" });
    const allQuantities = curatedSolutionFamilies.flatMap((family) =>
      family.offers.flatMap((offer) => buildSolutionPackage(family, offer.deliveryModel, profile).lineItems.map((line) => line.quantity)),
    );
    expect(allQuantities.some((quantity) => /^1 computers|^1 users|^1 sites/.test(quantity))).toBe(false);
  });

  it("prints honest basis phrases when a count is not set, and singularises", () => {
    expect(formatQuantity("user", {})).toBe("Per covered user");
    expect(formatQuantity("device", {})).toBe("Per approved device");
    expect(formatQuantity("computer", {})).toBe("Per primary computer");
    expect(formatQuantity("site", {})).toBe("Per site");
    expect(formatQuantity("once", {})).toBe("Included once");
    expect(formatQuantity("user", { userCount: "1" })).toBe("1 user");
    expect(formatQuantity("site", { siteCount: "1" })).toBe("1 site");
    expect(formatQuantity("device", { mobileDeviceCount: "1" })).toBe("1 mobile device");
    expect(formatQuantity("device", { workstationCount: "12", mobileDeviceCount: "1" })).toBe("12 computers + 1 mobile device");
    expect(formatQuantity("computer", { workstationCount: "12" })).toBe("12 computers");
  });
});

describe("Delivery & Setup policy", () => {
  it("gives advisory families a remote-only setup and says so", () => {
    for (const id of ["compliance_risk", "documentation_standards", "technology_strategy"] as const) {
      expect(FAMILY_PACKAGE_POLICY[id].installModes).toEqual(["remote_assist"]);
      expect(FAMILY_PACKAGE_POLICY[id].shipmentMode).toBe("none");
    }
    const family = curatedSolutionFamilies.find((entry) => entry.id === "technology_strategy")!;
    expect(buildSolutionPackage(family, "standalone", profile).technicianCopy).toMatch(/^No on-site visit is offered/);
  });

  it("labels the install mode by what actually ships", () => {
    expect(installModeDetail("self_install", "none").label).toBe("Set it up yourself, DE guides remotely");
    expect(installModeDetail("self_install", "none").label).not.toContain("Ship");
    expect(installModeDetail("self_install", "physical").label).toBe("Shipped to you, set it up yourself");
    expect(installModeDetail("self_install", "conditional").label).toBe("Shipped to you, set it up yourself");
    expect(installModeDetail("remote_assist", "physical").detail).toMatch(/ships to you/);
    expect(installModeDetail("onsite", "none").detail).toMatch(/Truck-Roll, Trip Charge and Tech Labor/);
  });

  it("resolves one buyer preference per package, falling back with a reason and never to on-site", () => {
    const hardware = curatedSolutionFamilies.find((entry) => entry.id === "hardware_lifecycle")!;
    const itOps = curatedSolutionFamilies.find((entry) => entry.id === "it_operations")!;
    const advisory = curatedSolutionFamilies.find((entry) => entry.id === "compliance_risk")!;
    const hw = buildSolutionPackage(hardware, "standalone", profile);
    const ops = buildSolutionPackage(itOps, "standalone", profile);
    const adv = buildSolutionPackage(advisory, "standalone", profile);
    expect(resolveInstallMode("onsite", hw)).toEqual({ mode: "onsite" });
    expect(resolveInstallMode("self_install", ops)).toEqual({ mode: "remote_assist", reason: "shipping does not apply to this package" });
    expect(resolveInstallMode("onsite", adv)).toEqual({ mode: "remote_assist", reason: "on-site is not offered for this package" });
    expect(resolveInstallMode("", hw)).toEqual({ mode: "remote_assist" });
    expect(resolveInstallMode("unsure", adv)).toEqual({ mode: "remote_assist" });
  });

  it("suggests remote support from the relationship and keeps all four options", () => {
    expect(remoteSupportOptions("standalone").suggested).toBe("as_needed");
    expect(remoteSupportOptions("co_managed").suggested).toBe("ongoing");
    expect(remoteSupportOptions("unsure").suggested).toBe("unsure");
    expect(remoteSupportOptions("").options).toEqual(["none", "as_needed", "ongoing", "unsure"]);
  });
});

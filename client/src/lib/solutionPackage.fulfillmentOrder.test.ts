import { describe, expect, it } from "vitest";
import { curatedSolutionFamilies } from "@/data/curatedSolutions";
import {
  FAMILY_PACKAGE_POLICY,
  INSTALL_MODE_LABELS,
  INSTALL_MODE_ORDER,
  buildSolutionPackage,
  preferredInstallMode,
  sortInstallModes,
} from "./solutionPackage";

/**
 * DE fulfillment rule (Joe, 2026-09-27): remote support and shipping come
 * before Truck-Roll, Trip Charge and Tech Labor. Every package lists and
 * defaults installation in that order; on-site is never first.
 */
describe("DE fulfillment order", () => {
  it("is remote setup, then shipped/self-install, then on-site", () => {
    expect(INSTALL_MODE_ORDER).toEqual(["remote_assist", "self_install", "onsite"]);
    expect(sortInstallModes(["onsite", "self_install", "remote_assist"])).toEqual(["remote_assist", "self_install", "onsite"]);
    expect(sortInstallModes(["onsite"])).toEqual(["onsite"]);
    expect(preferredInstallMode(["onsite", "remote_assist"])).toBe("remote_assist");
    expect(preferredInstallMode([])).toBeNull();
  });

  it("names on-site work for what it costs and never puts it first", () => {
    expect(INSTALL_MODE_LABELS.onsite.detail).toMatch(/Truck-Roll, Trip Charge and Tech Labor/);
    for (const family of curatedSolutionFamilies) {
      const policy = FAMILY_PACKAGE_POLICY[family.id];
      expect(policy.installModes[0], family.id).not.toBe("onsite");
      expect(policy.installModes, family.id).toEqual(sortInstallModes(policy.installModes));
      for (const delivery of ["standalone", "co_managed"] as const) {
        const view = buildSolutionPackage(family, delivery, { userCount: "25", workstationCount: "30", siteCount: "2" });
        expect(view.installModes, `${family.id}/${delivery}`).toEqual(sortInstallModes(policy.installModes));
        expect(preferredInstallMode(view.installModes), `${family.id}/${delivery}`).not.toBe("onsite");
        if (view.installModes.includes("onsite")) {
          expect(view.technicianCopy, `${family.id}/${delivery}`).toMatch(/Truck-Roll, Trip Charge and Tech Labor/);
          expect(view.technicianCopy, `${family.id}/${delivery}`).toMatch(/^Remote setup and shipped equipment come first/);
        }
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import { toClientProjection, toPublicCatalog } from "./clientProjection";
import { findLifecycleDisclosures } from "./tenantIdentity";

describe("client projection allowlist", () => {
  it("keeps client quote fields and drops warehouse fields", () => {
    const safe = toClientProjection({
      status: "accepted",
      quoteId: 88,
      title: "Backup",
      items: [{ name: "Backup", quantity: 2, amount: 10, sku: "VEEAM-1", unitCost: 4, vendorName: "Veeam" }],
      margin: 40,
      distributor: "Pax8",
      accountLifecycleStatus: "At Risk",
      account: { lifecycle: "Suspect", name: "Acme" },
    });
    expect(safe).toEqual({
      status: "accepted",
      quoteId: 88,
      title: "Backup",
      items: [{ name: "Backup", quantity: 2, amount: 10 }],
    });
    expect(findLifecycleDisclosures(safe)).toEqual([]);
  });

  it("drops a lifecycle value that arrived on an allowed field", () => {
    expect(toClientProjection({ status: "At Risk", title: "Plan" })).toEqual({ title: "Plan" });
  });

  it("strips internal keys from a public catalog without dropping published tiers", () => {
    const catalog = toPublicCatalog({
      tiers: [{ name: "IT", publicPrice: 1600 }],
      margin: 22,
      vendorName: "Guardz",
      sku: "GUARDZ-PRO",
      note: "Do Not Engage",
    });
    expect(catalog).toEqual({ tiers: [{ name: "IT", publicPrice: 1600 }] });
    expect(findLifecycleDisclosures(catalog)).toEqual([]);
  });
});
import { describe, expect, it } from "vitest";
import { KITS_PUBLISHABLE, listStoreCatalog } from "./deStoreCatalog";
import { WAZUH_COLLECTION_PLACEHOLDER } from "./deStoreLegalCopy";
import { termLabel } from "./deStoreContract";

describe("store catalog", () => {
  it("returns no published listings by default", () => {
    expect(listStoreCatalog()).toEqual([]);
    expect(KITS_PUBLISHABLE).toBe(false);
  });

  it("hides kit listings while the Wazuh collection placeholder remains", () => {
    const preview = listStoreCatalog({ previewEnabled: true });
    expect(preview.some((item) => item.isKit)).toBe(false);
    expect(preview.every((item) => item.previewOnly)).toBe(true);
    expect(preview.every((item) => item.unitAmountCents == null)).toBe(true);
  });

  it("formats Hub term labels as 1 month or n months", () => {
    expect(termLabel(1)).toBe("1 month");
    expect(termLabel(12)).toBe("12 months");
  });

  it("keeps the Wazuh collection placeholder in the legal notice", () => {
    expect(WAZUH_COLLECTION_PLACEHOLDER).toBe("{{WAZUH_COLLECTION}}");
  });
});

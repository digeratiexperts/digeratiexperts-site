import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_CREDIT_LINE,
  PAID_STABILIZATION_PRICE,
  SECURITY_SNAPSHOT_PRICE,
} from "./assessmentOffers";

describe("assessment offer wording", () => {
  it("keeps Joseph's approved price and credit lines in one place", () => {
    expect(PAID_STABILIZATION_PRICE).toBe("Starts at $2,000, quoted before work begins.");
    expect(SECURITY_SNAPSHOT_PRICE).toBe(
      "$249 for qualified businesses, or free when DE waives the fee.",
    );
    expect(ASSESSMENT_CREDIT_LINE).toBe(
      "The full amount paid is credited toward your first managed-services agreement or a qualifying DE Store purchase made within 30 days after your readout.",
    );
  });
});

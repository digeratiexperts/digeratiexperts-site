import { describe, expect, it } from "vitest";
import {
  allowedStaffTransitions,
  formatServiceRequestNumber,
  isValidPhone,
  unfilledRequiredChips,
  validateServiceRequestFields,
} from "./serviceRequests";

const TODAY = "2026-10-06";

const loaner = (over: Record<string, unknown> = {}) => ({
  requestedForUserId: "u1",
  contactPhone: "602-555-0100",
  deviceKind: "laptop",
  neededFrom: "2026-10-06",
  loanUntil: "2026-10-06",
  siteId: "s1",
  addressNotClientLocation: false,
  reason: "Repair",
  ...over,
});

describe("service request rules", () => {
  it("formats numbers per type", () => {
    expect(formatServiceRequestNumber("loaner_computer", 123)).toBe("LNR-000123");
    expect(formatServiceRequestNumber("return_computer", 7)).toBe("RTN-000007");
    expect(formatServiceRequestNumber("mobile_request", 42)).toBe("MOB-000042");
  });

  it("accepts common phone formats and refuses junk", () => {
    for (const ok of ["602-555-0100", "(602) 555-0100", "+1 602 555 0100", "6025550100 x12", "602.555.0100 ext. 4"]) {
      expect(isValidPhone(ok)).toBe(true);
    }
    for (const bad of ["call me", "12345", "602-555-0100-99999999999", "<script>"]) expect(isValidPhone(bad)).toBe(false);
  });

  it("allows a same-day loan and refuses yesterday", () => {
    expect(validateServiceRequestFields("loaner_computer", loaner(), TODAY).errors).toEqual({});
    expect(validateServiceRequestFields("loaner_computer", loaner({ neededFrom: "2026-10-05", loanUntil: "2026-10-07" }), TODAY).errors.neededFrom).toBeTruthy();
  });

  it("refuses an impossible calendar date", () => {
    expect(validateServiceRequestFields("loaner_computer", loaner({ neededFrom: "2026-02-30" }), TODAY).errors.neededFrom).toBeTruthy();
  });

  it("accepts ZIP and ZIP+4 for a US custom address only", () => {
    const addr = (zip: string) => ({ street: "1 A St", city: "Mesa", state: "Arizona", country: "United States of America", zip });
    const run = (zip: string) =>
      validateServiceRequestFields("loaner_computer", loaner({ siteId: null, addressNotClientLocation: true, customAddress: addr(zip) }), TODAY).errors;
    expect(run("85308")).toEqual({});
    expect(run("85308-9650")).toEqual({});
    expect(run("8530")["customAddress.zip"]).toBeTruthy();
    expect(run("85308-96")["customAddress.zip"]).toBeTruthy();
  });

  it("lists chips for unfilled required fields in page order and drops them as fields fill", () => {
    const empty = { requestedForUserId: "u1", siteId: "s1", contactPhone: "", neededFrom: "", loanUntil: "", reason: "" };
    expect(unfilledRequiredChips("loaner_computer", empty).map((c) => c.label)).toEqual([
      "Contact phone number",
      "Needed from date",
      "Loan until",
      "Reason for a loaner computer",
    ]);
    expect(unfilledRequiredChips("loaner_computer", { ...empty, contactPhone: "1" }).map((c) => c.field)).not.toContain("contactPhone");
    const ret = { requestedForUserId: "u1", siteId: "s1", contactPhone: "", returnReason: "user_leaving", assetId: "", accessories: "" };
    expect(unfilledRequiredChips("return_computer", ret).map((c) => c.field)).toEqual(["contactPhone", "assetId", "accessories"]);
    expect(unfilledRequiredChips("return_computer", { ...ret, assetNotListed: true }).map((c) => c.field)).not.toContain("assetId");
  });

  it("keeps staff transitions inside each lifecycle", () => {
    expect(allowedStaffTransitions("loaner_computer", "submitted")).toContain("device_assigned");
    expect(allowedStaffTransitions("loaner_computer", "submitted")).not.toContain("returned");
    expect(allowedStaffTransitions("return_computer", "received")).toEqual(["restocked", "disposed"]);
    expect(allowedStaffTransitions("return_computer", "closed")).toEqual([]);
  });

  it("validates the canonical mobile request family and activity", () => {
    const valid = {
      requestedForUserId: "u1",
      activity: "equipment_swap",
      mobileNumber: "602-555-0100",
      carrier: "Example Carrier",
      deviceIdentifier: "IMEI-EXAMPLE",
      effectiveDate: "2026-10-07",
      details: "Replace the assigned phone and keep the existing line.",
    };
    expect(validateServiceRequestFields("mobile_request", valid, TODAY).errors).toEqual({});
    expect(validateServiceRequestFields("mobile_request", { ...valid, activity: "made_up_activity" }, TODAY).errors.activity).toBeTruthy();
    expect(validateServiceRequestFields("mobile_request", { ...valid, effectiveDate: "2026-10-05" }, TODAY).errors.effectiveDate).toBeTruthy();
    expect(unfilledRequiredChips("mobile_request", { requestedForUserId: "u1", activity: "", details: "" }).map((x) => x.field)).toEqual(["activity", "details"]);
    expect(allowedStaffTransitions("mobile_request", "submitted")).toContain("completed");
    expect(allowedStaffTransitions("mobile_request", "completed")).toEqual(["closed"]);
  });
});

describe("holds", () => {
  it("allows 1 to 180 days and only on open requests", async () => {
    const { canHold, checkHoldUntil } = await import("./serviceRequests");
    expect(checkHoldUntil("2026-10-07", "2026-10-06")).toBeNull();
    expect(checkHoldUntil("2026-10-06", "2026-10-06")).toMatch(/tomorrow/);
    expect(checkHoldUntil("2027-05-01", "2026-10-06")).toMatch(/180 days/);
    expect(checkHoldUntil("soon", "2026-10-06")).toMatch(/date/);
    expect(canHold("submitted")).toBe(true);
    expect(canHold("on_hold")).toBe(false);
    expect(canHold("closed")).toBe(false);
    expect(canHold("in_basket")).toBe(false);
  });
});

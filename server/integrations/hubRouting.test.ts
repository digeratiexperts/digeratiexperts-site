import { describe, expect, it } from "vitest";
import { DE_SYNC_EVENT_TYPES, type DeSyncEventType } from "./deSyncContract";
import { PORTAL_COMMANDS } from "./deSyncRoutes";
import { hubPathForEnvelope } from "./techSalesClient";

const PORTAL_PATH = "/api/integrations/v1/portal/commands";

describe("Hub routing by (source, eventType)", () => {
  it("sends a website quote.requested to the website quote intake", () => {
    expect(hubPathForEnvelope("website", "quote.requested")).toBe(
      "/api/integrations/v1/website/quote-requests",
    );
  });

  it("refuses a portal-sourced quote.requested instead of posting it to a website route", () => {
    expect(() => hubPathForEnvelope("portal", "quote.requested")).toThrow(/no Hub portal route/);
  });

  it("refuses every website-only event type when it is portal-sourced", () => {
    for (const type of [
      "lead.created",
      "assessment.submitted",
      "store.order_created",
      "referral.submitted",
      "consultation.booked",
    ] as DeSyncEventType[]) {
      expect(() => hubPathForEnvelope("portal", type)).toThrow();
    }
  });

  it("sends portal commands to the Hub portal route", () => {
    expect(hubPathForEnvelope("portal", "account.profile_update_requested")).toBe(PORTAL_PATH);
    expect(hubPathForEnvelope("portal", "quote.response_submitted")).toBe(PORTAL_PATH);
  });

  it("every accepted portal command has a deliverable portal route", () => {
    expect(PORTAL_COMMANDS).not.toContain("quote.requested");
    for (const type of PORTAL_COMMANDS) {
      expect(DE_SYNC_EVENT_TYPES).toContain(type);
      expect(hubPathForEnvelope("portal", type)).toBe(PORTAL_PATH);
    }
  });
});

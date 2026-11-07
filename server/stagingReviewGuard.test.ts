import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertMutationAllowed,
  isStagingReview,
  shouldBlockMutation,
  stagingReviewStatus,
} from "./stagingReviewGuard";

const ORIGINAL = process.env.DE_STAGING_REVIEW;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.DE_STAGING_REVIEW;
  else process.env.DE_STAGING_REVIEW = ORIGINAL;
  vi.restoreAllMocks();
});

describe("staging review guard", () => {
  it("is off by default so production behavior is unchanged", () => {
    delete process.env.DE_STAGING_REVIEW;
    expect(isStagingReview()).toBe(false);
    expect(stagingReviewStatus()).toBe("off");
    expect(shouldBlockMutation("zoho ticket create")).toBe(false);
    expect(() => assertMutationAllowed("hub event")).not.toThrow();
  });

  it("stays off for empty or falsy values", () => {
    for (const value of ["", "0", "false", "no", "off", " "]) {
      process.env.DE_STAGING_REVIEW = value;
      expect(isStagingReview(), `value=${JSON.stringify(value)}`).toBe(false);
    }
  });

  it("activates for the documented truthy values", () => {
    for (const value of ["1", "true", "TRUE", "yes", "on", " 1 "]) {
      process.env.DE_STAGING_REVIEW = value;
      expect(isStagingReview(), `value=${JSON.stringify(value)}`).toBe(true);
      expect(stagingReviewStatus()).toBe("locked_down");
    }
  });

  it("blocks soft mutations when locked down", () => {
    process.env.DE_STAGING_REVIEW = "1";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(shouldBlockMutation("outbound email: lead notification")).toBe(true);
  });

  it("throws on hard mutations when locked down", () => {
    process.env.DE_STAGING_REVIEW = "1";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertMutationAllowed("Hub event delivery: order.created")).toThrow(
      /Staging review mode/,
    );
  });
});

describe("credential-independent lockdown", () => {
  it("reports Zoho as unconfigured even when credentials are present", async () => {
    process.env.DE_STAGING_REVIEW = "1";

    vi.resetModules();
    // A Zoho Connect grant covering CRM and the Desk: credentials present.
    const { seedZohoConnectGrant, clearZohoConnectTestEnv } = await import("./zoho/oauth/testing/connectGrant");
    await seedZohoConnectGrant();
    const { zohoClient } = await import("./zoho/zohoClient");

    // This is the whole point of the switch: credentials present, writes still refused.
    expect(zohoClient.isConfigured()).toBe(false);
    expect(zohoClient.isDeskConfigured()).toBe(false);

    process.env.DE_STAGING_REVIEW = "0";
    expect(zohoClient.isConfigured()).toBe(true);
    expect(zohoClient.isDeskConfigured()).toBe(true);
    clearZohoConnectTestEnv();
  });
});

import { describe, expect, it, afterEach } from "vitest";
import {
  emptyDraft,
  parseDraft,
  recommendedIntent,
  writeSolutionDraft,
} from "./solutionDraft";
import { situationFromDraft, situationDoorCopy, situationSubmitPayload } from "./anonymousSituation";

const sized = {
  userCount: "25",
  workstationCount: "32",
  mobileDeviceCount: "18",
  siteCount: "2",
  deviceOwnership: "hybrid" as const,
  internalIt: "no" as const,
  deviceMix: "Jo at Acme, jo@acme.test, 480-555-0100",
  complianceNeeds: "HIPAA — call Jane Doe",
  currentProvider: "Acme IT",
  urgency: "ASAP — email ceo@acme.test",
};

describe("situationFromDraft", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("projects operating facts and drops compatibility free-text that can hold identity", () => {
    const draft = parseDraft({
      ...emptyDraft(),
      environment: sized,
      needs: [{ familyId: "identity_access", source: "phishing-inbox" }],
      deliveryPreference: "standalone",
      fulfillment: { installation: "remote_assist", remoteSupport: "as_needed" },
    });
    const situation = situationFromDraft(draft);
    expect(situation).toMatchObject({
      users: "25",
      workstations: "32",
      mobiles: "18",
      sites: "2",
      deviceOwnership: "hybrid",
      internalIt: "no",
      relationship: "standalone",
      installation: "remote_assist",
      needs: [{ familyId: "identity_access", source: "phishing-inbox" }],
      intent: recommendedIntent(draft),
    });
    const json = JSON.stringify(situation);
    expect(json).not.toContain("jo@acme.test");
    expect(json).not.toContain("Jane Doe");
    expect(json).not.toContain("480-555-0100");
    expect(json).not.toContain("Acme IT");
    expect(json).not.toContain("ceo@acme.test");
  });

  it("never writes identity keys into the draft even when a poisoned object is parsed", () => {
    const store: Record<string, string> = {};
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
      },
      dispatchEvent: () => true,
    };
    writeSolutionDraft(
      parseDraft({
        environment: {
          userCount: "8",
          workstationCount: "8",
          mobileDeviceCount: "0",
          siteCount: "1",
          deviceOwnership: "company",
          internalIt: "no",
        },
        needs: [{ familyId: "email_collaboration" }],
        email: "jo@acme.test",
        fullName: "Jo Example",
        phone: "480-555-0100",
        company: "Acme",
      }),
    );
    const stored = store["de-solution-draft-v2"] ?? "";
    expect(stored).toContain("email_collaboration");
    expect(stored).not.toContain("jo@acme.test");
    expect(stored).not.toContain("Jo Example");
    expect(stored).not.toContain("480-555-0100");
    expect(JSON.stringify(situationSubmitPayload())).not.toMatch(/jo@acme\.test|Jo Example|480-555-0100/);
  });

  it("adapts each public door to advertise another path, without storing a person", () => {
    const situation = situationFromDraft(
      parseDraft({ environment: sized, needs: [{ familyId: "cybersecurity_operations" }] }),
    )!;
    const assessment = situationDoorCopy(situation, "assessment");
    expect(assessment.headline).toMatch(/assessment/i);
    expect(assessment.continueHref).toBe("/store/solution");
    expect(assessment.privacy).toMatch(/No name, email, or phone/);
    expect(situationDoorCopy(situation, "contact").headline).toMatch(/another way in/i);
    expect(situationDoorCopy(situation, "booking").continueLabel).toBe("Continue your solution");
    expect(situationDoorCopy(situationFromDraft(parseDraft({ environment: { userCount: "8" } }))!, "assessment").continueHref).toBe(
      "/store",
    );
  });
});

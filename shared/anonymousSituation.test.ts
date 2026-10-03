import { describe, expect, it } from "vitest";
import { curatedSolutionFamilies } from "../client/src/data/curatedSolutions";
import {
  SITUATION_FAMILY_IDS,
  SITUATION_FAMILY_LABELS,
  SITUATION_IDENTITY_KEYS,
  appendSituationToDescription,
  emptyAnonymousSituation,
  formatSituationForCrm,
  hasUsableSituation,
  parseAnonymousSituation,
  situationPublicLine,
  suggestedContactService,
} from "./anonymousSituation";

describe("anonymousSituation", () => {
  it("keeps family ids and labels aligned with the Store catalog", () => {
    expect(SITUATION_FAMILY_IDS).toEqual(curatedSolutionFamilies.map((family) => family.id));
    for (const family of curatedSolutionFamilies) {
      expect(SITUATION_FAMILY_LABELS[family.id]).toBe(family.label);
    }
  });

  it("is unusable until an operating fact exists", () => {
    expect(hasUsableSituation(emptyAnonymousSituation())).toBe(false);
    expect(parseAnonymousSituation({})).toBeNull();
    expect(parseAnonymousSituation(null)).toBeNull();
  });

  it("keeps counts, profile, needs, and relationship — and drops identity plus unknown keys", () => {
    const parsed = parseAnonymousSituation({
      version: 99,
      users: "25",
      workstations: "32",
      mobiles: "18",
      sites: "2",
      deviceOwnership: "hybrid",
      internalIt: "no",
      relationship: "co_managed",
      installation: "remote_assist",
      remoteSupport: "as_needed",
      intent: "assessment",
      needs: [
        { familyId: "identity_access", source: "phishing-inbox" },
        { familyId: "not_a_family" },
        { familyId: "identity_access" },
        { familyId: "backup_continuity", source: "Joe at Acme <jo@acme.test>" },
      ],
      email: "jo@acme.test",
      fullName: "Jo Example",
      phone: "480-555-0100",
      company: "Acme",
      contactEmail: "jo@acme.test",
      organizationName: "Acme",
      message: "Call me at 480-555-0100",
      currentProvider: "Acme IT",
      serverDraftId: "secret-draft",
      extra: { nested: true },
    });
    expect(parsed).toEqual({
      version: 1,
      users: "25",
      workstations: "32",
      mobiles: "18",
      sites: "2",
      deviceOwnership: "hybrid",
      internalIt: "no",
      relationship: "co_managed",
      installation: "remote_assist",
      remoteSupport: "as_needed",
      intent: "assessment",
      needs: [{ familyId: "identity_access", source: "phishing-inbox" }, { familyId: "backup_continuity" }],
    });
    const json = JSON.stringify(parsed);
    for (const key of SITUATION_IDENTITY_KEYS) {
      expect(json).not.toContain(`"${key}"`);
    }
    expect(json).not.toContain("jo@acme.test");
    expect(json).not.toContain("Acme");
    expect(json).not.toContain("480-555-0100");
    expect(json).not.toContain("secret-draft");
  });

  it("rejects counts that are not plain integers", () => {
    expect(parseAnonymousSituation({ users: "25 people" })).toBeNull();
    expect(parseAnonymousSituation({ users: "jo@acme.test" })).toBeNull();
    expect(parseAnonymousSituation({ users: "-1" })).toBeNull();
    expect(parseAnonymousSituation({ sites: "1,000" })).toBeNull();
  });

  it("speaks in public words for UI and CRM, never enums or identity", () => {
    const situation = parseAnonymousSituation({
      users: "1",
      sites: "2",
      deviceOwnership: "company",
      internalIt: "yes",
      needs: [{ familyId: "identity_access" }],
      relationship: "standalone",
      installation: "remote_assist",
      intent: "quote",
    });
    expect(situation).not.toBeNull();
    const line = situationPublicLine(situation!);
    expect(line).toContain("1 user");
    expect(line).toContain("2 sites");
    expect(line).toContain("Identity & Access");
    expect(line).toContain("Standalone");
    expect(line).not.toMatch(/identity_access|standalone|co_managed/);
    const crm = formatSituationForCrm(situation!);
    expect(crm).toContain("anonymous, no contact fields");
    expect(crm).toContain("Remote DE setup");
    expect(crm).not.toMatch(/@|480-|fullName|email/);
    expect(appendSituationToDescription("Assessment request from lead_form", situation)).toContain(
      "Assessment request from lead_form",
    );
  });

  it("suggests a contact service only when the needs are unambiguous", () => {
    expect(
      suggestedContactService(parseAnonymousSituation({ needs: [{ familyId: "cybersecurity_operations" }] })!),
    ).toBe("managed-security");
    expect(suggestedContactService(parseAnonymousSituation({ needs: [{ familyId: "it_operations" }] })!)).toBe(
      "managed-it",
    );
    expect(suggestedContactService(parseAnonymousSituation({ needs: [{ familyId: "compliance_risk" }] })!)).toBe(
      "compliance",
    );
    expect(
      suggestedContactService(
        parseAnonymousSituation({
          needs: [{ familyId: "cybersecurity_operations" }, { familyId: "it_operations" }],
        })!,
      ),
    ).toBe("");
    expect(suggestedContactService(parseAnonymousSituation({ intent: "assessment", users: "8" })!)).toBe("assessment");
  });
});

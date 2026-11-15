import { describe, expect, it } from "vitest";
import { SITUATION_FAMILY_IDS } from "./anonymousSituation";
import {
  BANNED_CLAIMS,
  INTENTS,
  PAGE_SERVICES,
  PROFILE_DRAFT_CONSENT_TEXT,
  SCENARIOS,
  SCENARIO_PAGE_SERVICES,
  localMatch,
  matchFromIds,
  matchFromScenario,
  planText,
  sanitizeMatch,
} from "./situationMatch";

describe("situation match catalog", () => {
  it("gives every site situation its page services, and only real ones", () => {
    for (const s of SCENARIOS) {
      expect(SCENARIO_PAGE_SERVICES[s.id], s.id).toBeTruthy();
      SCENARIO_PAGE_SERVICES[s.id].forEach((v) => expect(PAGE_SERVICES[v], v).toBeTruthy());
    }
    Object.values(PAGE_SERVICES).forEach((p) => expect(SITUATION_FAMILY_IDS).toContain(p.familyId));
  });

  it("never says Digerati alone, and no read makes a claim", () => {
    const all = JSON.stringify({ PAGE_SERVICES, INTENTS, PROFILE_DRAFT_CONSENT_TEXT });
    expect(all).not.toMatch(/Digerati(?!\s|\\u00a0|&nbsp;)|Digerati\s(?!Experts)/);
    INTENTS.forEach((i) => expect(BANNED_CLAIMS.test(i.read), i.read).toBe(false));
  });

  it("matches plain words and typos to the right card", () => {
    expect(localMatch("someone clickd a phising email").scenarioIds[0]).toBe("phishing-close-call");
    expect(localMatch("our only IT person left and nobody knows the passwords").scenarioIds[0]).toBe("it-person-left");
    expect(localMatch("hello there").confident).toBe(false);
  });

  it("drops anything not on the allow-lists", () => {
    const r = sanitizeMatch({ source: "de-desk", scenarioIds: ["nope", "auditor-evidence"], pageServiceIds: ["x" as any, "vcio"], familyIds: ["evil" as any], intentIds: ["zzz"], summary: "We guarantee it for $5", confident: true });
    expect(r.scenarioIds).toEqual(["auditor-evidence"]);
    expect(r.pageServiceIds).toEqual(["vcio"]);
    expect(r.familyIds).toEqual([]);
    expect(r.summary).toBe("");
    const m = matchFromIds({ scenarioIds: ["auditor-evidence"], serviceIds: ["made-up", "vcio-services"] }, ["vcio-services"]);
    expect(m.serviceIds).toEqual(["vcio-services"]);
  });

  it("builds the copyable plan from reviewed words with the Fit Call link", () => {
    const m = matchFromScenario("ransomware-recovery")!;
    const t = planText(m, "We don't know if backups work");
    expect(t).toContain("https://meet.digerati-experts.com/");
    expect(t).toContain("Digerati Experts");
  });
});

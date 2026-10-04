import { describe, expect, it } from "vitest";
import { curatedSolutionFamilies } from "./curatedSolutions";
import { composeScenario, getScenarioById, SCENARIO_GROUPS, solutionScenarios } from "./solutionScenarios";

const familyIds = new Set(curatedSolutionFamilies.map((family) => family.id));

describe("Store scenario starters", () => {
  it("are ten real situations composed only from the 13 canonical families", () => {
    expect(solutionScenarios).toHaveLength(10);
    const ids = new Set(solutionScenarios.map((scenario) => scenario.id));
    expect(ids.size).toBe(10);
    for (const scenario of solutionScenarios) {
      expect(scenario.familyIds.length, scenario.id).toBeGreaterThanOrEqual(2);
      expect(scenario.familyIds.length, scenario.id).toBeLessThanOrEqual(3);
      expect(new Set(scenario.familyIds).size, scenario.id).toBe(scenario.familyIds.length);
      for (const id of scenario.familyIds) expect(familyIds.has(id), `${scenario.id} → ${id}`).toBe(true);
      expect(Object.keys(scenario.why).sort(), scenario.id).toEqual([...scenario.familyIds].sort());
      expect(scenario.title.length, scenario.id).toBeLessThanOrEqual(64);
    }
  });

  it("only suggests a relationship with a reason, never a discount, never 'DE managed'", () => {
    for (const scenario of solutionScenarios) {
      const text = JSON.stringify(scenario).toLowerCase();
      expect(text, scenario.id).not.toMatch(/\d+\s*%|discount/);
      expect(text, scenario.id).not.toMatch(/de managed|de manages|de operates/);
      expect(text, scenario.id).not.toMatch(/replies in|minutes|guarantee/);
      if (scenario.relationship.suggest !== "profile") {
        expect(scenario.relationship.reason.length, scenario.id).toBeGreaterThan(40);
      }
    }
  });

  it("puts every starter in one of the three Store groups, each group non-empty", () => {
    const groupIds = new Set(SCENARIO_GROUPS.map((group) => group.id));
    expect(SCENARIO_GROUPS).toHaveLength(3);
    for (const scenario of solutionScenarios) expect(groupIds.has(scenario.group), scenario.id).toBe(true);
    for (const group of SCENARIO_GROUPS) expect(solutionScenarios.some((scenario) => scenario.group === group.id), group.id).toBe(true);
  });

  it("makes every family reachable from at least one starter", () => {
    const reachable = new Set(solutionScenarios.flatMap((scenario) => scenario.familyIds));
    const unreachable = [...familyIds].filter((id) => !reachable.has(id));
    expect(unreachable).toEqual([]);
  });

  it("composes honestly against an existing draft", () => {
    const scenario = getScenarioById("phishing-close-call")!;
    expect(composeScenario(scenario, [])).toEqual({ add: scenario.familyIds, alreadyIn: [] });
    expect(composeScenario(scenario, ["identity_access"])).toEqual({
      add: ["security_awareness", "email_collaboration"],
      alreadyIn: ["identity_access"],
    });
    expect(getScenarioById("nope")).toBeNull();
  });
});

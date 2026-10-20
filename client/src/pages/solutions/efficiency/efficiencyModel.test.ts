import { describe, expect, it } from "vitest";
import { BUDGET_LINES, FOUNDATION_GAPS, scoreFoundation, summarizeBudget } from "./efficiencyModel";

describe("scoreFoundation", () => {
  it("holds with nothing ticked", () => {
    expect(scoreFoundation(0).level).toBe("Holding");
  });

  it("shows cracks at one or two", () => {
    expect(scoreFoundation(1).level).toBe("Cracks showing");
    expect(scoreFoundation(2).level).toBe("Cracks showing");
  });

  it("puts the foundation first at three or more", () => {
    expect(scoreFoundation(3).level).toBe("Foundation first");
    expect(scoreFoundation(FOUNDATION_GAPS.length).level).toBe("Foundation first");
  });
});

describe("summarizeBudget", () => {
  it("reports every basic funded when nothing is cut", () => {
    const s = summarizeBudget([]);
    expect(s.cut).toBe(0);
    expect(s.headline).toBe("Every basic is funded.");
  });

  it("names where the risk moves, in list order", () => {
    const s = summarizeBudget(["support", "hardware"]);
    expect(s.cut).toBe(2);
    expect(s.headline).toBe(`AI pilot funded by cutting 2 of ${BUDGET_LINES.length} basics.`);
    expect(s.detail).toBe("The risk didn't disappear. It moved to your team's day and your clients' wait.");
  });

  it("joins three or more with commas", () => {
    expect(summarizeBudget(["hardware", "training", "recovery"]).detail).toContain(
      "your team's day, your inbox and your next bad day",
    );
  });

  it("ignores unknown ids", () => {
    expect(summarizeBudget(["nope"]).cut).toBe(0);
  });

  it("carries no figures", () => {
    for (const line of BUDGET_LINES) expect(`${line.title} ${line.text}`).not.toMatch(/[$%]|\d/);
  });
});

import { describe, expect, it } from "vitest";
import { EXPOSURE_QUESTIONS, scoreExposure } from "./aiBackgroundCheckQuiz";

const all = (answer: "yes" | "no") => Object.fromEntries(EXPOSURE_QUESTIONS.map((q) => [q.id, answer]));

describe("AI exposure self-check", () => {
  it("gives no result until every question is answered", () => {
    expect(scoreExposure({})).toBeNull();
    expect(scoreExposure({ "personal-accounts": "yes", "ai-in-apps": "yes", "leaver-cutoff": "no" })).toBeNull();
  });

  it("counts a 'no' on the leaver question as exposure", () => {
    const risky = Object.fromEntries(EXPOSURE_QUESTIONS.map((q) => [q.id, q.risky]));
    expect(scoreExposure(risky)?.level).toBe("High");
    // Every "yes": three risky answers, the leaver question answered safely.
    expect(scoreExposure(all("yes"))?.level).toBe("High");
  });

  it("scores two risky answers Medium and fewer Low", () => {
    expect(
      scoreExposure({ "personal-accounts": "yes", "ai-in-apps": "yes", "leaver-cutoff": "yes", "regulated-data": "no" })
        ?.level,
    ).toBe("Medium");
    expect(
      scoreExposure({ "personal-accounts": "no", "ai-in-apps": "no", "leaver-cutoff": "yes", "regulated-data": "no" })
        ?.level,
    ).toBe("Low");
  });
});

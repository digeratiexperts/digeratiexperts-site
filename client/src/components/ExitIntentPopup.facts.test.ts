import { describe, expect, it } from "vitest";
import { FACTS, FINDINGS_ARE_THE_CLIENTS } from "./ExitIntentPopup";

describe("exit popup facts", () => {
  it("does not promise clients keep their findings until Joe confirms it", () => {
    expect(FINDINGS_ARE_THE_CLIENTS).toBe(false);
    expect(FACTS.map((f) => f.lead)).toEqual(["Independent.", "Plain English.", "No switch required."]);
    expect(JSON.stringify(FACTS)).not.toMatch(/yours to keep/i);
  });
});

import { describe, expect, it } from "vitest";
import { gestureLockClaimed } from "./useStoreChromeGestures";

describe("the Store gesture lock", () => {
  it("is claimed on the warehouse routes only, never on Door 2 or the contact step", () => {
    for (const path of ["/internal/warehouse", "/internal/warehouse/", "/internal/warehouse/checkout", "/internal/warehouse/quote-request?x=1"]) {
      expect(gestureLockClaimed(path), path).toBe(true);
    }
    for (const path of ["/store", "/store/solutions/it-operations", "/store/solution", "/store/checkout", "/store/solution/submitted/DE-4K7Q2M", "/solutions/request", "/", "/portal/home"]) {
      expect(gestureLockClaimed(path), path).toBe(false);
    }
  });
});

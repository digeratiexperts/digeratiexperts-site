import { describe, expect, it } from "vitest";
import { chooseExitPopupVariant } from "./exitPopupVariant";

describe("exit popup split test", () => {
  it("splits new visitors 50/50 and remembers the draw", () => {
    expect(chooseExitPopupVariant({ random: 0.1 })).toEqual({ variant: "paper", store: true });
    expect(chooseExitPopupVariant({ random: 0.9 })).toEqual({ variant: "navy", store: true });
  });

  it("keeps a returning visitor on the version they first saw", () => {
    expect(chooseExitPopupVariant({ stored: "navy", random: 0.1 })).toEqual({ variant: "navy", store: false });
    expect(chooseExitPopupVariant({ stored: "paper", random: 0.9 })).toEqual({ variant: "paper", store: false });
  });

  it("lets ?exit_variant force a version for review without overwriting the stored one", () => {
    expect(chooseExitPopupVariant({ forced: "navy", stored: "paper", random: 0.1 })).toEqual({ variant: "navy", store: false });
  });

  it("ignores unknown values", () => {
    expect(chooseExitPopupVariant({ forced: "pink", stored: "x", random: 0.9 })).toEqual({ variant: "navy", store: true });
  });
});

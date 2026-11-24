import { describe, expect, it } from "vitest";
import {
  DESK_GOAL_STORAGE_KEY,
  GOAL_SCROLL_THRESHOLD,
  deskGoalPageContext,
  goalPickerEnabled,
  goalPreviewRequest,
  isGoalPickerPath,
  parseDeskGoal,
  readDeskGoal,
  scrollProgress,
  writeDeskGoal,
} from "./goalPicker";

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
    data,
  };
}

describe("flag gating", () => {
  it("is off unless the flag is set", () => {
    expect(goalPickerEnabled({})).toBe(false);
    expect(goalPickerEnabled({ VITE_GOAL_PICKER: "0" })).toBe(false);
    expect(goalPickerEnabled({ VITE_GOAL_PICKER: "1" })).toBe(true);
    expect(goalPickerEnabled({ VITE_GOAL_PICKER: "true" })).toBe(true);
  });

  it("ignores the preview query in a production build with the flag off", () => {
    expect(goalPreviewRequest("?goal=1", { DEV: false })).toBeNull();
    expect(goalPreviewRequest("?goal=1", { DEV: true })).toBe("open");
    expect(goalPreviewRequest("?goal=reset", { VITE_GOAL_PICKER: "1" })).toBe("reset");
    expect(goalPreviewRequest("?goal=yes", { DEV: true })).toBeNull();
  });
});

describe("isGoalPickerPath", () => {
  it("allows marketing pages", () => {
    expect(isGoalPickerPath("/")).toBe(true);
    expect(isGoalPickerPath("/solutions")).toBe(true);
  });

  it("stays off the portal, store, checkout, order, desk and form pages", () => {
    for (const path of ["/portal", "/store", "/checkout", "/contact", "/book", "/assessment", "/legal/privacy-policy"]) {
      expect(isGoalPickerPath(path)).toBe(false);
    }
  });
});

describe("desk goal", () => {
  it("stores the chosen goal for the DE Desk session", () => {
    const storage = memory();
    writeDeskGoal(storage, { id: "fully-managed", label: "Fully Managed IT & Security" });
    expect(readDeskGoal(storage)).toEqual({ id: "fully-managed", label: "Fully Managed IT & Security" });
    expect(deskGoalPageContext(storage)).toEqual({
      campaignSource: "goal-picker",
      serviceContext: "goal:fully-managed",
    });
  });

  it("drops a tampered goal", () => {
    expect(parseDeskGoal(JSON.stringify({ id: "<b>", label: "x" }))).toBeNull();
    expect(parseDeskGoal("{not json")).toBeNull();
    expect(deskGoalPageContext(memory({ [DESK_GOAL_STORAGE_KEY]: "nope" }))).toEqual({});
  });
});

describe("scroll trigger", () => {
  it("crosses the threshold at 40%", () => {
    expect(scrollProgress(40, 200, 100)).toBe(0.4);
    expect(scrollProgress(40, 200, 100)).toBeGreaterThanOrEqual(GOAL_SCROLL_THRESHOLD);
    expect(scrollProgress(39, 200, 100)).toBeLessThan(GOAL_SCROLL_THRESHOLD);
    expect(scrollProgress(0, 100, 100)).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { formatDeskTimestamp } from "./deskTimestamp";

describe("formatDeskTimestamp", () => {
  it("includes the clock time, not the date alone", () => {
    const formatted = formatDeskTimestamp("2026-09-29T22:15:00.000Z");
    expect(formatted).toMatch(/\d/);
    expect(formatted).toMatch(/AM|PM/);
  });

  it("renders an em dash for an unreadable value", () => {
    expect(formatDeskTimestamp("not-a-date")).toBe("—");
  });
});

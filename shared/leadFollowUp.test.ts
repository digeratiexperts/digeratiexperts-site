import { describe, expect, it } from "vitest";
import {
  addBusinessMinutes,
  arizonaLabel,
  followUpHeadline,
  followUpPriority,
  planLeadFollowUp,
  toArizonaIso,
} from "./leadFollowUp";

/** Build an instant from Arizona wall-clock time (fixed UTC-7). */
const az = (iso: string) => new Date(`${iso}-07:00`);

describe("quiz lead follow-up priority", () => {
  it("puts something-went-wrong first, then Enterprise, insurance and audit", () => {
    expect(followUpPriority({ plan: "Office", context: { trigger: "incident" } })).toBe("urgent");
    expect(followUpPriority({ plan: "Enterprise", context: { trigger: "incident" } })).toBe("urgent");
    expect(followUpPriority({ plan: "Enterprise" })).toBe("high");
    expect(followUpPriority({ plan: "Office", context: { trigger: "insurance" } })).toBe("high");
    expect(followUpPriority({ plan: "Business", context: { trigger: "audit" } })).toBe("high");
    expect(followUpPriority({ plan: "Business", context: { trigger: "comparing" } })).toBe("standard");
    expect(followUpPriority({ plan: "Office" })).toBe("standard");
  });
});

describe("business-hours clock (Mon-Fri 07:00-18:00 Arizona)", () => {
  // 2026-10-05 is a Monday; 2026-10-09 a Friday; 2026-10-10 a Saturday.
  it("adds within the same day", () => {
    expect(toArizonaIso(addBusinessMinutes(az("2026-10-05T09:15:00"), 60))).toBe("2026-10-05T10:15:00-07:00");
  });

  it("starts the clock at opening when the lead arrives before hours", () => {
    expect(toArizonaIso(addBusinessMinutes(az("2026-10-05T05:30:00"), 60))).toBe("2026-10-05T08:00:00-07:00");
  });

  it("rolls past closing into the next morning", () => {
    expect(toArizonaIso(addBusinessMinutes(az("2026-10-05T17:30:00"), 60))).toBe("2026-10-06T07:30:00-07:00");
    expect(toArizonaIso(addBusinessMinutes(az("2026-10-05T20:00:00"), 240))).toBe("2026-10-06T11:00:00-07:00");
  });

  it("skips the weekend", () => {
    expect(toArizonaIso(addBusinessMinutes(az("2026-10-09T17:00:00"), 240))).toBe("2026-10-12T10:00:00-07:00");
    expect(toArizonaIso(addBusinessMinutes(az("2026-10-10T12:00:00"), 60))).toBe("2026-10-12T08:00:00-07:00");
  });

  it("gives a standard lead one full business day", () => {
    expect(toArizonaIso(addBusinessMinutes(az("2026-10-05T14:00:00"), 660))).toBe("2026-10-06T14:00:00-07:00");
    expect(toArizonaIso(addBusinessMinutes(az("2026-10-09T14:00:00"), 660))).toBe("2026-10-12T14:00:00-07:00");
  });

  it("ignores the server's own time zone (UTC instants in, Arizona out)", () => {
    // 2026-10-05T16:00:00Z is 09:00 in Arizona.
    expect(toArizonaIso(addBusinessMinutes(new Date("2026-10-05T16:00:00Z"), 30))).toBe("2026-10-05T09:30:00-07:00");
  });
});

describe("planLeadFollowUp", () => {
  it("returns the Zoho datetime and a human label for the same instant", () => {
    const plan = planLeadFollowUp({ plan: "Business", context: { trigger: "incident" }, now: az("2026-10-05T09:15:00") });
    expect(plan).toEqual({
      priority: "urgent",
      callBy: "2026-10-05T10:15:00-07:00",
      callByLabel: "Mon Oct 5, 10:15 AM Arizona time",
    });
    expect(followUpHeadline(plan, "480-555-0100")).toBe(
      "Urgent priority. Call 480-555-0100 by Mon Oct 5, 10:15 AM Arizona time.",
    );
  });

  it("labels noon and midnight-adjacent hours correctly", () => {
    expect(arizonaLabel(az("2026-10-05T12:05:00"))).toBe("Mon Oct 5, 12:05 PM Arizona time");
    expect(arizonaLabel(az("2026-10-05T07:00:00"))).toBe("Mon Oct 5, 7:00 AM Arizona time");
  });
});

/**
 * The sessions' contract: each one feeds a real campaign page, sits on the
 * Phoenix offset, and a planned session is never offered to search engines.
 */
import { describe, it, expect } from "vitest";
import { CAMPAIGNS } from "./campaigns";
import {
  DE_EVENT_SESSIONS,
  countdownTo,
  isIndexable,
  sessionBySlug,
  sessionEnd,
  upcomingSessions,
} from "./deEvents";
import { buildIcs, foldIcsLine } from "@/lib/ics";

describe("DE event sessions", () => {
  it("have unique, URL-safe slugs", () => {
    const slugs = DE_EVENT_SESSIONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("each feed a campaign page that exists", () => {
    const known = new Set(CAMPAIGNS.map((c) => c.slug));
    expect(DE_EVENT_SESSIONS.filter((s) => !known.has(s.campaign)).map((s) => s.slug)).toEqual([]);
  });

  it("are anchored to the fixed Arizona offset", () => {
    for (const s of DE_EVENT_SESSIONS) expect(s.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-07:00$/);
  });

  it("agenda fits inside the session", () => {
    for (const s of DE_EVENT_SESSIONS) {
      const total = s.agenda.reduce((sum, step) => sum + step.minutes, 0);
      expect(total, s.slug).toBeLessThanOrEqual(s.durationMinutes);
    }
  });

  it("keeps planned sessions out of search", () => {
    for (const s of DE_EVENT_SESSIONS) {
      if (s.status === "planned") expect(isIndexable(s)).toBe(false);
    }
  });

  it("lists upcoming sessions soonest first and drops finished ones", () => {
    const first = DE_EVENT_SESSIONS[0];
    const afterFirst = new Date(sessionEnd(first).getTime() + 1);
    const list = upcomingSessions(afterFirst);
    expect(list.find((s) => s.slug === first.slug)).toBeUndefined();
    const starts = list.map((s) => Date.parse(s.start));
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("counts down in days, hours, minutes and seconds", () => {
    const start = new Date("2026-10-29T11:00:00-07:00");
    const now = new Date("2026-10-16T18:37:12-07:00");
    expect(countdownTo(start, now)).toEqual({ days: 12, hours: 16, minutes: 22, seconds: 48, started: false });
    expect(countdownTo(start, new Date("2026-10-29T11:00:01-07:00")).started).toBe(true);
  });

  it("finds sessions by slug", () => {
    expect(sessionBySlug("cyber-insurance-renewal-readiness")?.campaign).toBe("cyber-insurance");
    expect(sessionBySlug("nope")).toBeUndefined();
  });
});

describe("ics writer", () => {
  it("writes a Phoenix-anchored event with an end time", () => {
    const ics = buildIcs(
      [{ uid: "a@b", summary: "Test, with; specials", start: "2026-10-29T11:00", durationMinutes: 60 }],
      { calendarName: "DE", stamp: new Date("2026-10-10T00:00:00Z") },
    );
    expect(ics).toContain("DTSTART;TZID=America/Phoenix:20261029T110000");
    expect(ics).toContain("DTEND;TZID=America/Phoenix:20261029T120000");
    expect(ics).toContain("SUMMARY:Test\\, with\\; specials");
    expect(ics).toContain("TZOFFSETTO:-0700");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("writes all-day spans with an exclusive end date", () => {
    const ics = buildIcs([{ uid: "x", summary: "Month", start: "2026-10-01", allDay: true, days: 31 }], {
      calendarName: "DE",
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261001");
    expect(ics).toContain("DTEND;VALUE=DATE:20261101");
  });

  it("folds long lines at 75 octets", () => {
    const folded = foldIcsLine(`DESCRIPTION:${"x".repeat(200)}`);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

// Dex's holiday sets (Joe, 2026-10-22): one per holiday, scheduled by date rule, so nothing needs editing each year.
// A holiday set changes only the accent glyph and its colour. It never changes Dex's emotion, and the resolver in
// dexPresence.ts switches it off for security, outage, billing and handoff situations.
// Holidays follow the US federal list plus the widely kept cultural days DE's clients mark, with Arizona in mind.
import type { GlyphId } from "./dexGeometry";

export const DAY = 86_400_000;

export interface Holiday {
  id: string;
  name: string;
  glyph: GlyphId;
  accent: string;
  /** The day it falls on in a given year, as UTC midnight in ms. */
  date: (year: number) => number;
  /** Days before and after the day the set stays on. */
  before: number;
  after: number;
}

const utc = (y: number, m: number, d: number) => Date.UTC(y, m, d);

/** The nth given weekday (0 Sunday to 6 Saturday) of a month, month 0-based. */
function nthWeekday(y: number, m: number, weekday: number, n: number): number {
  const first = utc(y, m, 1);
  const delta = (weekday - new Date(first).getUTCDay() + 7) % 7;
  return utc(y, m, 1 + delta + (n - 1) * 7);
}

/** The last given weekday of a month. */
function lastWeekday(y: number, m: number, weekday: number): number {
  const last = utc(y, m + 1, 0);
  const delta = (new Date(last).getUTCDay() - weekday + 7) % 7;
  return last - delta * DAY;
}

/** Easter Sunday (Anonymous Gregorian algorithm). */
export function easterSunday(y: number): number {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, month - 1, day);
}

const MON = 1;
const SUN = 0;
const THU = 4;

export const HOLIDAYS: Holiday[] = [
  { id: "new-years-day", name: "New Year's Day", glyph: "star", accent: "#F6D27A", date: (y) => utc(y, 0, 1), before: 2, after: 1 },
  { id: "mlk-day", name: "Martin Luther King Jr. Day", glyph: "sun", accent: "#F2A541", date: (y) => nthWeekday(y, 0, MON, 3), before: 2, after: 1 },
  { id: "valentines-day", name: "Valentine's Day", glyph: "heart", accent: "#E0457B", date: (y) => utc(y, 1, 14), before: 2, after: 0 },
  { id: "presidents-day", name: "Presidents' Day", glyph: "star", accent: "#3B5BA9", date: (y) => nthWeekday(y, 1, MON, 3), before: 2, after: 1 },
  { id: "st-patricks-day", name: "St. Patrick's Day", glyph: "clover", accent: "#2E9E5B", date: (y) => utc(y, 2, 17), before: 2, after: 0 },
  { id: "easter", name: "Easter", glyph: "sun", accent: "#F3B6D0", date: (y) => easterSunday(y), before: 2, after: 1 },
  { id: "cinco-de-mayo", name: "Cinco de Mayo", glyph: "sun", accent: "#E8702A", date: (y) => utc(y, 4, 5), before: 2, after: 0 },
  { id: "mothers-day", name: "Mother's Day", glyph: "heart", accent: "#C77DBA", date: (y) => nthWeekday(y, 4, SUN, 2), before: 2, after: 1 },
  { id: "memorial-day", name: "Memorial Day", glyph: "star", accent: "#5A6B8C", date: (y) => lastWeekday(y, 4, MON), before: 2, after: 1 },
  { id: "juneteenth", name: "Juneteenth", glyph: "leaf", accent: "#2B8A6E", date: (y) => utc(y, 5, 19), before: 2, after: 1 },
  { id: "fathers-day", name: "Father's Day", glyph: "leaf", accent: "#46607A", date: (y) => nthWeekday(y, 5, SUN, 3), before: 2, after: 1 },
  { id: "independence-day", name: "Independence Day", glyph: "star", accent: "#B3202C", date: (y) => utc(y, 6, 4), before: 2, after: 1 },
  { id: "labor-day", name: "Labor Day", glyph: "leaf", accent: "#3C7A4A", date: (y) => nthWeekday(y, 8, MON, 1), before: 2, after: 1 },
  { id: "indigenous-peoples-day", name: "Indigenous Peoples' Day", glyph: "leaf", accent: "#A0522D", date: (y) => nthWeekday(y, 9, MON, 2), before: 2, after: 1 },
  { id: "halloween", name: "Halloween", glyph: "moon", accent: "#F07A1F", date: (y) => utc(y, 9, 31), before: 2, after: 0 },
  { id: "veterans-day", name: "Veterans Day", glyph: "star", accent: "#4B5D3A", date: (y) => utc(y, 10, 11), before: 2, after: 0 },
  { id: "thanksgiving", name: "Thanksgiving", glyph: "leaf", accent: "#B5652A", date: (y) => nthWeekday(y, 10, THU, 4), before: 2, after: 1 },
  { id: "christmas", name: "Christmas", glyph: "snowflake", accent: "#7FC8E8", date: (y) => utc(y, 11, 25), before: 5, after: 1 },
];

/** A calendar day as UTC midnight, using the local calendar date of the given moment. */
export function dayKey(now: Date): number {
  return utc(now.getFullYear(), now.getMonth(), now.getDate());
}

export interface Occurrence {
  holiday: Holiday;
  /** The holiday's day, UTC midnight ms. */
  day: number;
}

export function occurrences(year: number): Occurrence[] {
  return HOLIDAYS.map((holiday) => ({ holiday, day: holiday.date(year) }));
}

/** The holiday set showing on this day, if any. When two overlap, the one whose day is nearest wins. */
export function activeHoliday(now: Date): Occurrence | null {
  const today = dayKey(now);
  const y = now.getFullYear();
  let best: { occ: Occurrence; gap: number } | null = null;
  for (const year of [y - 1, y, y + 1]) {
    for (const occ of occurrences(year)) {
      const from = occ.day - occ.holiday.before * DAY;
      const to = occ.day + occ.holiday.after * DAY;
      if (today < from || today > to) continue;
      const gap = Math.abs(today - occ.day);
      if (!best || gap < best.gap) best = { occ, gap };
    }
  }
  return best?.occ ?? null;
}

/** The next day a holiday set starts to show, from now on. */
export function nextHolidayWindow(now: Date): { occ: Occurrence; startsOn: number } | null {
  const today = dayKey(now);
  const y = now.getFullYear();
  let best: { occ: Occurrence; startsOn: number } | null = null;
  for (const year of [y, y + 1]) {
    for (const occ of occurrences(year)) {
      const startsOn = occ.day - occ.holiday.before * DAY;
      if (startsOn < today) continue;
      if (!best || startsOn < best.startsOn) best = { occ, startsOn };
    }
  }
  return best;
}

export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

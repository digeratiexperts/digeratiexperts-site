// The Dex kit: everything another app needs to show Dex, as plain data. scripts/export-dex-kit.ts writes it to
// dex/kit/dex-kit.json, and a test keeps that file in step with the code. Apps that cannot run this code read the JSON
// and render with renderDexSvg (or copy the geometry). kitVersion changes when the shape of this data changes.
import { BAR_H, DEX_MODES, DEX_VIEWBOX, GLYPHS, MARK_BARS } from "./dexGeometry";
import { DEX_EMOTIONS, DEX_INTERACTIONS, DEX_RULES_VERSION, chooseDexPresence } from "./dexPresence";
import { DAY, HOLIDAYS, isoDay, occurrences } from "./holidays";

export const KIT_VERSION = 1;

export function buildKit(years: number[]) {
  return {
    kitVersion: KIT_VERSION,
    rulesVersion: DEX_RULES_VERSION,
    geometry: { viewBox: DEX_VIEWBOX, barHeight: BAR_H, bars: MARK_BARS, glyphs: GLYPHS },
    modes: DEX_MODES,
    emotions: DEX_EMOTIONS,
    interactions: DEX_INTERACTIONS.map((i) => ({ ...i, presence: chooseDexPresence(i.signals) })),
    holidays: HOLIDAYS.map(({ date: _date, ...h }) => h),
    schedule: years.flatMap((year) =>
      occurrences(year).map((o) => ({
        year,
        holiday: o.holiday.id,
        day: isoDay(o.day),
        showsFrom: isoDay(o.day - o.holiday.before * DAY),
        showsUntil: isoDay(o.day + o.holiday.after * DAY),
      })),
    ),
  };
}

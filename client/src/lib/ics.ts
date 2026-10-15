/**
 * Minimal RFC 5545 calendar writer. Used by the public session page ("Add to
 * calendar") and by `scripts/de-events/build.ts` for the internal calendar.
 *
 * Every DE event is anchored to America/Phoenix, which has had no daylight
 * saving since 1968, so the VTIMEZONE block is a single fixed STANDARD rule
 * and recurring events never drift an hour twice a year.
 */

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  /** Wall-clock start in Phoenix, "YYYY-MM-DDTHH:MM". Ignored when `allDay`. */
  start: string;
  durationMinutes?: number;
  /** All-day date "YYYY-MM-DD"; spans `days` days (default 1). */
  allDay?: boolean;
  days?: number;
  /** An RRULE value without the "RRULE:" prefix, e.g. "FREQ=WEEKLY;BYDAY=MO". */
  rrule?: string;
  categories?: string[];
}

const PHOENIX_TZ = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Phoenix",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:-0700",
  "TZOFFSETTO:-0700",
  "TZNAME:MST",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Fold to 75 octets per line (RFC 5545 §3.1), continuation lines start with a space. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function compact(wallClock: string): string {
  // "2026-10-29T11:00" -> "20261029T110000"
  const [date, time = "00:00"] = wallClock.split("T");
  return `${date.replace(/-/g, "")}T${time.slice(0, 5).replace(":", "")}00`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function addMinutes(wallClock: string, minutes: number): string {
  // Phoenix is a fixed offset, so wall-clock arithmetic in UTC is exact.
  const d = new Date(`${wallClock.slice(0, 16)}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

export function buildIcs(
  events: IcsEvent[],
  options: { calendarName: string; stamp?: Date } = { calendarName: "Digerati Experts" },
): string {
  const stamp = (options.stamp ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Digerati Experts//DE Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(options.calendarName)}`,
    "X-WR-TIMEZONE:America/Phoenix",
    ...PHOENIX_TZ,
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT", `UID:${event.uid}`, `DTSTAMP:${stamp}`);
    if (event.allDay) {
      const date = event.start.slice(0, 10);
      lines.push(
        `DTSTART;VALUE=DATE:${date.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${addDays(date, event.days ?? 1)}`,
      );
    } else {
      lines.push(
        `DTSTART;TZID=America/Phoenix:${compact(event.start)}`,
        `DTEND;TZID=America/Phoenix:${compact(addMinutes(event.start, event.durationMinutes ?? 60))}`,
      );
    }
    if (event.rrule) lines.push(`RRULE:${event.rrule}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    if (event.categories?.length) lines.push(`CATEGORIES:${event.categories.map(escapeIcsText).join(",")}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

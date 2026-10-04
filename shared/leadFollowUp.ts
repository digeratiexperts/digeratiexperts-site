/**
 * Who to call and when, for a quiz lead (issue 449).
 *
 * One function decides the priority and the call-by time from the quiz
 * answers, so the Zoho scheduled call, the new-lead email and the Hub record
 * all carry the same deadline. The Zoho call is the record of whether the
 * call happened; the other two point at it rather than keeping their own.
 *
 * Business hours are the ones the site publishes (JsonLd openingHours):
 * Monday to Friday, 07:00 to 18:00, Arizona time. Arizona does not observe
 * daylight saving, so local time is a fixed UTC-7. Holidays are not modelled.
 */
import type { QuoteContext } from "./quoteContext";

export type FollowUpPriority = "urgent" | "high" | "standard";

export const BUSINESS_HOURS = {
  timeZone: "America/Phoenix",
  /** Arizona has no daylight saving: always UTC-7. */
  utcOffsetMinutes: -7 * 60,
  /** 1 = Monday ... 5 = Friday (Date#getUTCDay numbering). */
  days: [1, 2, 3, 4, 5] as readonly number[],
  openHour: 7,
  closeHour: 18,
} as const;

/** Business minutes allowed before the first call, per priority. */
export const FOLLOW_UP_WINDOW_MINUTES: Record<FollowUpPriority, number> = {
  urgent: 60,
  high: 4 * 60,
  /** One full business day. */
  standard: (BUSINESS_HOURS.closeHour - BUSINESS_HOURS.openHour) * 60,
};

export const FOLLOW_UP_LABEL: Record<FollowUpPriority, string> = {
  urgent: "Urgent",
  high: "High",
  standard: "Standard",
};

/**
 * Tiers Joe chose (2026-10-04): something went wrong gets an hour; Enterprise,
 * insurance and audit leads get four hours; everyone else a business day.
 */
export function followUpPriority(input: { plan: string; context?: QuoteContext }): FollowUpPriority {
  if (input.context?.trigger === "incident") return "urgent";
  if (input.plan === "Enterprise") return "high";
  if (input.context?.trigger === "insurance" || input.context?.trigger === "audit") return "high";
  return "standard";
}

const MINUTE = 60_000;

/** Shift a UTC instant into Arizona wall-clock fields (read with getUTC*). */
function toLocal(date: Date): Date {
  return new Date(date.getTime() + BUSINESS_HOURS.utcOffsetMinutes * MINUTE);
}

function fromLocal(local: Date): Date {
  return new Date(local.getTime() - BUSINESS_HOURS.utcOffsetMinutes * MINUTE);
}

function isBusinessDay(local: Date): boolean {
  return BUSINESS_HOURS.days.includes(local.getUTCDay());
}

/** The next moment the office is open, at or after `local`. */
function nextOpen(local: Date): Date {
  const cursor = new Date(local.getTime());
  for (let guard = 0; guard < 14; guard += 1) {
    const minutes = cursor.getUTCHours() * 60 + cursor.getUTCMinutes();
    if (isBusinessDay(cursor) && minutes < BUSINESS_HOURS.closeHour * 60) {
      if (minutes < BUSINESS_HOURS.openHour * 60) cursor.setUTCHours(BUSINESS_HOURS.openHour, 0, 0, 0);
      return cursor;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(BUSINESS_HOURS.openHour, 0, 0, 0);
  }
  return cursor;
}

/** Add business minutes to an instant, skipping nights and weekends. */
export function addBusinessMinutes(from: Date, minutes: number): Date {
  let local = nextOpen(toLocal(from));
  let remaining = Math.max(0, Math.round(minutes));
  while (remaining > 0) {
    const close = new Date(local.getTime());
    close.setUTCHours(BUSINESS_HOURS.closeHour, 0, 0, 0);
    const available = Math.round((close.getTime() - local.getTime()) / MINUTE);
    if (remaining <= available) {
      local = new Date(local.getTime() + remaining * MINUTE);
      remaining = 0;
    } else {
      remaining -= available;
      local = nextOpen(close);
    }
  }
  return fromLocal(local);
}

export interface LeadFollowUp {
  priority: FollowUpPriority;
  /** ISO 8601 with the Arizona offset, e.g. 2026-10-05T09:30:00-07:00 (the form Zoho expects). */
  callBy: string;
  /** "Mon Oct 5, 9:30 AM Arizona time" — for people. */
  callByLabel: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Zoho datetime format with the fixed Arizona offset. */
export function toArizonaIso(instant: Date): string {
  const l = toLocal(instant);
  return `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}T${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}:00-07:00`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function arizonaLabel(instant: Date): string {
  const l = toLocal(instant);
  const h = l.getUTCHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${DAYS[l.getUTCDay()]} ${MONTHS[l.getUTCMonth()]} ${l.getUTCDate()}, ${hour12}:${pad(l.getUTCMinutes())} ${h < 12 ? "AM" : "PM"} Arizona time`;
}

export function planLeadFollowUp(input: { plan: string; context?: QuoteContext; now?: Date }): LeadFollowUp {
  const priority = followUpPriority(input);
  const due = addBusinessMinutes(input.now ?? new Date(), FOLLOW_UP_WINDOW_MINUTES[priority]);
  return { priority, callBy: toArizonaIso(due), callByLabel: arizonaLabel(due) };
}

/** First line of the new-lead email and the Zoho call description. */
export function followUpHeadline(followUp: LeadFollowUp, phone?: string): string {
  const who = phone ? `Call ${phone}` : "Call";
  return `${FOLLOW_UP_LABEL[followUp.priority]} priority. ${who} by ${followUp.callByLabel}.`;
}

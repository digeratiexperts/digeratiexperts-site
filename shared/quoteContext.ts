/**
 * Context answers for the /quote-wizard flow (issue 419, slice 3).
 *
 * These three questions never change the plan match (client/src/lib/quoteMatch.ts).
 * They travel on the lead so whoever follows up knows where to start. The
 * server accepts only the ids listed here: anything else is dropped, never
 * echoed into the CRM.
 */

export interface QuoteContextOption {
  id: string;
  label: string;
}

export const IT_TODAY_OPTIONS = [
  { id: "nobody", label: "Whoever's free" },
  { id: "one-person", label: "One person in-house" },
  { id: "provider", label: "Another IT provider" },
  { id: "internal-team", label: "An IT team that wants backup" },
] as const satisfies readonly QuoteContextOption[];

export const TRIGGER_OPTIONS = [
  { id: "insurance", label: "Insurance renewal or questionnaire" },
  { id: "incident", label: "Something went wrong" },
  { id: "support", label: "Unhappy with current support" },
  { id: "growth", label: "Growing or moving" },
  { id: "audit", label: "Audit or client requirement" },
  { id: "comparing", label: "Just comparing" },
] as const satisfies readonly QuoteContextOption[];

export const FRAMEWORK_OPTIONS = [
  { id: "hipaa", label: "HIPAA" },
  { id: "ftc-safeguards", label: "FTC Safeguards" },
  { id: "pci", label: "PCI DSS" },
  { id: "cmmc", label: "CMMC / DFARS" },
  { id: "none", label: "Not that I know of" },
] as const satisfies readonly QuoteContextOption[];

export type ItTodayId = (typeof IT_TODAY_OPTIONS)[number]["id"];
export type TriggerId = (typeof TRIGGER_OPTIONS)[number]["id"];
export type FrameworkId = (typeof FRAMEWORK_OPTIONS)[number]["id"];

export interface QuoteContext {
  itToday?: ItTodayId;
  trigger?: TriggerId;
  frameworks?: FrameworkId[];
}

function pick<T extends readonly QuoteContextOption[]>(options: T, value: unknown): T[number]["id"] | undefined {
  return typeof value === "string" ? options.find((o) => o.id === value)?.id : undefined;
}

/** Keep only known ids. Returns undefined when nothing usable was sent. */
export function sanitizeQuoteContext(raw: unknown): QuoteContext | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const input = raw as Record<string, unknown>;
  const out: QuoteContext = {};

  const itToday = pick(IT_TODAY_OPTIONS, input.itToday);
  if (itToday) out.itToday = itToday;

  const trigger = pick(TRIGGER_OPTIONS, input.trigger);
  if (trigger) out.trigger = trigger;

  if (Array.isArray(input.frameworks)) {
    const ids = new Set<FrameworkId>();
    for (const value of input.frameworks.slice(0, FRAMEWORK_OPTIONS.length)) {
      const id = pick(FRAMEWORK_OPTIONS, value);
      if (id) ids.add(id);
    }
    // "Not that I know of" means nothing else applies.
    if (ids.has("none") && ids.size > 1) ids.delete("none");
    if (ids.size) out.frameworks = FRAMEWORK_OPTIONS.map((o) => o.id).filter((id) => ids.has(id));
  }

  return Object.keys(out).length ? out : undefined;
}

function labelOf(options: readonly QuoteContextOption[], id: string): string {
  return options.find((o) => o.id === id)?.label ?? id;
}

/** One line for the CRM Description, built from labels only. Empty when there is no context. */
export function describeQuoteContext(context: QuoteContext | undefined): string {
  if (!context) return "";
  const parts: string[] = [];
  if (context.itToday) parts.push(`IT today: ${labelOf(IT_TODAY_OPTIONS, context.itToday)}`);
  if (context.trigger) parts.push(`Looking now because: ${labelOf(TRIGGER_OPTIONS, context.trigger)}`);
  if (context.frameworks?.length) {
    parts.push(`Rules they follow: ${context.frameworks.map((id) => labelOf(FRAMEWORK_OPTIONS, id)).join(", ")}`);
  }
  return parts.join("; ");
}

/** The Zoho lead Description for a quiz lead: the match line, then the context line when there is one. */
export function quoteLeadDescription(lead: {
  recommendedPlan: unknown;
  seats: unknown;
  connectivity: unknown;
  devices: unknown;
  context?: QuoteContext;
}): string {
  const base = `Quote Wizard: Recommended Plan: ${lead.recommendedPlan}, Seats: ${lead.seats}, Connectivity: ${lead.connectivity}, Devices: ${lead.devices}`;
  const contextLine = describeQuoteContext(lead.context);
  return contextLine ? `${base}. ${contextLine}` : base;
}

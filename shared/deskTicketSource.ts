/**
 * Where a Zoho Desk ticket came from.
 *
 * Every ticket this site creates used to be posted with `channel: 'Web'` and
 * nothing else, so in Desk an anonymous stranger on the public widget, a
 * signed-in client reporting an outage, and an automated order-fulfilment
 * ticket all looked identical. Triage could not tell spam from an emergency.
 *
 * `source` names the surface that raised the ticket and `trust` says what that
 * surface knows about the person behind it:
 *
 *   authenticated — a signed-in portal user. Identity is established.
 *   anonymous     — anyone on the public internet. Treat the contents, and
 *                   especially any self-declared urgency, as unverified.
 *   system        — we raised it ourselves on the back of something that
 *                   already happened (an order, an approved request).
 *
 * The stamp travels in the ticket description because that works against any
 * Desk org without configuration. A custom field is preferable once one
 * exists — see `deskSourceCustomField`.
 */

export const DESK_TICKET_SOURCES = [
  "website-widget",
  "client-portal",
  "advisor-chat",
  "order-fulfillment",
  "internal-request",
] as const;

export type DeskTicketSource = (typeof DESK_TICKET_SOURCES)[number];

export type DeskTicketTrust = "authenticated" | "anonymous" | "system";

interface SourceFacts {
  trust: DeskTicketTrust;
  /** Shown to whoever opens the ticket. */
  label: string;
}

const SOURCE_FACTS: Record<DeskTicketSource, SourceFacts> = {
  "website-widget": { trust: "anonymous", label: "Public website support widget" },
  "client-portal": { trust: "authenticated", label: "Client portal (signed in)" },
  "advisor-chat": { trust: "anonymous", label: "Public advisor chat" },
  "order-fulfillment": { trust: "system", label: "Store order fulfilment" },
  "internal-request": { trust: "system", label: "Internal request approval" },
};

export function isDeskTicketSource(value: unknown): value is DeskTicketSource {
  return (
    typeof value === "string" &&
    (DESK_TICKET_SOURCES as readonly string[]).includes(value)
  );
}

export function deskTicketTrust(source: DeskTicketSource): DeskTicketTrust {
  return SOURCE_FACTS[source].trust;
}

export function deskTicketSourceLabel(source: DeskTicketSource): string {
  return SOURCE_FACTS[source].label;
}

/** True when the sender's identity was never established. */
export function isUnverifiedDeskSource(source: DeskTicketSource): boolean {
  return deskTicketTrust(source) === "anonymous";
}

/**
 * The marker a Desk view, macro or search can match on. Stable and greppable;
 * changing it invalidates existing saved views, so treat it as a contract.
 */
export const DESK_PROVENANCE_MARKER = "[DE-SOURCE]";

/**
 * A provenance block to prepend to the ticket description.
 *
 * Deliberately plain text: it has to survive Desk's own rendering and stay
 * readable to an agent glancing at the ticket, not just to a saved view.
 */
export function deskProvenanceBlock(source: DeskTicketSource): string {
  const trust = deskTicketTrust(source);
  const lines = [
    `${DESK_PROVENANCE_MARKER} source=${source} trust=${trust}`,
    `Raised via: ${deskTicketSourceLabel(source)}`,
  ];
  if (trust === "anonymous") {
    lines.push(
      "Sender identity is NOT verified — anyone on the internet can submit this form. " +
        "Treat the stated urgency as a claim, not a fact.",
    );
  }
  return lines.join("\n");
}

/** Prepend the provenance block to a description, leaving the body untouched. */
export function withDeskProvenance(
  description: string,
  source: DeskTicketSource,
): string {
  return `${deskProvenanceBlock(source)}\n\n---\n\n${description}`;
}

/**
 * Optional Desk custom field to carry the source as structured data.
 *
 * Inert until ZOHO_DESK_SOURCE_FIELD names a custom field that actually exists
 * in the Desk org (e.g. "cf_de_source"). Posting an unknown cf key makes Desk
 * reject the whole ticket, so this stays opt-in rather than guessing a name:
 * losing a customer's ticket to a schema mismatch is far worse than carrying
 * the stamp in the description alone.
 */
export function deskSourceCustomField(
  source: DeskTicketSource,
  fieldName: string | undefined,
): Record<string, string> | undefined {
  const name = fieldName?.trim();
  if (!name) return undefined;
  return { [name]: source };
}

/** Desk's priority ladder, lowest first. */
export const DESK_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export type DeskPriority = (typeof DESK_PRIORITIES)[number];

/**
 * The highest priority an unverified sender may reach.
 *
 * Urgent is what pages someone out of hours, so it is reserved for sources
 * where we know who is asking. Anyone on the public internet can tick
 * "Critical" on the support form, and the form maps that straight onto Desk's
 * Urgent — which hands a spammer the emergency queue.
 *
 * High, not Medium, on purpose: a genuine emergency from a prospect who is not
 * a client yet still has to stand out. This caps the ceiling rather than
 * burying the ticket.
 */
export const UNVERIFIED_PRIORITY_CEILING: DeskPriority = "High";

function priorityRank(priority: string): number {
  const i = (DESK_PRIORITIES as readonly string[]).indexOf(priority);
  return i === -1 ? DESK_PRIORITIES.indexOf("Medium") : i;
}

/**
 * Hold a self-declared priority to what its source has earned.
 *
 * Verified and system sources pass through untouched. Unverified ones are
 * capped at UNVERIFIED_PRIORITY_CEILING. Unknown values fall back to Medium
 * rather than being trusted.
 */
export function clampPriorityForSource(
  priority: string | undefined,
  source: DeskTicketSource,
): DeskPriority {
  const requested = DESK_PRIORITIES[priorityRank(priority ?? "Medium")];
  if (!isUnverifiedDeskSource(source)) return requested;
  const ceiling = DESK_PRIORITIES.indexOf(UNVERIFIED_PRIORITY_CEILING);
  return DESK_PRIORITIES[Math.min(DESK_PRIORITIES.indexOf(requested), ceiling)];
}

/** True when the cap actually lowered what the sender asked for. */
export function wasPriorityClamped(
  priority: string | undefined,
  source: DeskTicketSource,
): boolean {
  if (!priority) return false;
  return clampPriorityForSource(priority, source) !== priority;
}

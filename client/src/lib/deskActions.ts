/**
 * Next steps the advisor proposes with a reply (server: msp-advisor
 * sanitizeActions / materializeAction, at most three). The Desk used to drop
 * them, so "Schedule a consultation", "Open Client Portal" and the emergency
 * callback the incident path forces never reached the visitor.
 *
 * The server already sanitizes; this is the client's own allowlist, so a
 * malformed or unexpected action can never become a link.
 */

export type DeskActionType =
  | "schedule_consultation"
  | "request_assessment"
  | "contact_sales"
  | "create_lead"
  | "open_portal"
  | "existing_client_support"
  | "request_callback"
  | "navigate"
  | "leave_message";

export type DeskAction = { type: DeskActionType; label: string; href?: string };

/** How the Desk carries an action out. */
export type DeskActionPlan =
  | { kind: "link"; href: string; external: boolean }
  | { kind: "route"; path: string }
  | { kind: "form"; form: "callback" | "lead" | "message" };

const TYPES: readonly DeskActionType[] = [
  "schedule_consultation",
  "request_assessment",
  "contact_sales",
  "create_lead",
  "open_portal",
  "existing_client_support",
  "request_callback",
  "navigate",
  "leave_message",
];

const FORM_TYPES: Partial<Record<DeskActionType, "callback" | "lead" | "message">> = {
  request_callback: "callback",
  create_lead: "lead",
  leave_message: "message",
};

/** The Cyber Risk Assessment starts on /book (/assessment redirects there). */
export const DESK_ASSESSMENT_PATH = "/book";

function isSafeHref(href: string): boolean {
  if (href.startsWith("tel:")) return /^tel:\+?[\d-]{7,16}$/.test(href);
  if (href.startsWith("https://")) {
    try {
      return new URL(href).protocol === "https:";
    } catch {
      return false;
    }
  }
  return /^\/(?!\/)[a-z0-9/_-]*$/i.test(href);
}

/** Keep only well-formed actions of known types, at most three, no duplicates. */
export function sanitizeDeskActions(value: unknown): DeskAction[] {
  if (!Array.isArray(value)) return [];
  const out: DeskAction[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const type = raw.type as DeskActionType;
    if (!TYPES.includes(type)) continue;
    const label = typeof raw.label === "string" ? raw.label.trim().slice(0, 60) : "";
    if (!label) continue;
    const href = typeof raw.href === "string" && raw.href && isSafeHref(raw.href) ? raw.href : undefined;
    if (typeof raw.href === "string" && raw.href && !href) continue; // an unsafe link is dropped, not defused
    const key = `${type}:${href ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(href ? { type, label, href } : { type, label });
    if (out.length === 3) break;
  }
  return out;
}

export function planDeskAction(action: DeskAction): DeskActionPlan | null {
  const form = FORM_TYPES[action.type];
  if (form) return { kind: "form", form };
  if (action.type === "request_assessment") return { kind: "route", path: action.href?.startsWith("/") ? action.href : DESK_ASSESSMENT_PATH };
  if (!action.href) return null;
  if (action.href.startsWith("/")) return { kind: "route", path: action.href };
  return { kind: "link", href: action.href, external: action.href.startsWith("https://") };
}

/**
 * The label the visitor sees. A phone action always says what it does
 * ("Call" and the number), never "Contact sales": the same button is offered
 * to someone reporting a live incident.
 */
export function deskActionLabel(action: DeskAction, phoneDisplay: string): string {
  if (action.type === "contact_sales" && action.href?.startsWith("tel:")) return `Call ${phoneDisplay}`;
  return action.label;
}

/**
 * Short-lived contact handoff between Warehouse Checkout and Request Quote.
 *
 * When online payment cannot proceed (sign-in required, role required,
 * recurring billing, durable storage unavailable) Checkout tells the buyer
 * their details are kept and switches to Request Quote. This module is what
 * makes that sentence true (issues #235 / #258): the validated contact fields
 * are parked in sessionStorage, never in the URL, and Request Quote reads them
 * as its defaults. The handoff expires on its own, is cleared after a
 * successful quote submission, and never carries payment data.
 */

export const WAREHOUSE_CONTACT_HANDOFF_KEY = "de-warehouse-contact-handoff";

export type WarehouseContactHandoffReason =
  | "user_choice"
  | "auth_required"
  | "role_required"
  | "subscription_billing"
  | "durable_db"
  | "physical_fulfillment";

export type WarehouseContactHandoff = {
  version: 1;
  name: string;
  email: string;
  company: string;
  phone: string;
  reason: WarehouseContactHandoffReason;
  writtenAt: number;
};

export const WAREHOUSE_CONTACT_HANDOFF_MAX_AGE_MS = 30 * 60_000;

const REASONS: ReadonlySet<string> = new Set<WarehouseContactHandoffReason>([
  "user_choice",
  "auth_required",
  "role_required",
  "subscription_billing",
  "durable_db",
  "physical_fulfillment",
]);

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function readContactHandoff(
  now: number = Date.now(),
  maxAgeMs: number = WAREHOUSE_CONTACT_HANDOFF_MAX_AGE_MS,
): WarehouseContactHandoff | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(WAREHOUSE_CONTACT_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WarehouseContactHandoff>;
    if (parsed.version !== 1) return null;
    const writtenAt = typeof parsed.writtenAt === "number" ? parsed.writtenAt : 0;
    if (!writtenAt || now - writtenAt > maxAgeMs) {
      store.removeItem(WAREHOUSE_CONTACT_HANDOFF_KEY);
      return null;
    }
    const reason = REASONS.has(String(parsed.reason))
      ? (parsed.reason as WarehouseContactHandoffReason)
      : "user_choice";
    return {
      version: 1,
      name: text(parsed.name),
      email: text(parsed.email).toLowerCase(),
      company: text(parsed.company),
      phone: text(parsed.phone, 40),
      reason,
      writtenAt,
    };
  } catch {
    return null;
  }
}

export function writeContactHandoff(
  input: {
    name?: string;
    email?: string;
    company?: string;
    phone?: string;
    reason: WarehouseContactHandoffReason;
  },
  now: number = Date.now(),
): WarehouseContactHandoff | null {
  const store = storage();
  const next: WarehouseContactHandoff = {
    version: 1,
    name: text(input.name),
    email: text(input.email).toLowerCase(),
    company: text(input.company),
    phone: text(input.phone, 40),
    reason: input.reason,
    writtenAt: now,
  };
  if (!store) return null;
  try {
    store.setItem(WAREHOUSE_CONTACT_HANDOFF_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function clearContactHandoff(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(WAREHOUSE_CONTACT_HANDOFF_KEY);
  } catch {
    // Storage may be blocked; nothing to clear.
  }
}

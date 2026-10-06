/**
 * What a client can do to a Procurement Store order, by order status.
 *
 * Money and fulfilment stay with the Store and DE: an unpaid order can be
 * cancelled straight away; once paid, cancelling or amending is a request DE
 * reviews (refunds, re-quotes). A hold pauses fulfilment until a date, then
 * fulfilment picks the order up again on its own. Orders already being
 * provisioned can't be held (ask DE instead).
 */

export const UNPAID_CANCELLABLE = ["pending", "quote_requested", "quote_sent", "awaiting_payment"] as const;
export const IN_FLIGHT = ["processing", "provisioning"] as const;
export const ORDER_TERMINAL = ["completed", "cancelled", "refunded"] as const;
export const HOLDABLE = [...UNPAID_CANCELLABLE, "paid"] as const;
export const ORDER_HOLD_MAX_DAYS = 90;

export type OrderActorRole = "de_admin" | "orderer" | "leader" | "backup_leader" | "it_contact";

export const ORDER_ACTOR_LABELS: Record<OrderActorRole, string> = {
  de_admin: "Digerati Experts",
  orderer: "Orderer",
  leader: "Leader",
  backup_leader: "Backup leader",
  it_contact: "IT contact",
};

export type StoreOrderHold = {
  orderId: string;
  until: string;
  reason: string;
  by: { userId: string | null; name: string; role: OrderActorRole };
  at: string;
};

export type StoreOrderChangeRequest = {
  id: string;
  orderId: string;
  orderNumber: string;
  clientId: string | null;
  kind: "cancel" | "amend";
  details: string;
  status: "open" | "done" | "declined";
  requestedBy: { userId: string | null; name: string; role: OrderActorRole };
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
};

export type OrderAbilities = {
  /** Cancel now (unpaid). */
  cancelNow: boolean;
  /** Ask DE to cancel (paid or in flight). */
  requestCancel: boolean;
  requestAmend: boolean;
  hold: boolean;
  resume: boolean;
  /** Why something is unavailable, for the page. */
  note: string | null;
};

const has = (list: readonly string[], s: string) => list.includes(s);

export function orderAbilities(status: string, held: boolean, openCancelRequest: boolean): OrderAbilities {
  if (has(ORDER_TERMINAL, status)) {
    return { cancelNow: false, requestCancel: false, requestAmend: false, hold: false, resume: false, note: "This order is closed." };
  }
  const unpaid = has(UNPAID_CANCELLABLE, status);
  return {
    cancelNow: unpaid,
    requestCancel: !unpaid && !openCancelRequest,
    requestAmend: true,
    hold: !held && has(HOLDABLE, status),
    resume: held,
    note: has(IN_FLIGHT, status) ? "This order is already being set up, so it can't be paused. Ask us to cancel or change it instead." : null,
  };
}

export function isHoldActive(hold: Pick<StoreOrderHold, "until"> | null | undefined, today: string): boolean {
  return Boolean(hold && hold.until > today);
}

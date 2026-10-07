import { Token, type TokenTone } from "@/components/portal/ui";
import { STATUS_LABELS, type ServiceRequestStatus } from "@shared/serviceRequests";

/** Status pill: brand = waiting on the requester, info = in motion, ok = done, bad = stopped. */
const TONE: Record<ServiceRequestStatus, TokenTone> = {
  in_basket: "brand",
  pending_approval: "brand",
  on_hold: "warn",
  submitted: "warn",
  under_review: "info",
  device_assigned: "info",
  delivered: "ok",
  return_due: "brand",
  returned: "ok",
  pickup_scheduled: "info",
  received: "info",
  restocked: "ok",
  disposed: "ok",
  approved: "info",
  fulfilled: "ok",
  closed: "ok",
  rejected: "bad",
  cancelled: "neutral",
};

export function RequestStatusToken({ status }: { status: ServiceRequestStatus }) {
  return <Token label={STATUS_LABELS[status] ?? status} tone={TONE[status] ?? "neutral"} dot />;
}

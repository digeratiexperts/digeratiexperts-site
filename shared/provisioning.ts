/**
 * Provisioning status for one portal user, built from what DE actually ran:
 * the latest JumpCloud + Blackpoint lifecycle run (server/lifecycleOrchestrator.ts)
 * and, on the user's own profile, their Store orders that DE provisions.
 *
 * Nothing is inferred: a step with no recorded run is "not_started", and an
 * integration that is not configured is "skipped", never "succeeded".
 */

export type ProvisioningState = "not_started" | "in_progress" | "succeeded" | "failed" | "skipped";

export type ProvisioningStepKey = "jumpcloud" | "blackpoint" | "orders";

export type ProvisioningStep = {
  key: ProvisioningStepKey;
  label: string;
  state: ProvisioningState;
  detail: string;
  at: string | null;
};

export type ProvisioningOrder = {
  id: string;
  orderNumber: string;
  status: string;
  state: ProvisioningState;
  createdAt: string | null;
  detailPath: string;
};

export type ProvisioningSummary = {
  email: string;
  /** "offboarded" when the latest lifecycle run was an offboard. */
  overall: ProvisioningState | "offboarded";
  lastAction: "onboard" | "offboard" | null;
  lastRunAt: string | null;
  steps: ProvisioningStep[];
  orders: ProvisioningOrder[];
};

/** The subset of a lifecycle event this module reads. */
export type LifecycleRun = {
  action: "onboard" | "offboard";
  email: string;
  jumpcloud: Record<string, unknown>;
  blackpoint: Record<string, unknown>;
  createdAt: string;
};

const NOT_CONFIGURED = /not configured/i;

function integrationState(result: Record<string, unknown> | null | undefined): ProvisioningState {
  if (!result || Object.keys(result).length === 0) return "not_started";
  if (result.success === true) return "succeeded";
  if (typeof result.message === "string" && NOT_CONFIGURED.test(result.message)) return "skipped";
  return "failed";
}

function integrationDetail(result: Record<string, unknown> | null | undefined, state: ProvisioningState): string {
  const message = typeof result?.message === "string" ? result.message.trim() : "";
  if (message) return message;
  if (state === "not_started") return "No run recorded yet";
  if (state === "succeeded") return "Completed";
  return "No detail returned";
}

/** Store order statuses DE is still working on, and the ones that finished. */
const ORDER_IN_PROGRESS = new Set(["paid", "processing", "provisioning"]);
const ORDER_DONE = new Set(["completed"]);

export function orderProvisioningState(status: string | null | undefined): ProvisioningState | null {
  const s = (status || "").toLowerCase();
  if (ORDER_IN_PROGRESS.has(s)) return "in_progress";
  if (ORDER_DONE.has(s)) return "succeeded";
  return null; // quotes, unpaid, cancelled or refunded: nothing to provision
}

/** Worst-first: one failure makes the result failed; skipped steps don't count. */
function rollUp(states: ProvisioningState[]): ProvisioningState {
  const real = states.filter((s) => s !== "skipped");
  if (real.length === 0) return states.length ? "skipped" : "not_started";
  if (real.includes("failed")) return "failed";
  if (real.includes("in_progress")) return "in_progress";
  if (real.every((s) => s === "not_started")) return "not_started";
  return "succeeded";
}

export function buildProvisioningSummary(input: {
  email: string;
  latestRun?: LifecycleRun | null;
  orders?: { id: string; orderNumber: string; status: string; createdAt?: string | Date | null }[];
  /** Orders are shown only on the user's own profile. */
  includeOrders?: boolean;
}): ProvisioningSummary {
  const run = input.latestRun || null;
  const at = run?.createdAt || null;
  const jcState = integrationState(run?.jumpcloud);
  const bpState = integrationState(run?.blackpoint);
  const offboard = run?.action === "offboard";

  const steps: ProvisioningStep[] = [
    {
      key: "jumpcloud",
      label: offboard ? "JumpCloud account removed" : "JumpCloud account",
      state: jcState,
      detail: integrationDetail(run?.jumpcloud, jcState),
      at,
    },
    {
      key: "blackpoint",
      label: offboard ? "Blackpoint protection removed" : "Blackpoint protection",
      state: bpState,
      detail: integrationDetail(run?.blackpoint, bpState),
      at,
    },
  ];

  const orders: ProvisioningOrder[] = [];
  if (input.includeOrders) {
    for (const o of input.orders || []) {
      const state = orderProvisioningState(o.status);
      if (!state) continue;
      const created = o.createdAt ? new Date(o.createdAt).toISOString() : null;
      orders.push({ id: o.id, orderNumber: o.orderNumber, status: o.status, state, createdAt: created, detailPath: `/portal/orders/${o.id}` });
    }
    orders.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    orders.splice(5);
    if (orders.length) {
      const orderState = rollUp(orders.map((o) => o.state));
      const open = orders.filter((o) => o.state === "in_progress").length;
      steps.push({
        key: "orders",
        label: "Store orders",
        state: orderState,
        detail: open ? `${open} order${open === 1 ? "" : "s"} being set up` : "Recent orders set up",
        at: orders[0].createdAt,
      });
    }
  }

  // The account (lifecycle) decides the headline; an order still being set up
  // makes it "in progress" unless the account itself failed.
  const account = rollUp([jcState, bpState]);
  const ordersMoving = orders.some((o) => o.state === "in_progress");
  const overall = offboard ? "offboarded" : account !== "failed" && ordersMoving ? "in_progress" : account;

  return {
    email: input.email,
    overall,
    lastAction: run?.action || null,
    lastRunAt: at,
    steps,
    orders,
  };
}

/** True while anything is still moving, so the client polls faster. */
export function provisioningIsLive(summary: ProvisioningSummary | null | undefined): boolean {
  return !!summary?.steps.some((s) => s.state === "in_progress");
}

import { describe, expect, it } from "vitest";
import { paymentSchemaReadinessIssues } from "./paymentSchemaReadiness";

const ready = {
  bindings_table: true,
  consumptions_table: true,
  active_binding_unique_index: true,
  payment_id_unique_index: true,
  ledger_function: true,
  ledger_trigger: true,
  fulfillment_state_table: true,
  fulfillment_queue_index: true,
  fulfillment_state_constraints: true,
  portal_sessions_table: true,
  payment_webhook_inbox_table: true,
  payment_webhook_pending_index: true,
  payment_exceptions_table: true,
};

describe("payment schema readiness", () => {
  it("accepts the complete payment-ledger schema", () => {
    expect(paymentSchemaReadinessIssues(ready)).toEqual([]);
  });

  it.each(Object.keys(ready))("fails closed when %s is absent", (key) => {
    expect(paymentSchemaReadinessIssues({ ...ready, [key]: false }))
      .toContain(key);
  });

  it("fails closed when the catalog query returns no row", () => {
    expect(paymentSchemaReadinessIssues(undefined)).toContain("catalog_result");
  });
});

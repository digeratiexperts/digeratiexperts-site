import { describe, expect, it } from "vitest";

import {
  assertAppliedChecksum,
  buildMigrationPlan,
  migrationChecksum,
  orderedMigrationNames,
} from "./migration-plan.mjs";

describe("production migration plan", () => {
  it("orders numbered SQL migrations and ignores non-SQL files", () => {
    expect(orderedMigrationNames([
      "README.md",
      "0002_second.sql",
      "0001_first.sql",
    ])).toEqual(["0001_first.sql", "0002_second.sql"]);
  });

  it("rejects duplicate sequences and malformed SQL filenames", () => {
    expect(() => orderedMigrationNames(["0001_first.sql", "0001_other.sql"]))
      .toThrow("Duplicate migration sequence: 0001");
    expect(() => orderedMigrationNames(["payment.sql"]))
      .toThrow("Invalid migration filename");
  });

  it("uses stable checksums and refuses mutation of an applied migration", () => {
    const checksum = migrationChecksum("SELECT 1;\n");
    expect(checksum).toHaveLength(64);
    expect(() => assertAppliedChecksum("0001_first.sql", checksum, checksum)).not.toThrow();
    expect(() => assertAppliedChecksum("0001_first.sql", checksum, "different"))
      .toThrow("Applied migration 0001_first.sql has changed");
  });

  it("marks the payment-ledger migration as forward-only maintenance work", () => {
    expect(buildMigrationPlan([
      "0001_base.sql",
      "0002_additive.sql",
      "0003_zoho_payment_integrity.sql",
      "0004_order_fulfillment_state.sql",
    ], ["0001_base.sql", "0002_additive.sql"])).toMatchObject({
      pending: ["0003_zoho_payment_integrity.sql", "0004_order_fulfillment_state.sql"],
      forwardOnlyPending: ["0003_zoho_payment_integrity.sql"],
      requiresMaintenance: true,
    });

    expect(buildMigrationPlan([
      "0003_zoho_payment_integrity.sql",
      "0004_order_fulfillment_state.sql",
    ], ["0003_zoho_payment_integrity.sql"])).toMatchObject({
      pending: ["0004_order_fulfillment_state.sql"],
      forwardOnlyPending: [],
      requiresMaintenance: false,
    });
  });
});

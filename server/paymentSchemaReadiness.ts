type PaymentSchemaCatalogRow = Record<string, unknown>;

export interface PaymentSchemaQueryClient {
  query(sql: string): Promise<{ rows: PaymentSchemaCatalogRow[] }>;
}

const REQUIRED_PAYMENT_SCHEMA_CHECKS = [
  "bindings_table",
  "consumptions_table",
  "active_binding_unique_index",
  "payment_id_unique_index",
  "ledger_function",
  "ledger_trigger",
  "fulfillment_state_table",
  "fulfillment_queue_index",
  "fulfillment_state_constraints",
  "portal_sessions_table",
  "payment_webhook_inbox_table",
  "payment_webhook_pending_index",
  "payment_exceptions_table",
] as const;

function isCatalogTrue(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

export function paymentSchemaReadinessIssues(
  row: PaymentSchemaCatalogRow | undefined,
): string[] {
  if (!row) return ["catalog_result"];
  return REQUIRED_PAYMENT_SCHEMA_CHECKS.filter((check) => !isCatalogTrue(row[check]));
}

const PAYMENT_SCHEMA_CATALOG_QUERY = `
  SELECT
    to_regclass('public.zoho_payment_bindings') IS NOT NULL AS bindings_table,
    to_regclass('public.zoho_payment_consumptions') IS NOT NULL AS consumptions_table,
    EXISTS (
      SELECT 1
      FROM pg_class index_relation
      JOIN pg_index index_definition ON index_definition.indexrelid = index_relation.oid
      WHERE index_relation.relname = 'zoho_payment_bindings_active_target_unique'
        AND index_definition.indisunique
        AND index_definition.indisvalid
        AND pg_get_expr(index_definition.indpred, index_definition.indrelid) ILIKE '%pending%'
        AND pg_get_expr(index_definition.indpred, index_definition.indrelid) ILIKE '%consumed%'
    ) AS active_binding_unique_index,
    EXISTS (
      SELECT 1
      FROM pg_class index_relation
      JOIN pg_index index_definition ON index_definition.indexrelid = index_relation.oid
      WHERE index_relation.relname = 'zoho_payment_consumptions_payment_id_unique'
        AND index_definition.indisunique
        AND index_definition.indisvalid
    ) AS payment_id_unique_index,
    to_regprocedure('enforce_zoho_store_payment_ledger()') IS NOT NULL AS ledger_function,
    EXISTS (
      SELECT 1
      FROM pg_trigger trigger_definition
      JOIN pg_class table_relation ON table_relation.oid = trigger_definition.tgrelid
      WHERE trigger_definition.tgname = 'enforce_zoho_store_payment_ledger_trigger'
        AND table_relation.relname = 'store_orders'
        AND NOT trigger_definition.tgisinternal
        AND trigger_definition.tgenabled <> 'D'
    ) AS ledger_trigger,
    to_regclass('public.store_order_fulfillment_state') IS NOT NULL AS fulfillment_state_table,
    EXISTS (
      SELECT 1
      FROM pg_class index_relation
      JOIN pg_index index_definition ON index_definition.indexrelid = index_relation.oid
      WHERE index_relation.relname = 'store_orders_fulfillment_queue_idx'
        AND index_definition.indisvalid
    ) AS fulfillment_queue_index,
    (
      EXISTS (
        SELECT 1
        FROM pg_constraint constraint_definition
        WHERE constraint_definition.conname = 'store_order_fulfillment_confirmation_state_check'
          AND pg_get_constraintdef(constraint_definition.oid) ILIKE '%sent%'
          AND pg_get_constraintdef(constraint_definition.oid) ILIKE '%failed%'
      )
      AND EXISTS (
        SELECT 1
        FROM pg_constraint constraint_definition
        WHERE constraint_definition.conname = 'store_order_fulfillment_desk_state_check'
          AND pg_get_constraintdef(constraint_definition.oid) ILIKE '%failed%'
      )
    ) AS fulfillment_state_constraints,
    to_regclass('public.portal_sessions') IS NOT NULL AS portal_sessions_table,
    to_regclass('public.zoho_payment_webhook_inbox') IS NOT NULL AS payment_webhook_inbox_table,
    EXISTS (
      SELECT 1
      FROM pg_class index_relation
      JOIN pg_index index_definition ON index_definition.indexrelid = index_relation.oid
      WHERE index_relation.relname = 'zoho_payment_webhook_inbox_pending_idx'
        AND index_definition.indisvalid
    ) AS payment_webhook_pending_index,
    to_regclass('public.zoho_payment_exceptions') IS NOT NULL AS payment_exceptions_table
`;

export async function assertPaymentSchemaReady(
  client: PaymentSchemaQueryClient,
): Promise<void> {
  const result = await client.query(PAYMENT_SCHEMA_CATALOG_QUERY);
  const issues = paymentSchemaReadinessIssues(result.rows[0]);
  if (issues.length) {
    throw new Error(
      `Production critical schema is incomplete: ${issues.join(", ")}. Run and verify numbered migrations before starting the application.`,
    );
  }
}

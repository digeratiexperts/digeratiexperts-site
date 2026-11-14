import type { ZohoPaymentWebhookEvent } from "./zohoPayments";
import { zohoPayments } from "./zohoPayments";
import { PaymentIntegrityError, reconcileSucceededPayment } from "./paymentIntegrity";
import { createStoreOrderPaymentIntegrityPorts } from "./storeOrderPaymentIntegrity";
import { db, dbReady, initPromise, pool } from "./db";

const PROCESSING_STALE_MINUTES = 10;
const MAX_ATTEMPTS = 20;
const CLAIM_BATCH_SIZE = 20;
const WORKER_CONCURRENCY = 4;
const WORKER_INTERVAL_MS = 15_000;

let workerTimer: NodeJS.Timeout | null = null;
let workerRunning = false;

type InboxStatus = "processed" | "requires_action" | "rejected";

type ClaimedWebhook = {
  eventId: string;
  eventType: string;
  payload: ZohoPaymentWebhookEvent;
  attemptCount: number;
};

function isSensitiveMetadataKey(key: string): boolean {
  return /(email|name|phone|address|company)/i.test(key);
}

export function sanitizedPaymentWebhookEvent(
  event: ZohoPaymentWebhookEvent,
): ZohoPaymentWebhookEvent {
  return {
    eventId: event.eventId,
    eventTimeMs: event.eventTimeMs,
    liveMode: event.liveMode,
    eventType: String(event.eventType || "").slice(0, 120),
    paymentId: event.paymentId ? String(event.paymentId).slice(0, 200) : null,
    paymentSessionId: event.paymentSessionId ? String(event.paymentSessionId).slice(0, 200) : null,
    referenceNumber: event.referenceNumber ? String(event.referenceNumber).slice(0, 200) : null,
    invoiceNumber: event.invoiceNumber ? String(event.invoiceNumber).slice(0, 200) : null,
    amount: event.amount ? String(event.amount).slice(0, 80) : null,
    currency: event.currency ? String(event.currency).slice(0, 12) : null,
    status: event.status ? String(event.status).slice(0, 80) : null,
    metadata: (event.metadata || [])
      .filter((item) => !isSensitiveMetadataKey(item.key))
      .slice(0, 5)
      .map((item) => ({
        key: String(item.key).slice(0, 20),
        value: String(item.value).slice(0, 500),
      })),
  };
}

export function classifyPaymentWebhookEvent(
  eventType: string,
): "succeeded" | "attempt_update" | "financial_exception" | "ignored" {
  const normalized = eventType.trim().toLowerCase();
  if (normalized === "payment.succeeded") return "succeeded";
  if (normalized === "payment.pending" || normalized === "payment.failed") {
    return "attempt_update";
  }
  if (/(refund|dispute|chargeback)/.test(normalized)) return "financial_exception";
  return "ignored";
}

export function paymentWebhookRetryDelayMs(attemptCount: number): number {
  const exponent = Math.max(0, Math.min(6, attemptCount - 1));
  return Math.min(60 * 60_000, 60_000 * 2 ** exponent);
}

async function requirePool(): Promise<any> {
  await initPromise;
  if (!dbReady || !db || !pool) {
    throw new Error("Durable PostgreSQL is required for Zoho payment webhooks");
  }
  return pool;
}

export async function enqueueZohoPaymentWebhook(
  event: ZohoPaymentWebhookEvent,
): Promise<{ inserted: boolean; eventId: string }> {
  const eventId = String(event.eventId || "").trim();
  const eventType = String(event.eventType || "").trim();
  if (!eventId || !eventType) throw new Error("Zoho webhook event ID and type are required");

  const databasePool = await requirePool();
  const normalized = sanitizedPaymentWebhookEvent({ ...event, eventId, eventType });
  const result = await databasePool.query(
    `INSERT INTO zoho_payment_webhook_inbox (event_id, event_type, payload)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId, eventType, JSON.stringify(normalized)],
  );
  return { inserted: result.rowCount === 1, eventId };
}

async function claimNextWebhook(): Promise<ClaimedWebhook | null> {
  const databasePool = await requirePool();
  const result = await databasePool.query(
    `WITH candidate AS (
       SELECT event_id
         FROM zoho_payment_webhook_inbox
        WHERE (
          status = 'pending' AND next_attempt_at <= now()
        ) OR (
          status = 'processing'
          AND processing_started_at < now() - ($1 * interval '1 minute')
        )
        ORDER BY received_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE zoho_payment_webhook_inbox inbox
        SET status = 'processing',
            processing_started_at = now(),
            attempt_count = inbox.attempt_count + 1,
            last_error = NULL
       FROM candidate
      WHERE inbox.event_id = candidate.event_id
      RETURNING inbox.event_id, inbox.event_type, inbox.payload, inbox.attempt_count`,
    [PROCESSING_STALE_MINUTES],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    eventId: String(row.event_id),
    eventType: String(row.event_type),
    payload: row.payload as ZohoPaymentWebhookEvent,
    attemptCount: Number(row.attempt_count),
  };
}

async function finishWebhook(
  eventId: string,
  status: InboxStatus,
  lastError: string | null = null,
): Promise<void> {
  const databasePool = await requirePool();
  await databasePool.query(
    `UPDATE zoho_payment_webhook_inbox
        SET status = $2,
            processed_at = now(),
            processing_started_at = NULL,
            last_error = $3
      WHERE event_id = $1 AND status = 'processing'`,
    [eventId, status, lastError?.slice(0, 2000) || null],
  );
}

async function recordFinancialException(
  claim: ClaimedWebhook,
  reason: string,
  status: "requires_action" | "rejected" = "requires_action",
): Promise<void> {
  const databasePool = await requirePool();
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO zoho_payment_exceptions (
         event_id, event_type, payment_id, payment_session_id, reference_number, reason
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (event_id) DO UPDATE SET reason = EXCLUDED.reason`,
      [
        claim.eventId,
        claim.eventType,
        claim.payload.paymentId,
        claim.payload.paymentSessionId,
        claim.payload.referenceNumber,
        reason.slice(0, 2000),
      ],
    );
    await client.query(
      `UPDATE zoho_payment_webhook_inbox
          SET status = $2,
              processed_at = now(),
              processing_started_at = NULL,
              last_error = $3
        WHERE event_id = $1 AND status = 'processing'`,
      [claim.eventId, status, reason.slice(0, 2000)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function retryWebhook(claim: ClaimedWebhook, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  if (claim.attemptCount >= MAX_ATTEMPTS) {
    await recordFinancialException(claim, `Webhook processing exhausted retries: ${message}`);
    return;
  }

  const nextAttemptAt = new Date(Date.now() + paymentWebhookRetryDelayMs(claim.attemptCount));
  const databasePool = await requirePool();
  await databasePool.query(
    `UPDATE zoho_payment_webhook_inbox
        SET status = 'pending',
            next_attempt_at = $2,
            processing_started_at = NULL,
            last_error = $3
      WHERE event_id = $1 AND status = 'processing'`,
    [claim.eventId, nextAttemptAt, message.slice(0, 2000)],
  );
}

async function processClaim(claim: ClaimedWebhook): Promise<void> {
  const classification = classifyPaymentWebhookEvent(claim.eventType);
  try {
    if (classification === "succeeded") {
      const result = await reconcileSucceededPayment(
        claim.payload,
        createStoreOrderPaymentIntegrityPorts({
          database: db,
          retrievePaymentSession: (paymentSessionId) =>
            zohoPayments.getPaymentSessionSnapshot(paymentSessionId),
        }),
      );
      await finishWebhook(claim.eventId, "processed");

      if (result.outcome === "consumed" && result.targetKind === "store_order") {
        void import("./services/orderFulfillment")
          .then(({ fulfillPaidOrder }) => fulfillPaidOrder(result.targetId))
          .catch((error) => {
            console.error("[ZOHO PAYMENT INBOX] fulfillment trigger failed", {
              orderId: result.targetId,
              message: error?.message || String(error),
            });
          });
      }
      return;
    }

    if (classification === "financial_exception") {
      await recordFinancialException(
        claim,
        `Provider financial exception requires review: ${claim.eventType}`,
      );
      console.error("[SECURITY] ZOHO_PAYMENT_FINANCIAL_EXCEPTION", {
        eventId: claim.eventId,
        eventType: claim.eventType,
        paymentId: claim.payload.paymentId,
      });
      return;
    }

    await finishWebhook(claim.eventId, "processed");
  } catch (error) {
    if (error instanceof PaymentIntegrityError && error.code !== "binding_not_found") {
      await recordFinancialException(
        claim,
        `Payment integrity rejected event: ${error.code}`,
        "rejected",
      );
      console.error("[SECURITY] ZOHO_PAYMENT_INTEGRITY_REJECTED", {
        eventId: claim.eventId,
        code: error.code,
      });
      return;
    }
    await retryWebhook(claim, error);
  }
}

export async function processZohoPaymentWebhookInbox(): Promise<{
  claimed: number;
}> {
  if (workerRunning) return { claimed: 0 };
  workerRunning = true;
  let claimed = 0;
  try {
    while (claimed < CLAIM_BATCH_SIZE) {
      const slots = Math.min(WORKER_CONCURRENCY, CLAIM_BATCH_SIZE - claimed);
      const batch = (await Promise.all(
        Array.from({ length: slots }, () => claimNextWebhook()),
      )).filter((item): item is ClaimedWebhook => item !== null);
      if (batch.length === 0) break;
      claimed += batch.length;
      await Promise.all(batch.map(processClaim));
    }
    return { claimed };
  } finally {
    workerRunning = false;
  }
}

export function startZohoPaymentWebhookInbox(): void {
  if (process.env.NODE_ENV !== "production" || workerTimer) return;
  void processZohoPaymentWebhookInbox().catch((error) => {
    console.error("[ZOHO PAYMENT INBOX] initial worker pass failed", error?.message || error);
  });
  workerTimer = setInterval(() => {
    void processZohoPaymentWebhookInbox().catch((error) => {
      console.error("[ZOHO PAYMENT INBOX] worker failed", error?.message || error);
    });
  }, WORKER_INTERVAL_MS);
  workerTimer.unref?.();
}

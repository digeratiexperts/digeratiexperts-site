# Issue #688 — bounded reconstruction
Date: 2026-10-26 UTC
Branch: recovery/store-paid-handoff-688-20261026
Base: 4896b68fee1a0f866a27d9a20632c7a6d51a9aa8
Original claim/history retained: #688; codex/store-provisioning-handoff-20261021; 01a15f99-5831-71f4-8442-33a5420cf03e.

The original artifacts were not recovered. This companion reconstructs only the confirmed paid-state/outbox atomicity gap and cancellation/amendment provisioning guard from verified current code, on the parent's explicit bounded continuation. It does not supersede the original ownership or claim recovery of its patch.

Scope: verified Zoho payment block; reusable Store command payload; transactional payment/outbox helper and focused tests; narrow outbox transaction executor support; Store paid-command delivery gate and existing fulfillment guard. Existing tables, envelope, 15-second worker, signatures, and approved order/payment semantics remain the integration paths. No schema, wider reconciliation engine, account projection refresh, or receiver rewrite.

Acceptance: real synthetic PostgreSQL rollback on outbox insertion failure, one paid handoff on concurrent/replayed notifications, current terminal/hold/request gates, done cancellation/amendment remains blocked, tenant and purchase-snapshot integrity, existing payment/order tests.

Concurrency: current open PRs #848, #847, #846, #843, #839 changed-file sets checked with no intersection. Active claims #845/#585/#584/#544/#697/#696 checked; #688 is the original owner of this slice. No .ai/ACTIVE_WORK.yaml edit or remote publication. Audio, PDF override, and #846 worktrees remain protected.

Verification: Vitest focused DB suite against isolated loopback cluster; existing payment/order/de-sync tests; typecheck and build where supported. Test environment clears DATABASE_URL; no production records or credentials.

Status: locally implemented and independently reviewed with cautions. Final typecheck and server bundle pass; the final full run has passed all 19 PostgreSQL handoff cases and 18 existing de-sync cases. The full-suite result is recorded in the companion handoff. Not published, merged, deployed, or production verified.

## Implemented behavior

- Verified payment is re-read under a Store order row lock. The paid status, provider payment ID/timestamp and existing `store.order_created` outbox insert use the same transaction. Insert failure propagates to the webhook's existing 500 response; no fulfillment starts from a failed transaction.
- Concurrent/replayed deliveries observe the committed status and create one paid handoff per order. Existing missing-payment-ID enrichment remains supported; separate legitimate orders remain distinct.
- Cancelled/refunded orders reject late success. The existing local fulfillment path and outbound paid gate block active holds and all non-declined cancel/amend requests, including `done`. Administrative completion or a resolution note cannot reconcile the original purchase.
- Before delivery, current Store truth is compared with the exact durable event, tenant/client mapping, commercial details and original subtotal/tax/total proof.
- An account mapping learned by earlier unpaid intake may be bound from null to the current trusted mapping. That binding is saved on the same outbox row before delivery; later non-null identity changes are refused.
- Payment proof is local outbox metadata and is stripped before the existing signed sender. Hub's wire payload and the existing 15-second worker remain the delivery path. No sync schema or database topology change.

## Evidence and review

Companion evidence lives one directory above this worktree. `reconstruction-red.log` reproduced the failed rollback and terminal revival with real synthetic PostgreSQL. The first focused run passed all new DB/gate cases but exposed an old fulfillment fixture missing `dbReady`; its intended memory-mode export is now explicit. The expanded run passed 104 checks and had two de-sync timing/carryover failures after a cold lazy import exceeded five seconds. The final full run uses a companion-only configuration with identical source aliases/include/exclude rules and a 30-second local timeout; it changes no CI/test assertions or repository config.

Independent read-only review found and prompted repairs for trusted null-mapping enrichment and monetary-only drift. Re-review reports no remaining P1 issue in this bounded code. Final tests/typecheck remain the evidence gate; release/integration review remains with the existing integrator.

## Deliberate limits and deployment gates

- This is reconstructed current-source work. Original history/ownership remains intact; the old patch was not recovered.
- Legacy paid events with no verified monetary snapshot fail closed. Reconciliation must use original payment/purchase proof; do not fabricate it from today's order values.
- Existing pre-payment intake remains unchanged. This slice does not backfill arbitrary already-paid historical orders or replace account/receiver reconciliation.
- Long policy holds consume the existing retry budget and may reach DLQ. Use the existing manual retry after eligibility/reconciliation is verified; automatic end-to-end resume is not claimed.
- Preparation commits before network delivery. Changes after preparation and remote receiver atomicity/concurrency/compensation remain the explicitly separate follow-on.
- Done cancel/amend requests intentionally have no automatic release path here. A verified replacement/reconciliation requires a separately reviewed action; freeform notes or administrative completion cannot authorize the original purchase.
- No UI changes, real payments, production/customer records, secrets, new persistent access, production migrations, CI runs, push, merge or deploy.
- Before integration/deployment: recheck current main/ownership, review the bounded diff and test report, confirm existing Store control/outbox tables and Hub consumer behavior in the approved release process, and obtain release authority. No live schema or credential action was performed here.

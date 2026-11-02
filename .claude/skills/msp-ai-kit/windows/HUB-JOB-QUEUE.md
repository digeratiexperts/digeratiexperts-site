# Hub job queue for the DE Tech Agent: lease, acknowledge, result

**Move 60** of the 104-move plan ([issue #778](https://github.com/digeratiexperts/digeratiexperts-site/issues/778)).
**Design only.** Nothing in this document is built, enabled or sent anywhere. It specifies the device-facing job-queue
endpoints that the Hub implements and the DE Tech Agent calls, so that moves 61-72 and 75-78 build against one contract.
The implementation lives in `digeratiexperts/Intelligence-Hub` and needs its own pull request and Joe's explicit merge
approval there.

It answers **D1** (flooded queue), **R1** (nobody can prove who ordered a job) and **T1** (job edited after approval) of
[AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md), and it carries the job envelope defined by move 59 unchanged.

## 1. What already exists, and what this reuses

The Hub already runs a control plane for its Go endpoint agent (`de.endpoint/v1`, Intelligence-Hub
`docs/ENDPOINT-AGENT.md`, `docs/ENDPOINT-AGENT-SECURITY.md`, `artifacts/api-server/src/routes/endpoint-agent.ts`). Its
device-facing routes are `signing-keys`, `enroll`, `checkin`, `jobs/claim`, `jobs/:id/result`, `security-events`,
`update` and the message routes; its staff-facing routes are the approvals, pauses, enrolment tokens, devices and jobs
pages. The DE Tech Agent **reuses its patterns, not its routes**:

| Pattern (control) | Reused here as |
|---|---|
| Seal an approved job and check the seal before delivery; a mismatch pauses delivery (C3) | The same seal over the queue row, section 5 |
| Sign one device's job for 15 minutes at claim time (C4) | The lease and the envelope window are the same 900 seconds |
| A ledger entry before the work starts; each job delivered once (C5) | Lease states, section 4 |
| Pending devices get no jobs (C18) | `pending` devices are refused a lease |
| Per-device rate limit counted only after authentication (C19) | Section 6 |
| Pause for all accounts or one, any staff, only an owner_admin resumes, unreadable pause means no delivery (C8, move 78) | Section 7, shared with the existing pause table |
| Refusals are data, rate-limited alerts (C20) | `ack` with a refusal and the security event |
| Append-only audit of every step (C16) | Section 8 |

**Decision proposed, not made:** a **new namespace and new tables** for the DE Tech Agent (below), sharing the Hub's seal
code and pause table with the endpoint agent, rather than extending `de.endpoint/v1`. The two agents have different
runtimes, signing models (the Tech Agent uses mTLS plus a per-device client certificate, moves 62-63) and job contracts,
and a shared route would couple their releases. If DE prefers to extend the existing routes, only section 3's paths and
section 9's table names change.

## 2. Actors and credentials

| Actor | Credential | Notes |
|---|---|---|
| DE Tech Agent (SYSTEM service) | A per-device client certificate (62), presented over mTLS (63) | The only credential the agent holds. The shared de-sync HMAC secret is never accepted here |
| Hub staff | The existing Hub session and roles | Create, approve, cancel, pause |
| Hub job signer | The job key, in the Hub environment until a managed KMS (D7) | Seals approved rows and signs the per-device envelope at lease time |

The agent verifies envelopes against signing keys **pinned at build or enrolment time**. The Hub can never add one (S2):
there is no endpoint that hands the agent a key to trust. The Hub's public key listing exists for staff and for
pinning at build time only.

## 3. Endpoints

Base path: `/api/techagent/v1/` (proposed). Every call is mTLS-authenticated, JSON in and out, TLS only, outbound from the
device. The device identity (account, device key) comes from the client certificate, **never from the body**; a body that
disagrees with the certificate is refused with `device_mismatch`.

| Method and path | Who | Purpose | Detailed in |
|---|---|---|---|
| `POST /jobs/lease` | agent | Ask for work; receive at most one signed envelope and its lease | section 3.1 |
| `POST /jobs/{jobId}/ack` | agent | Say the envelope was verified and accepted, or refused and why | section 3.2 |
| `POST /jobs/{jobId}/result` | agent | Report the outcome, once | section 3.3 |
| `POST /jobs/{jobId}/cancel` | staff | Cancel before it is acknowledged | section 4 |
| `GET /jobs/{jobId}` | staff | State, lease, result, audit trail | section 4 |

Enrolment, heartbeat and evidence upload are separate contracts (moves 61, 69, 70) and are only referenced here.

Request headers on every agent call: `X-DE-Request-Id` (a UUID, logged), `X-DE-Nonce` (single-use, 22-86 base64url
characters, accepted once per device) and `X-DE-Timestamp` (UTC, within 300 seconds of the Hub's clock). The nonce is
recorded after the certificate verifies, so a forger cannot use up a real device's allowance (C19).

### 3.1 `POST /jobs/lease`

The agent polls. It sends what the Hub needs to choose a job it can run, and nothing about people.

Request:

```json
{
  "agentVersion": "0.1.0",
  "catalogSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "enabledKinds": ["audit"],
  "max": 1
}
```

- `enabledKinds` is what **this agent build** will accept (move 59's policy, `enabled: true`). The Hub never leases a kind
  the agent did not offer, so a Hub-side change cannot enable a kind on a device.
- `catalogSha256` lets the Hub pin the envelope to the catalog this device actually has (move 67).
- `max` is 1 in v1.

Responses:

| Status | Meaning | Body |
|---|---|---|
| `200` | A job is leased | the envelope and the lease, below |
| `204` | Nothing to do | none; the agent waits its poll interval |
| `403` | Device is `pending`, `revoked` or unknown | `{ "error": "device_not_active" }` |
| `423` | Delivery is paused (kill switch, move 78) or the pause state cannot be read | `{ "error": "paused", "retryAfterSeconds": 300 }`. **Fails closed**: unreadable means no delivery |
| `429` | Rate limit | `Retry-After` header |

`200` body. The envelope is a `de.techconsole.job/v1` document, signed **for this device** at lease time; its
`expiresAt` is the lease expiry:

<!-- example:lease-response -->
```json
{
  "lease": {
    "leaseId": "5f1d3c52-8a6e-4b9b-9d0e-7c3f2a1b4d60",
    "jobId": "0b8f6d1e-3c4a-4d2b-9e7f-1a2b3c4d5e6f",
    "leasedAt": "2026-11-01T12:00:00Z",
    "leaseExpiresAt": "2026-11-01T12:10:00Z"
  },
  "job": {
    "schema": "de.techconsole.job/v1",
    "jobId": "0b8f6d1e-3c4a-4d2b-9e7f-1a2b3c4d5e6f",
    "kind": "audit",
    "accountId": "42",
    "deviceKey": "dell:ABC123",
    "actions": ["net.connectivity", "maint.hardware"],
    "issuedAt": "2026-11-01T12:00:00Z",
    "expiresAt": "2026-11-01T12:10:00Z",
    "nonce": "AAAAAAAAAAAAAAAAAAAAAA",
    "catalogSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "issuedBy": "joe",
    "reason": "ticket 1234",
    "keyId": "job-2026-1",
    "signature": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  }
}
```

The lease carries no authority of its own. The device decides from the **envelope** (signature, window, kind, actions,
nonce), and the lease only tells the Hub which attempt this is.

### 3.2 `POST /jobs/{jobId}/ack`

Sent after the agent has verified the envelope and before any action runs. Acknowledging an accepted job is what moves
it to `running`; from then on the Hub will not lease it again (C5).

Accepted:

```json
{ "leaseId": "5f1d3c52-8a6e-4b9b-9d0e-7c3f2a1b4d60", "accepted": true }
```

Refused. A refusal is **data and a security event**, never silence (section 11 of the threat model):

<!-- example:ack-refusal -->
```json
{
  "leaseId": "5f1d3c52-8a6e-4b9b-9d0e-7c3f2a1b4d60",
  "accepted": false,
  "refusal": {
    "code": "kind_not_enabled",
    "detail": "audit jobs are not enabled on this agent build"
  }
}
```

`refusal.code` is one of: `bad_signature`, `unknown_key`, `expired`, `not_yet_valid`, `replayed_nonce`, `wrong_device`,
`wrong_account`, `catalog_mismatch`, `kind_not_enabled`, `action_not_allowed`, `action_not_in_catalog`, `order_rule`,
`hands_on_only`, `bad_parameters`, `schema`. `detail` is redacted on the device and never carries a parameter value.
Responses: `200` recorded; `404` unknown job or lease; `409` the lease expired or the job is already past this step.

### 3.3 `POST /jobs/{jobId}/result`

Sent once, when the job ends. The body is capped, redacted on the device before egress and before the cap (C9), and redacted
again at the Hub.

<!-- example:result -->
```json
{
  "leaseId": "5f1d3c52-8a6e-4b9b-9d0e-7c3f2a1b4d60",
  "status": "succeeded",
  "startedAt": "2026-11-01T12:00:05Z",
  "finishedAt": "2026-11-01T12:00:40Z",
  "actions": [
    { "id": "net.connectivity", "version": "1", "result": "PASS", "phase": "verify" },
    { "id": "maint.hardware", "version": "1", "result": "PASS", "phase": "verify" }
  ],
  "resultSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "evidenceRefs": [],
  "redacted": true
}
```

- `status`: `succeeded`, `failed`, `cancelled`, `timed_out`. A refusal is reported through `ack`, not here.
- `resultSha256` binds the result to its content (T4). Evidence is uploaded separately (move 70) and referenced by id.
- Results carry state, not people: the personal and path field classes are removed before this body is built (I5).
- **Idempotent.** The pair (`jobId`, `resultSha256`) is the idempotency key. Repeating it returns `200` with the original
  receipt; a different `resultSha256` for a job that already has a result is `409 result_conflict` and raises a security
  event.

Responses: `200` receipt `{ "receiptId": "...", "recordedAt": "..." }`; `404`; `409`; `413` over the size cap.

## 4. Job and lease states

```
queued --approve (sealed)--> approved --lease--> leased --ack accepted--> running --result--> succeeded | failed | cancelled | timed_out
                                |                  |                                  
                                | cancel           +--ack refused--> refused (security event)
                                v                  +--lease expires, never acknowledged--> approved again (see below)
                             cancelled                                                      
```

- **Seal.** Approval seals the row's content (job type, account, device, actions, parameters, approvals, window rules)
  with the job key. The seal is checked before the envelope is signed for delivery. A mismatch refuses the job, **pauses
  delivery for every account automatically** and raises a critical alert until an owner_admin has looked (C3, T1).
- **Once.** A job is acknowledged at most once. After `ack accepted` it is never leased again; if its lease runs out while
  `running`, it becomes `timed_out` and needs a person, because the Hub cannot know how far a destructive action got.
- **Re-lease only when never started.** A lease that expires with no `ack` returns the job to `approved` (with an attempt
  counter and a ceiling of 3) because nothing ran. Each attempt gets a new `leaseId`, a new `nonce` and a new window.
- **Cancel** is accepted until the job is acknowledged. After that it is a request the agent honours between actions only
  (a cancelled run must leave no half-applied state, move 37).
- **Mass impact.** Creating a job set that targets 10 or more devices needs a person's approval even from the catalog
  (D5). That is enforced at creation and approval, not here.

## 5. What the Hub keeps (proposed tables)

All account-scoped (TB8), all with database check constraints that mirror the route rules, so a route bug cannot weaken them.

| Table | Holds | Key constraints |
|---|---|---|
| `techagent_jobs` | The approved job: kind, account, device, actions, parameters, issuer, reason, approvals, state, seal, created and approved by | Seal required to leave `queued`; destructive actions need a second approver (D5) |
| `techagent_job_leases` | One row per lease: job, device, `leaseId`, window, attempt, ack outcome | One live lease per job; lease window at most 900 seconds |
| `techagent_job_results` | Result summary, `resultSha256`, size, redaction flag, receipt | Unique on (`jobId`, `resultSha256`) |
| `techagent_request_nonces` | Device, nonce, seen-at | Primary key on (device, nonce): the once-only rule lives in the database (C1) |
| `techagent_audit` | Append-only record of every step in section 8 | No update or delete grant for the application role |

## 6. Limits

- **300 authenticated requests per device per 5 minutes** (C19), counted after the certificate verifies. Over the limit is
  `429` with `Retry-After`.
- **Poll interval 60 seconds with jitter of plus or minus 20 percent**, so a fleet does not synchronise. Backoff to 5
  minutes on `423`, `429` or a network error; the agent's local functions keep working throughout (D3, move 76).
- **Result body at most 256 KiB**; evidence goes through the resumable upload (move 70), not through `result`.
- **Per-device queue depth of 20 approved jobs**; creation beyond it is refused with a staff-visible reason.
- The load test for these numbers is move 77.

## 7. The kill switch (shared with move 78)

The Hub already has a pause table (any staff pauses, only an owner_admin resumes, the server-level override
`ENDPOINT_JOBS_PAUSED=1` stays). The queue consults it before every lease and returns `423` when a pause covers the
device's account or the whole fleet. **If the pause state cannot be read, nothing is delivered.** An in-flight job is not
interrupted by the pause; it is not re-leased, and the agent honours a cancel between actions.

## 8. Audit

Every one of these is written to `techagent_audit` with the actor, account, device, job, lease, request id and a content
hash, never a parameter value (R1, C16): job created, approved, denied, sealed, seal mismatch, cancelled; lease granted, lease
refused (with the reason), lease expired; ack accepted, ack refused (with the refusal code); result recorded, result
conflict; pause and resume. Alerts follow the endpoint agent's rules: a refusal reported by an agent is critical, repeated
failures are rate-limited per signal (C20), and mail goes to `security@digeratiexperts.com` (D8, Joe to confirm the alias).

## 9. Errors

Every error body is `{ "error": "<code>", "message": "<short, no values>" }`.

| Status | `error` | When |
|---|---|---|
| 400 | `bad_request` | Malformed body or header |
| 401 | `no_client_certificate` | mTLS did not present a valid certificate |
| 403 | `device_not_active` | Pending, revoked or unknown device |
| 403 | `device_mismatch` | The body names a device or account other than the certificate's |
| 404 | `not_found` | Unknown job or lease |
| 409 | `lease_expired` | The lease ran out |
| 409 | `already_acknowledged` | The job is already running or finished |
| 409 | `result_conflict` | A different result for a job that already has one |
| 413 | `too_large` | Over the size cap |
| 423 | `paused` | Delivery is paused, or the pause state is unreadable |
| 429 | `rate_limited` | Over the device limit |
| 401 | `stale_request` | `X-DE-Timestamp` outside the allowed skew, or a repeated `X-DE-Nonce` |

## 10. Out of scope

Enrolment tokens (61), certificates (62), mTLS (63), rotation (64), device-side signature and nonce checks (65, 66),
catalog check (67), the service (68), heartbeat (69), evidence (70, 71), install (72), revocation test (75), the Hub-down
test (76), the load test (77) and the kill switch's own UI (78). This document fixes the shapes those moves build against.

## 11. Decisions this design asks for

1. A new `techagent` namespace and tables sharing the endpoint agent's seal code and pause table (section 1). The
   alternative is to extend `de.endpoint/v1`.
2. The re-lease ceiling of 3 and the queue depth of 20 (sections 4 and 6); both are tuned by move 77.
3. Whether `X-DE-Nonce` is kept on top of mTLS. It is cheap and matches C1; mTLS alone does not stop a captured request from
   being replayed inside its session window.

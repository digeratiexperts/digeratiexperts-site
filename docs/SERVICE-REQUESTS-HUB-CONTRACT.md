# Service requests: Portal → Hub contract (v1)

The Portal database is the source of truth for service requests (Request Loaner Computer, Return Computer). The Hub keeps a synced copy and never creates these requests. Code: `shared/serviceRequests.ts`, `server/serviceRequestHubSync.ts`, `server/serviceRequestRoutes.ts`.

## Delivery

| | |
|---|---|
| Event type | `service_request.upserted` (added to the shared DE-Sync event list; both `deSyncContract.fixture.json` copies must list it) |
| Method / path | `POST {TECHSALES_HUB_URL}/api/ingest/service-requests` |
| Source / secret | `X-DE-Source: portal`, HMAC with `PORTAL_TO_HUB_SECRET` (direction `portal_to_hub`) |
| Headers | `X-DE-Event-ID`, `X-DE-Timestamp` (ISO 8601), `X-DE-Source`, `X-DE-Signature` |
| Signature | hex HMAC-SHA256 over `POST\n/api/ingest/service-requests\n{timestamp}\n{eventId}\n{sha256_hex(body)}`, the same canonical string as every DE-Sync route |
| Freshness | the Hub refuses a timestamp more than 5 minutes from its clock |
| Binding | `X-DE-Event-ID` must equal the body's `eventId` |
| Queue | durable `sync_outbox`, worker every 15 s; retries at 30 s, 2 m, 5 m, 15 m, 1 h, 4 h, then dead letter |
| When sent | on submit (Order Now, or basket submit), on every status change (staff, Hub write-back, requester cancel) and on a new attachment. Basket items are never sent. |
| Hub reply | any 2xx marks the event delivered (`hub_sync_status = synced`). A non-2xx or network error is retried. A JSON `{ "duplicate": true }` is accepted. |

The Portal never blocks a submission on the Hub. `service_requests.hub_sync_status` is `not_sent` → `queued` → `synced`, or `retrying` / `failed`.

## Idempotency and ordering

- **Replay:** `eventId` is unique per delivery attempt chain. Record it (`sync_inbox` or equivalent) and answer 200 `{ "duplicate": true }` to a repeat.
- **Upsert key:** `payload.requestId` (Portal `service_requests.id`, UUID). One Hub row per request.
- **Ordering:** `payload.revision` is a positive integer that goes up by one on every change to the request. Apply an event only if `revision` is greater than the stored revision; otherwise acknowledge it with 200 and change nothing. A late retry of an old revision can therefore never overwrite a newer one.

## Envelope (JSON Schema)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DE-Sync envelope: service_request.upserted v1",
  "type": "object",
  "required": ["eventId", "eventType", "version", "source", "occurredAt", "correlationId", "entityType", "entityId", "payload"],
  "properties": {
    "eventId": { "type": "string", "format": "uuid" },
    "eventType": { "const": "service_request.upserted" },
    "version": { "const": 1 },
    "source": { "const": "portal" },
    "occurredAt": { "type": "string", "format": "date-time" },
    "correlationId": { "type": "string", "format": "uuid", "description": "Equals payload.requestId" },
    "entityType": { "const": "service_request" },
    "entityId": { "type": "string", "description": "Equals payload.requestId" },
    "canonicalAccountId": { "type": ["string", "null"], "description": "Hub accounts.id from portal_clients.hub_account_id; null when the company is not mapped yet" },
    "originEventId": { "type": ["string", "null"] },
    "payload": { "$ref": "#/$defs/payload" }
  },
  "$defs": {
    "person": {
      "type": "object",
      "required": ["userId", "name", "email"],
      "properties": { "userId": { "type": "string" }, "name": { "type": "string" }, "email": { "type": "string" } }
    },
    "address": {
      "type": "object",
      "required": ["street", "city", "state", "country", "zip"],
      "properties": {
        "street": { "type": "string" }, "city": { "type": "string" }, "state": { "type": "string" },
        "country": { "type": "string" }, "zip": { "type": "string" }
      }
    },
    "site": {
      "allOf": [{ "$ref": "#/$defs/address" }],
      "type": "object",
      "required": ["id", "code"],
      "properties": { "id": { "type": "string" }, "code": { "type": "string", "description": "Site Location Code (LID), or HQ" }, "name": { "type": "string" } }
    },
    "status": {
      "enum": ["submitted", "under_review", "device_assigned", "delivered", "return_due", "returned",
               "pickup_scheduled", "received", "restocked", "disposed", "closed", "rejected", "cancelled"]
    },
    "payload": {
      "type": "object",
      "required": ["contractVersion", "requestId", "number", "type", "status", "revision", "portalClientId", "accountName",
                   "requestedFor", "submittedBy", "fields", "site", "customAddress", "attachments", "statusHistory",
                   "deskTicketId", "submittedAt", "updatedAt"],
      "properties": {
        "contractVersion": { "const": 1 },
        "requestId": { "type": "string" },
        "number": { "type": "string", "pattern": "^(LNR|RTN|LIC)-\\d{6}$" },
        "type": { "enum": ["loaner_computer", "return_computer", "license_request"] },
        "status": { "$ref": "#/$defs/status" },
        "revision": { "type": "integer", "minimum": 1 },
        "portalClientId": { "type": "string" },
        "accountName": { "type": "string" },
        "requestedFor": { "$ref": "#/$defs/person" },
        "submittedBy": { "$ref": "#/$defs/person" },
        "fields": { "type": "object", "description": "Type-specific form fields, below" },
        "site": { "oneOf": [{ "$ref": "#/$defs/site" }, { "type": "null" }] },
        "customAddress": { "oneOf": [{ "$ref": "#/$defs/address" }, { "type": "null" }], "description": "Set when the address is not a client location (then site is null)" },
        "attachments": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "fileName", "contentType", "sizeBytes"],
            "properties": { "id": { "type": "string" }, "fileName": { "type": "string" }, "contentType": { "type": "string" }, "sizeBytes": { "type": "integer" } }
          },
          "description": "Metadata only; file bytes stay in the Portal"
        },
        "statusHistory": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["status", "at", "by"],
            "properties": {
              "status": { "$ref": "#/$defs/status" },
              "at": { "type": "string", "format": "date-time" },
              "by": { "enum": ["requester", "staff", "hub", "system"] },
              "note": { "type": ["string", "null"] }
            }
          }
        },
        "deskTicketId": { "type": ["string", "null"], "description": "Zoho Desk ticket id when one was created" },
        "submittedAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

### `fields` by type

**loaner_computer**: `requestedForUserId`, `contactPhone`, `deviceKind` (`laptop` | `desktop`), `neededFrom` and `loanUntil` (YYYY-MM-DD), `siteId` (string | null), `addressNotClientLocation` (boolean), `accessories`, `reason`, `additionalNotes`.

**return_computer**: `requestedForUserId`, `contactPhone`, `returnReason` (`user_leaving` | `device_refresh` | `no_longer_needed` | `damaged` | `loaner_end` | `other`), `assetId` (string | null), `assetNotListed` (boolean), `asset` ({ id, assetTag, serialNumber, model } | null; snapshot of the assigned asset), `manualAsset` ({ assetTag, serialNumber, description } | null), `accessories`, `preferredReturnDate` (YYYY-MM-DD | null), `additionalComments`, `siteId`, `addressNotClientLocation`.

**license_request** (number prefix `LIC`): `accountKind` (`person` | `admin` | `service` | `shared`), `requestedForUserId` (the person, or the requester for a non-person account), `accountName` (non-person accounts only), `platform` (`microsoft_commercial` | `microsoft_gcc` | `microsoft_gcc_high` | `google_workspace` | `zoho_workplace`), `licenseKey` (catalog key, e.g. `m365_e5`, `visio_p2`), `operation` (`add` | `remove`), `businessJustification`. The Portal resolves the company licence policy at submission and adds: `accountType` (`standard` | `frontline` | `contractor` | `admin` | `service` | `shared`), `tier` (string | null), `licenseName`, `licenseKind` (`base` | `addon`), `group` (the licence group to change, string | null) and `approval` (`none` | `manager` | `it_contact` | `request`). Licences the policy assigns automatically, and ones the account type is not eligible for, are refused at the Portal and never reach the Hub. No prices are sent.

**Routing, on every type** (added by the Portal at submission from the company structure, `shared/orgDirectory.ts`):

- `contactPlan`: `{ supportTier: "standard" | "vip", personId, primary: { userId, name, email, phone, awayUntil }, unit: { kind: "site" | "department", id, name } | null, fallback: { userId, name, email, role: "leader" | "backup_leader" } | null, cc: [{ userId, name, email }], summary }`. VIPs: `fallback` is null and `cc` is empty (direct support only). Standard users: contact directly, else `fallback`. `personId` is the company's employee ID when the company uses its own scheme, else the DE person ID.
- `approvalFlow`: `{ required: false, reason }` or `{ required: true, rule: "leader" | "it_contact", state: "pending" | "approved" | "rejected", approvers: [{ userId, name, email, role: "leader" | "backup_leader" | "manager" | "it_contact" }], decidedBy?, decidedAt?, note? }`.

### Status lifecycles

- Every type may start at `pending_approval` ("Awaiting approval") when the company needs a leader's (or IT contact's) approval: pending_approval → submitted (approved in the Portal) | rejected | cancelled. No Desk ticket exists until it is approved. Staff and the Hub may only reject or cancel it; approval happens in the Portal.
- Loaner: submitted → under_review → device_assigned → delivered → return_due → returned → closed; rejected; cancelled (requester, before device_assigned).
- Return: submitted → under_review → pickup_scheduled → received → restocked | disposed → closed; rejected; cancelled (requester, before pickup_scheduled).
- Licence: submitted → under_review → approved → fulfilled ("Licence assigned") → closed; submitted → approved directly; rejected; cancelled (requester, before approved; staff, before fulfilled).

## Hub → Portal status write-back

The Portal stays the authority for status. A Hub staff change calls:

`POST {PORTAL_ORIGIN}/api/integrations/v1/hub/service-requests/{requestId}/status`

- Signed `hub_to_portal` (`HUB_TO_PORTAL_SECRET`, `X-DE-Source: techsales`), the same headers and canonical string with this path.
- Body: `{ "status": "<status>", "note": "optional, ≤1000 chars", "revision": <optional expected revision> }`.
- 200 `{ success, request }` on change; 200 `{ success, unchanged: true, request }` when the request is already in that status (safe to retry); 409 on a transition outside the lifecycle or a stale `revision`; 404 for an unknown id.
- On success the Portal queues the new revision back to the Hub through the normal event above, so the Hub's copy updates from the Portal, not from its own write.

## Example payload

```json
{
  "eventId": "5c0d3f1e-7f55-4c1e-9d7b-2f7e1a0b9c11",
  "eventType": "service_request.upserted",
  "version": 1,
  "source": "portal",
  "occurredAt": "2026-10-06T21:30:00.000Z",
  "correlationId": "0b6a3c3e-2f8a-4a43-9e6d-1c0a5f7d2e10",
  "entityType": "service_request",
  "entityId": "0b6a3c3e-2f8a-4a43-9e6d-1c0a5f7d2e10",
  "canonicalAccountId": "41",
  "originEventId": null,
  "payload": {
    "contractVersion": 1,
    "requestId": "0b6a3c3e-2f8a-4a43-9e6d-1c0a5f7d2e10",
    "number": "LNR-000123",
    "type": "loaner_computer",
    "status": "submitted",
    "revision": 2,
    "portalClientId": "c-acme",
    "accountName": "Acme Corp",
    "requestedFor": { "userId": "u-ann", "name": "Ann Example", "email": "ann@example.com" },
    "submittedBy": { "userId": "u-ann", "name": "Ann Example", "email": "ann@example.com" },
    "fields": {
      "requestedForUserId": "u-ann", "contactPhone": "(602) 555-0100", "deviceKind": "laptop",
      "neededFrom": "2026-10-07", "loanUntil": "2026-10-21", "siteId": "mr_az76",
      "addressNotClientLocation": false, "accessories": "", "reason": "Laptop in for repair", "additionalNotes": ""
    },
    "site": { "id": "mr_az76", "code": "AZ76", "street": "1 Main St", "city": "Glendale", "state": "Arizona", "country": "United States of America", "zip": "85308-9650" },
    "customAddress": null,
    "attachments": [],
    "statusHistory": [{ "status": "submitted", "at": "2026-10-06T21:30:00.000Z", "by": "requester", "note": null }],
    "deskTicketId": null,
    "submittedAt": "2026-10-06T21:30:00.000Z",
    "updatedAt": "2026-10-06T21:30:01.000Z"
  }
}
```

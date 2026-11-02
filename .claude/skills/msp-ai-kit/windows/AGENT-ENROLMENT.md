# One-time enrolment token exchange for the DE Tech Agent

**Move 61** of the 104-move plan ([issue #779](https://github.com/digeratiexperts/digeratiexperts-site/issues/779)).
**Design only.** Nothing here is built, enabled or sent anywhere. It specifies how a device becomes a known, approved
member of the fleet, so that certificates (62), mTLS (63), rotation (64) and revocation (75) build against one exchange.
The implementation lives in `digeratiexperts/Intelligence-Hub` and needs its own pull request and Joe's explicit merge
approval there.

It answers **S1** (a rogue device enrols with a stolen token) and **R4** (enrolment is denied after the fact) of
[AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md), and it fixes the point at which the agent gets the one credential it will
use afterwards. The job queue it leads into is the move 60 design, `HUB-JOB-QUEUE.md`.

## 1. What already exists, and what this reuses

The Hub's endpoint agent (`de.endpoint/v1`, controls C2 and C18) already enrols devices: staff create a token
(`accountId`, `label`, `maxUses`, `expiresInHours`, `requireApproval`; shown once), and the device calls `enroll` with the
token, its public key and a proof of possession. Tokens are 256-bit, stored only as a SHA-256 hash, limited-use,
short-lived and revocable; the endpoint is rate-limited; and a device enrolled with an approval-required token stays
**pending** (no jobs, no results) until a technician approves it. This design keeps all of that and changes only what the
Tech Agent needs differently:

| Endpoint agent | Tech Agent, proposed | Why |
|---|---|---|
| 25 uses, 72 hours by default | **1 use, 24 hours by default**; up to 25 uses and 72 hours only when staff choose it | "One-time" is the point of S1; bulk rollouts are the exception |
| Device key is a software Ed25519 key | **ECDSA P-256, TPM-backed and non-exportable when a TPM exists** (S3, move 62) | What Windows CNG and the TPM can hold |
| Token in the request body or arguments | **Token in a header, never in a body, URL or process argument** | C15: tokens go on stdin, not argv; logs never see it |
| Credential after enrolment: the device key signs each request | **A client certificate issued by the Hub, used over mTLS** (62, 63) | Revocable per device, rotatable (64) |

## 2. The flow

```
 [staff, Hub page]          [installer on device]               [DE Tech Agent]                    [Hub]
        |                           |                                  |                             |
  1. create token  ----------------------------------------------------------------------------->    |
        |   (code shown once)       |                                  |                             |
  2. hand over code + pins (out of band: ticket, RMM secret, typed)    |                             |
        |-------------------------->|  3. install, code on stdin       |                             |
        |                           |--------------------------------->| 4. generate key (TPM if any) |
        |                           |                                  |    build CSR + facts         |
        |                           |                                  |--- POST /enroll ----------->|
        |                           |                                  |    Authorization: code       | 5. check, in order (section 4)
        |                           |                                  |<-- 201 pending | active -----|    record device, audit
        |                           |                                  |                             |
        |   6. technician checks hostname, serial, address, presses Approve (pending only)           |
        |                           |                                  |--- GET /enroll/{id} (signed)>| 7. status
        |                           |                                  |<-- certificate (move 62) ----|
        |                           |                                  | 8. store cert, forget code   |
        |                           |                                  |--- POST /jobs/lease (mTLS) ->|   (move 60)
```

Hard rules for the whole exchange: the Hub **never sends the agent a key to trust** (S2): the job-signing keys and the
Hub's TLS identity are pinned from what the installer carried, not from any response. There is **no inbound port**.
The device is `pending` until a person approves it unless an owner_admin deliberately created the token without approval.

## 3. The token

| Property | Rule |
|---|---|
| Format | `dete_` followed by 43 base64url characters: 256 bits of randomness from a CSPRNG |
| Storage | The Hub stores **only the SHA-256 hash**, never the code. It is shown once, at creation |
| Binding | To one **account**, set at creation (I2). A token cannot enrol a device into another account |
| Uses | Default **1**. Staff may allow up to 25 for a bulk rollout, with a reason. Consumed atomically on a successful enrolment |
| Life | Default **24 hours**. At most 72 hours. Expired tokens are refused and not extended |
| Approval | **Required by default** (C18). Creating a token without it needs an owner_admin and a reason |
| Revocation | Any staff member, any time. Revoking a token does not remove devices already enrolled with it |
| Delivery | Out of band to the installer (typed, a ticket field, an RMM secret). Never in a URL, a query string, an email subject or a process argument |
| On the device | Read from stdin or a secret-variable, used once, then dropped. Never written to disk, state, evidence or logs |

A staff request to create one (this is the only place the code appears in a body, and it is a Hub-to-staff response, never a
device message):

<!-- example:token-create -->
```json
{
  "request": {
    "accountId": "42",
    "label": "Alamo front desk laptop",
    "reason": "ticket 1234",
    "maxUses": 1,
    "expiresInHours": 24,
    "requireApproval": true
  },
  "response": {
    "tokenId": "7d2f6a40-0b1c-4e0e-a5de-9c1f3b7a2e11",
    "code": "dete_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "expiresAt": "2026-11-02T12:00:00Z",
    "shownOnce": true
  }
}
```

## 4. `POST /enroll`

Server-authenticated TLS only (the device has no certificate yet), pinned to the Hub identity the installer carried.
Headers: `Authorization: DE-Enrol <code>`, `X-DE-Request-Id`, `X-DE-Timestamp` (UTC, within 300 seconds) and `X-DE-Nonce`
(single-use). The body carries **no secret**:

<!-- example:enrol-request -->
```json
{
  "agentVersion": "0.1.0",
  "csr": "MIIBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "keyStorage": "tpm",
  "facts": {
    "hostname": "ALAMO-LAP-0231",
    "manufacturer": "Dell Inc.",
    "serial": "ABC123",
    "model": "Latitude 7450",
    "osBuild": "26100",
    "tpm": { "present": true, "version": "2.0" }
  },
  "catalogSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "proof": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
}
```

- `csr` is a PKCS#10 request for the device key. Its signature **is a proof of possession** of the private key.
- `proof` is a signature by that key over `DE-ENROL-v1`, the SHA-256 of the code, the SHA-256 of the CSR, the nonce and the
  timestamp, each on its own line. It binds this token, this key and this request together, so a captured request cannot be
  reused with another token or key.
- `facts` are what a technician needs to recognise the device when approving it. **No user names, no profile paths** (I5).
- `keyStorage` is `tpm` or `software`. `software` is allowed but recorded; it is the residual risk named in S3.

**The Hub checks, in this order**, and answers every failure of steps 2 to 4 with the same `token_invalid`, so the endpoint
is not an oracle for which tokens exist:

1. Rate limit and timestamp, nonce once-only (C19, C20).
2. The token's hash exists (constant-time comparison).
3. It is not revoked and not expired.
4. It has uses left; the use is taken atomically **only after step 8**.
5. The account is active and mapped (I2).
6. The CSR parses, is ECDSA P-256 (RSA 3072 only as a recorded fallback), and its signature verifies.
7. `proof` verifies against the CSR's public key.
8. The device is usable: the manufacturer and serial give a real `deviceKey` (OEM placeholder serials such as
   `To be filled by O.E.M.` are refused, the move 85 rule) and no **active** device already holds it.
   A second enrolment of the same device key is refused: revoke and re-enrol rather than patch in place.

Then the Hub records the device (`pending`, or `active` if the token needs no approval), takes the token use, writes the
audit, and answers:

<!-- example:enrol-response -->
```json
{
  "enrolmentId": "3c9b1f28-5d4e-4a7b-8f60-2e1d9a7c5b34",
  "status": "pending",
  "deviceKey": "dell:ABC123",
  "pollAfterSeconds": 60
}
```

A device enrolled without the approval requirement gets `"status": "active"` and the certificate in the same response
(move 62 fixes how it is issued). A pending device calls `GET /enroll/{enrolmentId}`, **signed with the device key** (it still
has no certificate), until the status is `active` (the response carries the certificate), `denied`, or `expired`.

## 5. Approval and revocation

- **Pending is inert (C18).** A pending device can check its own enrolment status. It receives no jobs, posts no results,
  uploads no evidence and does not feed any store check.
- **A person approves.** The Hub page shows hostname, serial, address and `keyStorage`; the technician compares them with the
  machine in front of them. The approver is recorded by name (R4). Approval can be refused with a reason.
- **Approval expires.** A pending enrolment unapproved after 7 days is `expired` and the device must enrol again with a new token.
- **Revoking a device** (move 75) revokes its certificate; it is separate from revoking a token.

## 6. Errors

Every error body is `{ "error": "<code>", "message": "<short, no values>" }`. The same status and message are used for
every token failure.

| Status | `error` | When |
|---|---|---|
| 400 | `bad_request` | Malformed body or header |
| 401 | `token_invalid` | Unknown, revoked, expired or used-up token. One answer for all four |
| 401 | `stale_request` | Timestamp outside the allowed skew, or a repeated nonce |
| 403 | `account_not_mapped` | The token's account is not active or has no Hub account mapping |
| 409 | `already_enrolled` | An active device already holds this device key |
| 422 | `csr_invalid` | The CSR does not parse or its signature fails |
| 422 | `key_type_not_allowed` | Not ECDSA P-256 or the recorded RSA fallback |
| 422 | `proof_invalid` | The proof does not verify against the CSR's key |
| 422 | `serial_unusable` | The serial gives no real device key (placeholder or empty) |
| 202 | `enrolment_pending` | A status poll for an enrolment still waiting for approval |
| 403 | `enrolment_denied` | A technician refused it |
| 410 | `enrolment_expired` | Pending for more than 7 days |
| 429 | `rate_limited` | Over the limit |

## 7. Limits and detection

- **30 enrolment attempts per 15 minutes** (the endpoint agent's number), then `429` with `Retry-After`.
- **10 failed enrolments from one address in 15 minutes** raises a rate-limited alert (C20), mailed to
  `security@digeratiexperts.com` (D8, Joe to confirm the alias).
- A refused token never reveals why, so a scan learns nothing; the audit records the reason.

## 8. Audit

Written to the append-only audit with the actor, account, token id (never the code), device, request id and a content
hash (R4, C16): token created, token revoked, token expired unused; enrolment requested, enrolment refused (with the
internal reason), device pending, device approved (with approver and what they compared), device denied, device
activated, enrolment expired.

## 9. Out of scope

How certificates are issued and what they contain (62), mTLS (63), rotation (64), the job queue (60), the device-side
store (68), install, upgrade and uninstall (72), and the revocation test (75).

## 10. Decisions this design asks for

1. **One use and 24 hours by default**, with bulk (up to 25 uses, 72 hours) only on request. The endpoint agent defaults
   to 25 and 72.
2. **ECDSA P-256** as the device key, RSA 3072 only as a recorded fallback.
3. **Approval required by default**, and a token without it only by an owner_admin with a reason.
4. **Seven days** before an unapproved enrolment expires.

# Per-device client certificates and revocation

**Move 62** of the 104-move plan ([issue #780](https://github.com/digeratiexperts/digeratiexperts-site/issues/780)).
**Design only.** Nothing here is built, enabled or sent anywhere. It specifies the one credential a DE Tech Agent holds
after enrolment, how the Hub issues it, and how it is revoked, so that mTLS (63), rotation (64), and the revocation test
(75) build against one profile. The implementation lives in `digeratiexperts/Intelligence-Hub` and needs its own pull
request and Joe's explicit merge approval there.

It answers **S3** (a device key is cloned), **I4** (a local user reads agent state or keys) and **E5** (a compromised Hub
signs or trusts the wrong thing) of [AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md). Enrolment, which ends with the first
certificate, is the move 61 design, `AGENT-ENROLMENT.md`.

## 1. The shape of it

- **One credential per device**: a client certificate whose key was generated on the device and never leaves it. The Hub
  issues from a **CSR**; it never sees the private key.
- **Identity comes from the certificate, never from a request body.** The account and the device key are in the
  certificate; a body that disagrees is refused (the job queue design calls this `device_mismatch`). Hostnames are never
  an identity.
- **The Hub checks its own table on every request.** A certificate is valid only while its serial is `active` in the Hub's
  device table. Revocation therefore takes effect on the next request, not at the next CRL refresh, and a Hub that cannot
  read the table refuses every request (fail closed).
- **The credential is separate from every other key.** The job-signing key, the de-sync HMAC secret and the release key are
  different keys with different custody (A6, A8). The certificate authority key is a fourth.

## 2. The certificate authority

| Item | Proposed |
|---|---|
| Hierarchy | An **offline root** that only signs the intermediate, and an **online intermediate** ("DE Tech Agent Device CA") that signs device certificates. The root is created and held with the same two-person ceremony and hardware keys as the job key (D3, D7) |
| Intermediate life | 2 years, then replaced; the proxy's trust bundle holds old and new during the overlap |
| Intermediate key custody | Environment file and the SOP ceremony now, a managed KMS or HSM before general availability, target Q1 2027 (D7); **never the same key as the job key** |
| Who can ask for a certificate | Only the enrolment path after approval (61) and the renewal path from a device that already holds a valid one (64). No staff action issues a certificate for a key the Hub did not receive as a CSR |

## 3. The certificate profile

Everything the Hub puts in a certificate is fixed by the profile; a CSR cannot ask for more.

<!-- example:cert-profile -->
```json
{
  "profileVersion": 1,
  "keyAlgorithm": "ECDSA-P256",
  "signatureAlgorithm": "ecdsa-with-SHA256",
  "validityDays": 90,
  "renewAfterDays": 60,
  "subject": {
    "commonName": "3c9b1f28-5d4e-4a7b-8f60-2e1d9a7c5b34",
    "organization": "Digerati Experts"
  },
  "subjectAltNameUri": "urn:de:techagent:account:42:device:dell:ABC123",
  "basicConstraintsCA": false,
  "keyUsage": ["digitalSignature"],
  "extendedKeyUsage": ["clientAuth"],
  "serial": "random-128-bit"
}
```

- **Subject**: the common name is the **enrolment id** (a UUID), not the hostname. **The URI SAN** carries the account number and
  the device key (`<maker>:<SERIAL>`), the two things every job and result is bound to (TB8, E6).
- **Key**: ECDSA P-256. Generated on the device, in the TPM through the platform crypto provider and **non-exportable** where a
  TPM exists. A software key is accepted but recorded (`keyStorage`), and is the residual risk S3 names.
- **Usage**: `clientAuth` only, `digitalSignature` only, **not a CA**. The certificate cannot sign anything a relying party
  would trust as a certificate.
- **Life**: 90 days, renewed after 60 (move 64). A short life limits what a stolen key is worth even before it is revoked.
- **Serial**: 128 random bits, recorded by the Hub.

## 4. What the Hub keeps

| Table | Holds |
|---|---|
| `techagent_devices` | Device id, account, device key, status (`pending`, `active`, `revoked`, `denied`), enrolment id, approver, last seen |
| `techagent_device_certs` | Serial, SHA-256 fingerprint, not-before, not-after, status (`active`, `superseded`, `revoked`, `expired`), device, issued for (enrolment or renewal), revoked at, revoked by, reason |

Both are account-scoped with check constraints that mirror the route rules. At most one `active` certificate per device,
except during a renewal overlap (move 64), when the older one is `active` until the new one has been proven.

## 5. Where the certificate is checked

TLS terminates at the reverse proxy, which requires and verifies the client certificate against the intermediate (move 63). It
passes the **verified fingerprint and serial** to the application in headers that it sets itself and strips from every inbound
request. The application:

1. looks the serial up in `techagent_device_certs`; unknown, `revoked`, `superseded` after the overlap, or `expired` is refused;
2. loads the device and requires its status to be `active` (a `pending` device is limited to its own enrolment status, per 61);
3. takes the account and the device key **from the certificate and its row**, and refuses a body that names another;
4. only then counts the request against the rate limit (so a forger cannot use up a real device's allowance).

If the table cannot be read, the answer is `503`, never "assume valid".

## 6. Revocation

Any staff member can revoke a device; revoking is one-way. Re-enrolment with a new token is the only way back (the threat
model: revoke and re-enrol rather than patch in place).

<!-- example:revoke -->
```json
{
  "request": {
    "reason": "device_lost",
    "note": "ticket 1234"
  },
  "response": {
    "deviceKey": "dell:ABC123",
    "status": "revoked",
    "certificatesRevoked": 1,
    "jobsCancelled": 1,
    "effectiveFrom": "2026-11-01T12:00:00Z"
  }
}
```

`reason` is one of `key_compromise`, `device_lost`, `decommissioned`, `superseded`, `enrolment_error`. What a revocation does,
in one transaction:

- marks the device `revoked` and every one of its certificates `revoked`, with the actor, time and reason;
- cancels every job that is `approved` or `leased` for the device and not yet acknowledged; an acknowledged job is left to
  finish or time out, and its result is still accepted **once**, because a revoked device that reports honestly is better than one that
  cannot (the Hub marks that result as arriving after revocation);
- writes the audit entry and, for `key_compromise` or `device_lost`, raises an alert (IR-4 and IR-5 of the Hub's runbook).

**There is no CRL or OCSP.** The Hub is the only relying party and consults its own table on every request, so a published
revocation list would be a second source of truth that could disagree. If a second relying party ever appears, it is added then.

**What the agent sees.** Its next request is answered `403 device_revoked`. It stops requesting work, keeps its local functions
(D3, move 76), keeps its queued evidence for a bounded time without uploading it, and reports the state locally. The test that
a revoked key really stops working is move 75.

## 7. Errors

Every error body is `{ "error": "<code>", "message": "<short, no values>" }`.

| Status | `error` | When |
|---|---|---|
| 401 | `no_client_certificate` | No valid certificate was presented |
| 403 | `certificate_unknown` | The serial is not in the Hub's table |
| 403 | `certificate_expired` | The certificate is past its end |
| 403 | `device_revoked` | The device or its certificate was revoked |
| 403 | `device_not_active` | The device is pending or denied |
| 403 | `device_mismatch` | The body names a device or account other than the certificate's |
| 503 | `identity_store_unavailable` | The Hub could not read its table: nothing is accepted |

## 8. Audit

Appended with the actor, account, device, certificate serial and fingerprint (never a key): certificate requested, issued, renewed,
superseded, expired unused, revoked (with reason and actor), request refused (with the refusal code), and the CA's own events
(intermediate created, rotated, retired).

## 9. Out of scope

mTLS configuration and the proxy (63), renewal and CA rotation mechanics (64), the revocation test (75), the enrolment
exchange (61), the job queue (60), and the agent's local key storage (68).

## 10. Decisions this design asks for

1. **Run our own two-tier CA** (offline root, online intermediate) rather than buy certificates or use a managed private CA.
2. **90-day certificates, renewed after 60.** Shorter is safer and costs more renewals; move 77 and real runs will say what the fleet can bear.
3. **No CRL or OCSP**, because the Hub checks its own table on every request.
4. **The CA key never shares custody with the job key.** The same two-person ceremony applies to both.

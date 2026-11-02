# Rotation: device certificates, the CA, the Hub's pinned key, and the job-signing key

**Move 64** of the 104-move plan ([issue #782](https://github.com/digeratiexperts/digeratiexperts-site/issues/782)).
**Design only.** Nothing here is built, enabled or sent anywhere. It specifies how each long-lived key in the agent's
trust chain is replaced **without a day when the fleet is locked out or a key nobody can retire**, so that the service (68),
heartbeat (69) and upgrade (72) build against one procedure. The Hub work lives in `digeratiexperts/Intelligence-Hub` and
needs its own pull request and Joe's explicit merge approval there.

It answers **S3** (a device key is cloned) and **E5** (a compromised Hub signs jobs) of
[AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md). Four different keys are rotated, with four different procedures, because
the order that is safe differs for each.

| Key | Held by | Rotated how | Section |
|---|---|---|---|
| Device client certificate | The device (TPM-backed) | The device renews itself, with a new key, over mTLS | 1 |
| The device intermediate CA | The Hub | Overlapping trust bundles; no device action | 2 |
| The Hub's pinned server key | The Hub; pins on every device | A backup pin shipped first, then the Hub switches | 3 |
| The job-signing key | The Hub (tier-0); key ids pinned on every device | A successor key id pinned first, then the Hub signs with it | 4 |

**Compromise is not rotation.** A key that may be in someone else's hands is **revoked and replaced by re-enrolment**, never renewed
in place (the threat model's rule): a device certificate by revocation and a new enrolment token, a job key by the Hub's incident
procedure (pause everything, then rotate, then review every delivered job by payload hash).

## 1. Device certificate renewal

Certificates live 90 days and are renewed after 60 (the device certificate design). Renewal is the only thing a certificate can do
for itself, and it can only be done by a device that **still holds a valid one**.

<!-- example:rotation-policy -->
```json
{
  "validityDays": 90,
  "renewAfterDays": 60,
  "renewJitterDays": 3,
  "staleAlertDaysLeft": 14,
  "minHoursBetweenRenewals": 24,
  "overlapMinutes": 10,
  "newKeyEveryRenewal": true
}
```

1. **When.** The agent starts renewing when 60 days (plus or minus up to 3, so a fleet does not renew together) have passed since
   `notBefore`, only after the time check passes. A device whose clock is wrong is told to renew by the Hub (`renewNow`, in the
   heartbeat and lease responses), so a clock set back cannot postpone renewal.
2. **A new key every time.** The agent generates a **new** key (TPM-backed where it has one) and sends a CSR. Reusing the old key is
   refused (`key_reused`): a stolen key must not survive a renewal.
3. **Over mTLS with the current certificate.** That already proves the device is the enrolled one; the CSR signature proves
   possession of the new key. No enrolment token is involved.

<!-- example:renew-request -->
```json
{
  "csr": "MIIBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "keyStorage": "tpm",
  "currentSerial": "0123456789abcdef0123456789abcdef",
  "agentVersion": "0.1.0"
}
```

4. **The Hub issues the new certificate and keeps the old one active for the overlap**, then waits for the device to prove the
   new one works.

<!-- example:renew-response -->
```json
{
  "status": "issued",
  "newSerial": "fedcba9876543210fedcba9876543210",
  "notAfter": "2027-01-30T12:00:00Z",
  "previousSerial": "0123456789abcdef0123456789abcdef",
  "previousStatus": "active",
  "confirmWithinMinutes": 10
}
```

5. **The device confirms.** It installs the new certificate, opens a connection **with the new one** and calls the identity
   check. Only then does the Hub mark the new serial `confirmed` and the old one `superseded`; only then does the agent
   switch and delete the old key. If confirmation does not arrive within the overlap, the Hub keeps the old certificate
   active, the new serial is revoked as `enrolment_error`, and the agent tries again after a back-off. **The agent never
   deletes its working key until the new one has worked.**
6. **Limits.** At most one renewal per device per 24 hours; more is `renew_too_soon` and a rate-limited alert (a device that
   keeps asking is behaving oddly). Renewal is refused for a revoked, pending or denied device. A job pause (the kill switch)
   does **not** stop renewal: pausing work must not make the fleet's identities lapse.
7. **No grace after expiry.** An expired certificate cannot complete the handshake, so the device must **re-enrol** with a new
   token. To keep that rare, the heartbeat carries `certDaysLeft`, and the Hub alerts staff for any device with 14 days or fewer
   left that has not renewed.

## 2. The device intermediate CA

- A **new intermediate is created six months before the old one expires**, signed by the offline root with the same two-person
  ceremony as every tier-0 key (D7).
- The proxy's trust bundle holds **old and new** from then on. New device certificates are signed by the new one; **existing
  certificates stay valid until their own end**, so no device is touched.
- The old intermediate is retired from the bundle only when **no `active` certificate chains to it**.
- Devices pin the Hub's server key (next section), not the CA, so the agent never notices this rotation.

## 3. The Hub's pinned server key

Each agent pins **two** server public keys: the current one and an offline backup (the mTLS design). Replacing the current key
therefore has a fixed order, and **the Hub switches last**:

1. Generate the next backup key offline.
2. Ship an agent profile whose pins are the **current backup and the new backup** through a **signed upgrade** (move 72, the
   release key), never through a job or any response.
3. Wait until the fleet has taken it. The heartbeat reports the pinned-key set it holds; proceed only when **at least 99 percent of
   active devices** report the new set, and decide deliberately about the rest (they re-enrol or are upgraded by hand).
4. Switch the Hub's TLS key to the former backup.
5. Retire the old key.

Going out of order, by switching before the fleet holds the backup, locks out every device that has not upgraded. That is why step 3 is a
gate and not advice.

## 4. The job-signing key

Jobs carry a `keyId`; each agent pins a **set** of job key ids at build or enrolment (the Hub can never add one). The order matches the
server key, and the Hub again acts last:

1. Create the successor key in the two-person ceremony (the SOP) and record its id; never paste a key into chat, tickets or AI tools.
2. Ship the successor's public key id **in the next signed agent upgrade**, alongside the current one.
3. The heartbeat reports the pinned job key ids; the Hub signs with the successor only when the fleet holds it.
4. **Removing** a key is the same path: a signed upgrade drops it. A job or response can never remove a pin.
5. Rotation is yearly, on departure of anyone who held the key, and on suspicion; on suspicion the Hub's incident procedure
   (pause everything, rotate, review every delivered job by payload hash) comes first and this procedure second.

## 5. What a device does when a rotation goes wrong

| Situation | The agent | The Hub |
|---|---|---|
| Renewal fails (network, refusal) | Keeps its working certificate, retries with back-off, reports `certDaysLeft` | Alerts at 14 days left |
| New certificate does not confirm | Keeps the old key and certificate; tries again | Revokes the unconfirmed serial; keeps the old one active |
| Certificate already expired | Cannot connect; shows the state locally; local functions keep working | Staff issue a new enrolment token |
| Pins on the device do not include the Hub's new key | Refuses the connection (no trusted party to tell) | Sees no request from that device; the gate in section 3 should have stopped this |
| A job is signed by a key id the device does not pin | Refuses the job, reports the refusal (`unknown_key`) as a security event | Alerts: this is either a bad rotation or a forged job |

## 6. Errors

Every error body is `{ "error": "<code>", "message": "<short, no values>" }`.

| Status | `error` | When |
|---|---|---|
| 403 | `device_revoked` | The device or its certificate was revoked |
| 403 | `device_not_active` | The device is pending or denied |
| 403 | `certificate_expired` | The certificate ran out: re-enrol |
| 409 | `renew_too_soon` | A renewal within 24 hours of the last one |
| 422 | `csr_invalid` | The CSR does not parse or its signature fails |
| 422 | `key_reused` | The CSR carries the public key of the current certificate |
| 422 | `key_type_not_allowed` | Not ECDSA P-256 or the recorded RSA fallback |

## 7. Out of scope

How certificates are issued the first time (the enrolment and certificate designs), revocation (the certificate design and
the move 75 test), the signed upgrade itself (72, 99), and the service's key storage (68).

## 8. Decisions this design asks for

1. **A new key on every renewal**, not only a new certificate for the same key.
2. **No grace after expiry**: an expired device re-enrols. The alternative, a grace window, is a window in which an expired credential
   still works.
3. **The kill switch does not stop renewal.**
4. **A 99 percent gate** before the Hub switches its server or job key, and the 14-day staleness alert.

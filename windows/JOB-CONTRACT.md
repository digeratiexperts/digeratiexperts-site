# The `de.techconsole.job/v1` contract

**Move 59** of the 104-move plan ([issue #777](https://github.com/digeratiexperts/digeratiexperts-site/issues/777)).
This is the envelope the DE Tech Agent will obey as SYSTEM, so it is sealed, short-lived, bound to one account and one
device, and refused unless its job kind allows every action it names. It answers threats T1, T6 and E1 of
[AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md) and follows that document's section 7.

**Status:** the contract and its device validators are final for v1. **No job kind is enabled**: every kind in
`console/catalog/job-kinds.json` ships `"enabled": false` and technician-confirmed (D2). A pull request that enables one
cites the threat model and shows that kind's checklist rows met (§13 there).

Files: [`console/contracts/job.schema.json`](console/contracts/job.schema.json) (the shape),
[`console/catalog/job-kinds.json`](console/catalog/job-kinds.json) (the per-kind allowlist and rules),
`console/modules/DE.Contracts` (the validators), `console/tests/JobContract.Tests.ps1` (the pins).

## The envelope

Every field below is part of the signed input. Anything not listed is refused (`$.name: not a field of
de.techconsole.job/v1`), so nothing can ride along unsigned.

| Field | Required | Shape | Why it is sealed |
|---|---|---|---|
| `schema` | yes | exactly `de.techconsole.job/v1` | versioning |
| `jobId` | yes | lowercase UUID | audit, idempotency (moves 60, 70) |
| `kind` | yes | `provision` `takeover` `rescue` `audit` `deprovision` `maintenance` | selects the allowlist |
| `accountId` | yes | the Hub account number, a positive whole number as a string | tenant binding (TB8, I2) |
| `deviceKey` | yes | `<maker>:<SERIAL>` | device binding (E6) |
| `issuedAt`, `expiresAt` | yes | UTC, `yyyy-MM-ddTHH:mm:ssZ` (up to three fraction digits) | the window |
| `nonce` | yes | 22-86 characters of base64url | the replay store (move 66) |
| `catalogSha256` | yes | 64 lowercase hex | pins the signed local catalog and so each action's version (move 67) |
| `actions` | yes | action ids from the catalog, no duplicates, at most 50 | the work |
| `issuedBy` | yes | who ordered it | attribution (R1) |
| `reason` | yes | a reason or ticket | attribution (R1) |
| `keyId` | yes | which pinned signing key signed it | rotation (move 64) |
| `signature` | yes | Ed25519, base64url, 86 characters | the seal |
| `params` | no | `{ "<action id>": { "<name>": <value> } }`, one level deep | typed parameters (T6) |
| `approvals` | no | approver identities | the second approver (D5) |
| `profileSha256` | no | 64 lowercase hex | pins the client profile |
| `client`, `orderId`, `mode` | no | labels | context only: never a binding |

**Parameters are data.** Keys must be an action in the same job; names match `[A-Za-z][A-Za-z0-9_]{0,63}`; values are
a string (at most 256 characters, no control characters), a number, a boolean or null. The engine passes them as
structured values and never splices them into command text. **No secrets:** secret-shaped keys and BitLocker
recovery-password-shaped values are refused by the contract itself (move 23).

## The window

A job lives at most **900 seconds** (15 minutes, the Hub's C4 rule). `issuedAt` may be at most **300 seconds** in the
device's future (clock skew); `expiresAt` is strict, with no grace after it. Section 7's monotonic "latest time seen"
floor, which stops clock-setback attacks, belongs to signature verification (move 65).

## The signature

The Ed25519 signature covers the UTF-8 bytes of the **signing input**: the canonical JSON of the envelope with
`signature` removed and **the keys of every object in ordinal (code-point) order**. `Get-DEJobSigningInput` builds it.
The sort is part of the contract because the canonical JSON writer keeps insertion order, as `JSON.stringify` does, and
a signature must not depend on how a sender ordered its keys. The Hub signs the same bytes; the cross-language vector
that proves it is part of move 65. Keys are the pinned ones only (S2): a key the server sends is never trusted.

This move defines the input and checks everything that does not need the key. **Signature verification is move 65.**

## The device validators

| Function | What it answers |
|---|---|
| `Test-DEJobEnvelope` | Is this envelope acceptable to go on to signature and catalog checks? Returns the list of problems; empty means yes. |
| `Get-DEJobActionDecision` | May a job of this kind run this action, may it only read it, and is it hands-on only? |
| `Get-DEJobKindPolicy` | Loads `job-kinds.json`. |
| `Get-DEJobSigningInput` | The text whose UTF-8 bytes the signature covers. |

`Test-DEJobEnvelope` checks, in this order, and stops after the first group that fails (a field that failed the contract
cannot be trusted by a later check):

1. the contract: required fields, patterns, secrets, and no unknown field;
2. **this device and this account**: `deviceKey` and `accountId` must equal the device's own. `client` is never used;
3. the window: real UTC times, `expiresAt` after `issuedAt`, at most 900 seconds, not expired, not too far in the future;
4. the kind: it exists, and it is **enabled** (none is today);
5. the actions: not empty, no duplicates, at most 50, each allowed for the kind;
6. **hands-on only (D5)**: a destructive action is refused as a job while DE has one person; with a second approver it needs
   an `approvals` entry that is not `issuedBy`;
7. the kind's **order rules**: tiers never run backwards, `apps.m365.readiness` runs last, and a prerequisite comes earlier in
   the *same* job (leaving Entra needs the BitLocker backup and the migration check, deprovision needs data verified preserved);
8. parameters, as above.

## The two keys

A job runs an action only if both keys accept it (threat model §7). **Key one is this contract's allowlist**:
`job-kinds.json`, where each kind lists `enable`, `deny` (always wins), `detectOnly`, `applyAllowed` (an `audit` job
applies nothing, E3), `handsOnOnly`, `orderTiers`, `last` and `requires`, plus a `globalDeny` list (no job removes a
security component) and the window and limits. Anything not enabled is refused. **Key two is the signed local catalog**
(move 67): the action id and version must exist in the catalog `catalogSha256` pins.

The policy is held to the real action registry by `JobContract.Tests.ps1`: every registered action id must fit the
schema, every registered family must be a known family, every registered destructive action must be hands-on only
wherever a job could apply it, and an audit job must be able to apply nothing. A new action family is added to
`job-kinds.json` in the same pull request that registers it (threat model §13).

## What the contract does not do

- It does not verify the signature, check the nonce store or consult the catalog (moves 65, 66, 67).
- It does not enable any job type, run any action, or add a network call.
- It does not define the Hub's queue endpoints (move 60) or enrolment (move 61).

## Found while finalising it

- The `actions` pattern in the shipped schema only allowed lowercase after the first dot, but the registry holds ids with
  capitals (`jumpcloud.usergroup.Alamo---Users`); such a job could never have been sent. The pattern now allows
  `[A-Za-z0-9-]` after the first segment, and a test holds every registered id to it.
- `issuedBy`, `catalogSha256` and `signature` were optional and nullable in the shipped schema; a job with no signature was a valid
  envelope. All are required now.

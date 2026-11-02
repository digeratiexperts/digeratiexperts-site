# PHI-restricted mode

[Issue #890](https://github.com/digeratiexperts/digeratiexperts-site/issues/890). Decided by Joe,
2026-11-01. What the tool does differently on a device that is, or may be, handling protected health
information. The code is `console/modules/DE.Phi/DE.Phi.psm1`; **if this document and the code
disagree, the code is right and this is stale.**

Three controls, shipped in three parts:

| Part | Control | State |
|---|---|---|
| 1 | The decision, and nothing sent to a vendor without a confirmed BAA | merged (#898) |
| 2 | Discovery reads system metadata only | this document's PR |
| 3 | Evidence encrypted at rest | design: [PHI-ENCRYPTION-AT-REST.md](PHI-ENCRYPTION-AT-REST.md) |

## The decision

| Question | Answer |
|---|---|
| Is a device restricted? | When its **client account's vertical in the Hub profile is healthcare**. Every device that account owns. |
| Can a device opt out? | **No.** A per-device override can only make a device *more* restrictive. An attempt to unrestrict is refused and logged. |
| What if the vertical is unknown, or the Hub cannot be reached? | **Restricted.** Fail closed. |

The Hub also returns whether it marks the account PHI-restricted, because a healthcare deal restricts
an account whatever its vertical field says. The tool honours that: the **only** way a device ends up
unrestricted is the Hub answering, the vertical being known and not healthcare, the Hub saying
`phiRestricted: false`, and no override asking for more. A missing, blank or oddly shaped answer is
not a "no".

### How the tool asks

`GET /api/techtool/account/:accountId/profile`, **signed** exactly like the event intake: the
`X-DE-Signature` header over method, path, timestamp, event id and body (`{}` for a GET), using the
runtime secret `DE_HUB_SIGNING_SECRET`. No signing secret, no Hub endpoint, no numeric account id, a
refusal, a timeout or a malformed answer all mean "unknown", which means restricted.

A good answer is cached for 24 hours. A failure is remembered for 5 minutes so an offline Hub costs one
short wait (5-second timeout), not one per call. A stale good answer is kept in preference to none.

### Where it is settled

At each production entry point once the client is known: the headless run, the window (each time the
profile is set), and a background job, which has its own runspace and does not share the window's
state. **Until a client is known the session is undecided, and undecided reads as restricted.** In the
window the first discovery runs before the client is detected, so it is the restricted one.

The decision, with its reason, is written to the evidence bundle as the `phi.decision` step.

## What restricted discovery does

Discovery never looks **inside a user's data folders**. The one place it used to - counting files and
adding up sizes under a user's OneDrive - is now a single function, `Get-DEFolderSample`, which a
restricted device refuses before touching the folder: no document name, count, size or date is read.

`classification` then says `configured-data-not-inspected` rather than guessing `configured-little-data`.
"Not looked at" is never reported as "looked and found little". The migration gate does not rely on
the file count: it already requires a technician to confirm the sync whenever a business OneDrive
exists, so a restricted device is **not** treated as safer to migrate.

A test fails if a recursive walk is added anywhere else in discovery, so the restriction cannot be
bypassed by a new probe.

### What restricted discovery still reads, on purpose

| Still read | Why |
|---|---|
| Account names, SIDs, profile folder paths | Client detection matches profile folder names, and the migration gate finds the user's OneDrive folder from the profile path. These are facts about how the OS is configured, not documents. |
| OneDrive account email and tenant | The identity gate compares them to the expected UPN. |
| The sync-folder path | A path, not a listing of it. |

These are **personal** and **path** class under [EVIDENCE-DATA-CLASSIFICATION.md](EVIDENCE-DATA-CLASSIFICATION.md):
they stay on the device (moves 91 and 92 keep them off the Hub and client reports), and part 3
encrypts them at rest. If a stricter reading is wanted - withholding these too on a restricted
device - it breaks client detection and the OneDrive gate unless each is given a replacement, so it
needs a decision rather than a default.

## The vendor gate

`console/catalog/vendor-baa.json` is the register. **Every row starts `unconfirmed`**, and a blank,
missing or unrecognised row is **blocked**, not allowed. Confirmations are Joe's to record; nothing
else writes that file. The gate is wired into the two places device data leaves for a vendor:
`Invoke-DEWarrantyWeb` (a serial to Dell, Lenovo or HP) and `Invoke-DEJumpCloudApi` (device identity and
BitLocker escrow). What each vendor receives is in [VENDOR-BAA-STATUS.md](VENDOR-BAA-STATUS.md).

On a device that is not restricted the register is recorded, not enforced.

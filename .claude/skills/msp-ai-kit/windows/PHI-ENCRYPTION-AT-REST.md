# PHI encryption at rest: design

Part 3 of [issue #890](https://github.com/digeratiexperts/digeratiexperts-site/issues/890) (PHI-restricted
mode). **Design only - no code in this PR.** The implementation follows in the PRs listed under
[Build order](#build-order), after this is agreed.

Builds on, and does not contradict, [ENCRYPTION-AT-REST.md](ENCRYPTION-AT-REST.md) (move 95, the
assessment that found nothing is encrypted) and its recommendation 4: **do not roll your own
encryption.** Parts 1 and 2 of #890 (the fail-closed decision, the BAA gate, metadata-only discovery)
are separate PRs.

## What Joe decided (2026-11-01)

1. Encryption at rest covers **all retained raw evidence for its full 13-month window**, and **audit
   logs and compliance reports for their full 6 years**.
2. **Key rotation must not leave old evidence unreadable or unencrypted.**
3. **No hand-rolled crypto.** Use OS and platform primitives: DPAPI, and a BitLocker-protected store.

Everything below is a consequence of those three lines.

## The short version

Two layers, both provided by Windows, neither containing a key the tool generates or stores:

| Layer | Primitive | Stops | Does not stop |
|---|---|---|---|
| **1. Volume** | BitLocker on the OS volume | a powered-off machine that is stolen or imaged | anything on a running, unlocked machine |
| **2. File** | DPAPI, `LocalMachine` scope, one sealed file per evidence file | the evidence folder being copied off (backup, share, a technician's USB, another volume); a file read by something that cannot call DPAPI on that machine | an administrator, or any process that can run code on that machine as an account DPAPI will serve |
| (existing) ACL | SYSTEM and Administrators only | other unprivileged users on the machine | an administrator (accepted, gap 4 of move 95) |

Layer 2 is mandatory on a PHI-restricted device. Layer 1 is checked and reported, and what happens
when it is absent is [a decision for Joe](#decisions-for-joe).

The tool never holds a key. DPAPI holds it, in the OS, and rotates it. That is why "rotation never
strands old evidence" can be a property of the design and not something we have to get right ourselves.

## What gets encrypted

Taken from `Get-DERetentionPolicy` (move 93), so encryption and retention name the same files.

| Class | Files | Retention | Encrypted | Sealed when |
|---|---|---|---|---|
| **raw** | `evidence.json`, `snapshot.json`, `asset.json`, `gaps.json`, `console.log`, `manifest.sha256` | 13 months | **yes** | the run that wrote it finishes |
| **report** | `report-internal.*`, `report-client.*` | 6 years | **yes** | written |
| **auditlog** | `techconsole-*.log` | 6 years | **yes** | the log rotates or the session ends |
| **unknown** | anything not in the table | kept, never deleted | **yes, on a PHI device** | with its folder |
| `state\` | per-machine state | n/a | **yes, on a PHI device** | written |
| `profiles\`, `packages\` | client configuration; staged installers | n/a | **no** | not device data; vendor binaries carry no PHI |

Also covered, because they are copies of the same data under other names: `hub-payload-*.json` (saved
for manual upload), diagnostic bundles, and the evidence `.zip`.

### The live log is the one plaintext exposure

A log that is being appended to cannot be sealed as one DPAPI blob. The current session's log is
plaintext until it rotates or the session ends; every closed log is sealed. The exposure is bounded to
one running session, the content is already redacted (`Protect-DEText` runs on every line), and on a
PHI-restricted device discovery is metadata-only (part 2), so there is no PHI in it to expose. This is
residual risk 3 below and a decision for Joe if he wants it closed.

## Why DPAPI, and what was rejected

| Option | Verdict | Why |
|---|---|---|
| **DPAPI `LocalMachine`** (`ProtectedData`, .NET Framework, available in Windows PowerShell 5.1 via `System.Security`) | **chosen** | No key for us to generate, store or lose. Works for every account the tool runs as (technician, SYSTEM, a later technician on the same device) because the scope is the machine. OS-managed key rotation. Nothing to deploy. |
| DPAPI `CurrentUser` | rejected | Evidence would be readable only by the account that wrote it. The tool runs as different technicians and as SYSTEM; the next session could not read the last one's evidence. That is *exactly* the stranding Joe ruled out. |
| `EnvelopedCms` / `Protect-CmsMessage` with a machine certificate | kept as the fallback | Platform primitive, and the recipient identifier in the format is a natural key id. But it adds a certificate lifecycle (issue, protect the private key, renew, retire) that DPAPI gives for free. Revisit only if DPAPI fails the spike below. |
| EFS | rejected | Ties to a user certificate; same stranding as `CurrentUser`; not available on every SKU. |
| A BitLocker-protected VHDX mounted by the tool | rejected for now | Real protection, but mount/unmount lifecycle, drive-letter and crash handling are a new failure surface. Revisit if Joe wants a store that is encrypted independently of the OS volume. |
| AES with a key the tool manages | **rejected** | The one Joe ruled out, and move 95's "worse than nothing" case. The first question it raises - where does the key live - has no good answer on a device the tool does not own. |

### What `LocalMachine` DPAPI does and does not give

It is honest to say what this layer is *not*. `LocalMachine` means **any account on that machine can
unprotect the blob**. The protection is that the blob is useless *off* that machine's OS install, and
that reading it requires running code on the machine. It does not stop an administrator, and it does
not stop an offline attacker who has the whole disk and no BitLocker (the DPAPI machine keys live on
the same volume). That is precisely why layer 1 exists, and why the combination is the control - not
either half alone.

## The format

One sealed file per source file, same directory, with a small header so the format can change later
without stranding anything.

```
<name>.dett  =  magic "DETT" | format version (1 byte) | scheme (1 byte) | purpose id (1 byte) | DPAPI blob
```

- **format version** and **scheme** are what make future change safe. Today: version 1, scheme 1
  (DPAPI `LocalMachine`). A reader dispatches on them; a scheme is removed from the reader only after
  [the inventory](#rotation-the-three-things-that-can-change) proves no file uses it.
- **purpose id** selects the DPAPI `optionalEntropy` (a fixed per-purpose constant: evidence, report,
  log, state). It is domain separation, **not secrecy** - the constants are in the source. It stops one
  class of file being unprotected as another by accident; it does not stop an attacker, and is not
  described as if it did.
- The header carries no key and no plaintext metadata beyond those three bytes. File name and size are
  visible, as they are for any encrypted file.

The suffix and the header are *our* container around the OS's blob. There is no cipher, no IV, no key
derivation and no MAC for us to get wrong - DPAPI's blob is self-describing, integrity-protected and
names the master key it used.

### Two things sealing must not break

Both come straight from the retention code (move 93) and are easy to miss.

**1. The sweep classifies by file name.** `Get-DERetentionClass` matches `evidence.json`,
`techconsole-*.log` and so on. A `.dett` suffix makes every sealed file `unknown` - which the sweep
*never deletes* - so every encrypted file would be kept forever, past its window. The classifier must
strip the sealed suffix before matching, with a test that a sealed `evidence.json` past 13 months is
still deleted and a sealed `report-client.pdf` at 5 years is still kept.

**2. The sweep ages files by `LastWriteTime`.** Re-sealing writes a new file, which would reset the
retention clock - so a re-protect sweep would quietly extend every file's life. Every seal and every
re-protect must set the new file's `LastWriteTime` (and creation time) to the original's. Tested the
same way: re-protect a file dated 14 months ago and confirm the next sweep still deletes it.

## Rotation: the three things that can change

"Key rotation" is three different events, and the design has to hold for each.

| What changes | Who does it | Why old evidence stays readable |
|---|---|---|
| **A. The OS rotates its DPAPI master key** | Windows, periodically | Each DPAPI blob records which master key protected it, and Windows keeps the old master keys so existing blobs still open. New writes use the new key. We do nothing, and *cannot* strand anything by doing nothing. |
| **B. A BitLocker protector is added, changed or removed** | the tool or a technician | Protectors wrap the volume master key; changing one does not re-encrypt the volume or touch any file. The rule is operational: **add the new protector, confirm, then remove the old one** - never the reverse. Whether the tool's existing BitLocker actions follow that order has not been checked; 3e checks it and fixes it if not. |
| **C. We change scheme or version, or deliberately re-protect** (suspected compromise, a new scheme, a format fix) | the tool, on a Joe-gated command | The re-protect procedure below. A new scheme is *added* to the reader before anything is written with it; the old one is removed only when the inventory says nothing uses it. |

Event A is the one that decides whether the design holds, and it rests on a documented DPAPI property
that this document asserts but **does not prove**. Step 0 of the build proves it on a real device
(see [Verification](#verification)); if it fails there, the design changes before any code is written.

### The re-protect procedure

Used for event C, and for the one-time sealing of evidence that already exists as plaintext. Seven
invariants, and a test for each:

1. **Never plaintext to disk.** Unprotect into memory; write only ciphertext. There is no temporary
   decrypted file at any point.
2. **Write the new file beside the old one**, same directory, a temporary name.
3. **Verify before replacing.** Unprotect the new file in memory and compare its SHA-256 to the
   original plaintext's. A mismatch aborts and leaves the old file untouched.
4. **Preserve `LastWriteTime` and creation time** (the retention clock).
5. **Replace atomically** (`[IO.File]::Replace`), so there is never a moment with neither file.
6. **Old is removed only after step 3 passed.** A crash anywhere leaves the old file, or the new one -
   never neither, and never an unprotected copy.
7. **Idempotent and resumable.** A leftover temporary file is detected and cleaned on the next start; a
   file already at the current version is skipped. Running it twice is the same as running it once.

For plaintext that existed before sealing, step 5 replaces the plaintext file with the sealed one. On an
SSD the freed plaintext blocks are not guaranteed to be wiped by the file system; that remanence is what
layer 1 (BitLocker) covers, and is why layer 1 is not optional in spirit. We do not claim secure deletion.

### Retiring a scheme or key is a separate, gated act

Nothing is retired as a side effect of anything else.

- **`Get-DEProtectionInventory`** reports, per folder, the count of files by format version and scheme,
  plus any file that **fails to unprotect**.
- A scheme leaves the reader only when that count is zero, and only by a deliberate commit that Joe
  approves. Zero is read from the inventory, not assumed.
- A file that **will not unprotect** is never silently skipped, retried forever, or deleted early. It
  is listed as `unreadable` in readiness, loudly, with its path and age. It is still deleted by the
  retention sweep when it passes its window, because the sweep works on name and age, not content.

## What reads encrypted evidence

Encryption that nothing can read is the stranding Joe ruled out, so the read path is part of the design,
not an afterthought.

| Reader | Behaviour |
|---|---|
| Report generation, readiness, the next run | read through one function, `Read-DESealedFile`, which unprotects in memory and returns the content. No caller opens a sealed file directly. |
| `Invoke-DERetentionSweep` | name and age only; never decrypts (see the two breakages above). |
| Evidence bundle and diagnostic export | the **one deliberate decryption point**: a bundle leaving the machine is, by definition, going to be read. It is written decrypted, to the place the technician chose, and **an audit line records who exported what** (Hub G4's evidence-read audit, move 94, is the matching Hub side). |
| `manifest.sha256` | hashes the **plaintext** content, itself sealed. Verification reads through `Read-DESealedFile`. A manifest over ciphertext would break the moment a file is re-protected. |

## Failure behaviour

Fail closed, and say so:

| Situation | Behaviour |
|---|---|
| DPAPI call fails on **write** | the evidence file is **not written as plaintext**. The step records a FAIL naming the file, and the run's readiness reflects it. Never a silent downgrade to plaintext - that is the same shape as the move 95 gap 2 finding (ACL fails open), and this design does not repeat it. |
| Seal succeeds, verification fails | the plaintext is kept, the sealed copy is discarded, and the failure is loud. No file is ever left in neither form. |
| Unprotect fails on **read** | reported as `unreadable` (above); the caller gets a clear error, not an empty result. |
| Session undecided (no PHI decision yet) | restricted, as everywhere else in #890, so sealing applies. |
| Not a PHI-restricted device | unchanged from today. Part 3 does not change non-PHI behaviour. |

## Build order

Each is its own PR against `main`, in this order. 3a is a spike and gates the rest.

| # | PR | Adds |
|---|---|---|
| **3a** | DPAPI spike and provider seam | `Protect-DEBytes` / `Unprotect-DEBytes` behind a provider interface (so tests can substitute a fake scheme); the container header; the **device proof** of event A below; roundtrip, wrong-purpose, corrupt-blob and truncated-file tests |
| **3b** | Write path | evidence, reports, `hub-payload-*`, state and closed logs sealed on a PHI-restricted device; write failure fails closed; one write function |
| **3c** | Read path and retention | `Read-DESealedFile`; `Get-DERetentionClass` strips the sealed suffix; mtime preserved; the two retention tests above |
| **3d** | Seal existing, re-protect, inventory | the seven-invariant procedure; `Get-DEProtectionInventory`; the readiness finding for `unreadable` |
| **3e** | BitLocker readiness | layer 1 reported in the evidence bundle and readiness (`dpapi+bitlocker` or `dpapi-only`); the outcome of decision 1 below |

## Verification

CI runs on `windows-latest`, so DPAPI roundtrips genuinely run there. What CI **cannot** do is advance
the OS master key, so rotation is covered two ways, and the gap between them is stated.

**In CI**

- Provider seam: a fake scheme 0 and the real scheme 1; seal a file under 0, add 1 to the reader, write
  new files under 1, confirm **both read**; re-protect 0 to 1, confirm content, mtime and class survive;
  confirm the inventory counts move from 0 to 1 and reach zero only when the last file is converted.
- Each of the seven re-protect invariants, including a **simulated crash** after step 2 and after step 3,
  asserting the old file is intact and no plaintext file exists.
- The two retention tests (suffix, mtime).
- A write failure produces no plaintext file.
- A guard test that no code path writes to `evidence\` without going through the one write function,
  in the style of the existing structural guard for the discovery walk.

**On a real device** (marked **[Joe]**: hardware, so an agent does not do it)

- **Step 0, before 3a merges:** seal a file, then advance the machine's DPAPI master key and confirm
  the old file still opens. If Windows cannot be made to rotate on demand, the evidence is the master
  key store showing more than one key and a blob created under the older one still opening. This is the
  claim the whole design leans on; it is proved, not cited.
- Image the volume with BitLocker off and confirm what an offline reader sees of a sealed file versus a
  plaintext one - which also demonstrates *why* layer 1 is not optional.

## Residual risks, stated plainly

1. **An administrator, or code running as one, reads everything.** DPAPI machine scope serves any
   account on the machine. Accepted in move 95 (gap 4) and unchanged.
2. **Offline attacker with the whole disk and no BitLocker** can recover DPAPI machine keys. Layer 1 is
   the answer, which is why its absence is reported and why decision 1 below exists.
3. **The live log is plaintext for the length of one session** (see above).
4. **A reimaged or replaced OS install cannot read old sealed files** - by design, the same property that
   makes a copied folder useless. The mitigation is that the Hub holds the sanitised device record
   (move 92), and that the sealed folder is not something to rely on across a reimage.
5. **SSD remanence** of pre-sealing plaintext (above). Covered by BitLocker, not by us.

## Decisions for Joe

Both have a recommended default; the doc is written so it can proceed on the default.

**1. A PHI-restricted device with no BitLocker on the OS volume.** Layer 2 still applies, but it does
not stop offline imaging.

| Option | Effect |
|---|---|
| **Block Apply runs and report it (recommended)** | The tool refuses to make changes on a PHI device whose volume is unprotected, names the fix, and an audit run still works. Consistent with fail-closed everywhere else in #890. |
| Warn, record `dpapi-only` in the evidence, continue | Never blocks work; relies on someone reading the warning. |
| Block everything including audits | Strictest; also stops the audit that would tell you BitLocker is off. |

**2. The live log.**

| Option | Effect |
|---|---|
| **Accept the one-session plaintext window (recommended)** | Redacted content, metadata-only discovery, one session. No new mechanism. |
| Seal the log per record | Closes the window; the log becomes a sequence of sealed records, which costs readability and a new read path for what is currently `Get-Content`. |

## How this fits the rest of section H

| Move | Relationship |
|---|---|
| 91 / 92 | what the Hub may receive. This is what the *device* may keep. The two compose: personal fields stay in local evidence (move 92 says so on purpose), so local evidence is exactly what needs protecting. |
| 93 | retention periods. Sealing must not change when files expire - the two retention tests exist for that. |
| 94 | Hub-side evidence-read audit. The export decryption point above is its on-device counterpart. |
| 95 | the assessment this answers. Recommendation 4 (no hand-rolled crypto) is followed literally; gap 2 (fail-open ACL) is not repeated in the failure behaviour. |
| #890 parts 1, 2 | the PHI decision this depends on, and the discovery restriction that keeps PHI out of what would otherwise need sealing. |

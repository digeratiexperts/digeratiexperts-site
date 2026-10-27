# Installer trust policy

The policy for anything DE Tech Tool downloads or installs on a client device. Move 6 of the
[104-move tracker](DE-TECH-TOOL-TRACKER.md); it gates all of **section C** (installer integrity,
moves 39-48). No hash work starts until this is confirmed.

> **Status: CONFIRMED - Joe, 2026-10-26.** R5 decided the same day (see *Decided: the no-hash outcome*).
> This policy is binding. Section C is authorised to start.
> Move 6 is *confirming* this policy, not merely writing it. Until the sign-off at the bottom is
> filled in, treat every rule below as the recommendation, not as binding. Nothing in section C
> should be built on an unconfirmed policy.

## Scope

Applies to every file the tool downloads, stages or executes on a device:

- the 18 packages in `console/catalog/packages.json`
- the community tools in `console/catalog/community.json`
- anything referenced from `console/catalog/vendors.json`
- any installer named in a playbook under `playbooks/`
- the tool's own update payload (which has its own rule — see R10)

It does not cover the tool's own release packages; those are covered by code signing and
`integrity.json` (section D).

## The rules

**R1. Official vendor sources only.**
Every installer comes from the vendor's own distribution host. No mirrors, no aggregators, no
third-party rehosts, no "the file is also on X". The URL is recorded in the catalog, never typed at
run time.

**R2. A vendor-published hash is authoritative.**
Where the vendor publishes a SHA-256 for the file, that hash is recorded in the catalog and
verified before the file is used. The vendor's hash is the source of truth. A hash copied from a
blog, a forum, or computed by DE from the same file is *not* a vendor hash and must not be recorded
as one.

**R3. A mismatch is always a refusal.**
If the downloaded file's hash does not match the recorded one, the tool refuses it, deletes the
download, and says so plainly — including both hashes. It never installs, never "warns and
continues", and never falls back to a different source.

This is already implemented: `Install-MspAiKit.ps1` removes the download and throws
`sha256 mismatch for <name>.zip (have <have>, want <want>)`. The work in section C is to apply that
behaviour everywhere, not to invent it.

**R4. Authenticode is checked where the vendor signs.**
If the vendor signs the installer, the signature is verified and the signer recorded. A broken or
absent signature where the vendor normally signs is treated like a hash mismatch — a refusal, not a
warning.

**R5. A package with no vendor hash is pinned on first trusted download, behind Authenticode where the vendor signs.**
Where the vendor publishes no hash, the tool downloads once over TLS from the vendor, hashes the file and records
that hash as the pin. **Every pin is labelled `pinned-first-download`, never `vendor-published`**, so nobody mistakes
one for the other. Where the vendor signs the installer, a valid Authenticode signature from the expected publisher
is required *before* the pin is accepted; a vendor who does not sign falls back to the plain first-download pin.
This detects later tampering. It cannot detect a poisoned first fetch, which is why the label matters and why R4
still applies wherever the vendor signs. See *Decided: the no-hash outcome* below.

**R6. Re-verification is automated and rate-limited.**
Hashes and signatures are re-checked in CI on a schedule, rate-limited so a vendor's CDN is not
hammered. A change is a finding, not a silent update.

**R7. A silent vendor change is an alert.**
If a file's hash changes while its version number does not, that is suspicious and gets raised. It
is how a compromised or carelessly-rebuilt upstream shows up.

**R8. winget packages inherit winget's trust, and say so.**
A `winget` source is recorded as such, with its package id. The tool does not pretend to have
verified a hash it never saw. If DE wants stronger guarantees than winget provides, that is a
decision to record here — not something to assume.

**R9. `local` packages are hashed at intake.**
The 6 packages with a `local` source (`SentinelOne`, `Guardz`, `Blackpoint SNAP`, `Prisma`,
`MSP360`, `Timus`) are supplied by DE rather than downloaded. They must be hashed and recorded
when they enter the catalog, and that hash checked before use, exactly like a downloaded file.
"DE supplied it" is not a trust argument; the file can still be wrong or replaced.

**R10. The catalog is not the escape hatch.**
Nobody edits `packages.json` to make a refusal go away. If a package legitimately changes, the
recorded hash is updated in a reviewed change with the vendor's own published value and a note
saying where it came from. Editing a hash to match a file you already have defeats the whole
mechanism.

**R11. The tool's own updates verify before replacement.**
Release packages are code-signed and sha256-pinned; the endpoint verifies signature and hash
before anything is replaced. No unsigned server-supplied script executes. (Already the design —
`DE-TECH-TOOL-ARCHITECTURE.md`, Updates.)

## Current state

Measured against this policy today (18 packages in `packages.json`):

| Source type | Count | Hash pinned | Publisher recorded | Meets policy |
|---|---|---|---|---|
| `url` | 4 | **0 of 4** | 4 of 4 | **No** — R2 fails |
| `local` | 6 | **0 of 6** | 6 of 6 | **No** — R9 fails |
| `winget` | 8 | 0 of 8 | 0 of 8 | R8: recorded as winget |
| **Total** | **18** | **0 of 18** | 10 of 18 | |

**No package in the catalog has a pinned SHA-256.** The four `url` packages download from vendor
hosts and are used without any hash check at all:

- JumpCloud Agent — `https://cdn02.jumpcloud.com/production/jcagent-msi-signed.msi`
- JumpCloud Remote Assist — `https://cdn02.jumpcloud.com/production/jumpcloud-remote-assist-agent.msi`
- Wazuh Agent
- Microsoft 365 Apps for business/enterprise

`community.json`, by contrast, **does** pin SHA-256 per tool and verifies it. So the mechanism
exists and works; it has simply not been applied to `packages.json` yet.

That gap is what moves 39-48 close.

## Open decision — move 48

**Decision, recorded 2026-10-26 by Joe: pin plus Authenticode where the vendor signs, pin on first trusted download otherwise.** This unblocks move 41 and the rest of section C.

| Option | Meaning | Cost | Outcome |
|---|---|---|---|
| **A. Pin on first trusted download** | Download once over TLS from the vendor, hash it, record that hash as the pin, and verify every later use against it. | The first download is only as trustworthy as the TLS path and the vendor's host. It detects *later* tampering, not a poisoned first fetch. | **Chosen where the vendor does not sign** |
| **B. Drop the package** | If the vendor publishes no hash, the tool does not install it. | Some genuinely useful tools get excluded; a technician may install them by hand instead, which is worse. | Rejected |
| **C. Pin + Authenticode** | As A, but additionally require a valid Authenticode signature from the expected publisher before pinning. | Strongest. Fails for vendors who do not sign. | **Chosen where the vendor signs** |

The labelling requirement is part of the decision, not an implementation detail: every pin is recorded as
`pinned-first-download` rather than `vendor-published`, so nobody mistakes one for the other. `community.json`
already distinguishes these and the UI already reports `sha256: set / not set`, so the reporting side is nearly there.

Section C may now proceed past the inventory.

## What each move does against this policy

| Move | Rule it implements |
|---|---|
| 39 — inventory every installer source | Finds every subject of R1 |
| 40 — record URL, vendor hash, whether verified | Establishes the R2 record |
| 41 — flag the no-hash cases | Applies R5 as decided |
| 42 — re-check in CI, rate-limited | R6 |
| 43 — check Authenticode | R4 |
| 44 — alert on silent vendor change | R7 |
| 45 — refuse on mismatch, clearly | R3, applied everywhere |
| 46 — technician-readable version of this | Turns this into the short doc |
| 47 — test each refusal path | Proves R3 actually refuses |
| 48 — **Joe decides the no-hash outcome** | Settles R5 |

## Who may change what

| Change | Who | How |
|---|---|---|
| Add or edit a package source / hash | DE engineering | Reviewed change citing the vendor's published value |
| Raise a refusal to a pass | **Nobody** | Refusals are not overrideable (R10) |
| Add a package with no hash | DE engineering | Only with a `pinned-first-download` label and, where the vendor signs, a verified Authenticode signature (R5) |
| Change this policy | Joe | Re-confirm in writing below |

## Confirmation

Move 6 is complete: confirmed in writing and recorded here.

> I have read this policy and confirm it as DE's installer trust policy.
>
> **Confirmed by: Joe &nbsp;&nbsp; Date: 2026-10-26**
>
> **Decision on R5 (move 48): C where the vendor signs, A otherwise** - pin plus Authenticode where the vendor
> signs, pin on first trusted download where it does not. Every pin labelled `pinned-first-download`.
>
> Notes: recorded from the 2026-10-26 plan review. Option B (drop the package) was rejected because a technician
> would install such a tool by hand instead, which is worse than pinning it.

Section C is **authorised to start**.

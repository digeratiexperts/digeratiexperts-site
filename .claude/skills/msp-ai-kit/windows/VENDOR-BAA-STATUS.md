# Vendor data-sharing and BAA status

Move 96 of the [104-move tracker](DE-TECH-TOOL-TRACKER.md); section H (sensitive data), governance gate
**G7**. Which vendors receive device data because of what DE Tech Tool does, and what is known about
each one's agreement.

> **This document separates two very different things.**
>
> - **What is sent** — determined from the code. Verified, quotable, and testable.
> - **BAA status** — a legal fact about a commercial agreement. **Not determinable from code, and not
>   guessed at here.** Every BAA cell below says what is actually known and nothing more. A blank is
>   not a "yes".

## Why a BAA register at all

A Business Associate Agreement matters when device data could include protected health information.
For a general business MSP most of it will not — but "most" is not "none", and the tool runs on
machines belonging to healthcare clients like any other. G7 exists so the question is answered
per vendor rather than assumed.

## The register

Derived from where the tool makes outbound calls and what it puts in them.

| Vendor | What they receive | How | BAA status |
|---|---|---|---|
| **Intelligence Hub (DE's own)** | Device record: device key, client, site, controls, warranty, evidence bundle hash. **No personal fields** since move 92 | `Send-DEHubPayload`, `Send-DEHubWarranty` | Internal DE system — not a third party. Governed by DE's own policy, not a BAA |
| **Dell (TechDirect)** | Serial number, API key | `Invoke-DEWarrantyWeb` → asset-entitlements | **Unverified.** Needs procurement to confirm |
| **Lenovo (support site)** | Serial number, model | `Invoke-DEWarrantyWeb` → warranty page | **Unverified.** Note: this is a *scrape* of a public page, not an API agreement |
| **HP (warranty API)** | Serial number, API key | `Invoke-DEWarrantyWeb` | **Unverified** |
| **JumpCloud** | Device key, system name, group membership, BitLocker recovery key on escrow | `Invoke-DEJumpCloudApi` | **Unverified** |
| **Guardz** | Installed on device; device telemetry direct to vendor | `DE.Apps` install path | **Unverified** |
| **SentinelOne** | Installed on device; device telemetry direct to vendor | `DE.Apps` install path | **Unverified** |
| **Blackpoint (SNAP)** | Installed on device; telemetry direct to vendor | `DE.Apps` install path | **Unverified** |
| **MSP360** | Backup agent; file data direct to vendor/cloud | `DE.Apps` install path | **Unverified** |
| **Microsoft 365 / Entra** | User and device identity, mailbox data during migration | `DE-Microsoft-Admin` | **Unverified** — likely under the client's own Microsoft agreement, not DE's |

## What the tool itself sends vs what the agent sends

Important distinction, because only the first is DE Tech Tool's responsibility to minimise:

- **The tool's own calls** (warranty lookups, Hub sends, JumpCloud API) are what appear above and are
  what moves 91/92 govern. The tool sends a serial; since move 92 it sends no user names to the Hub.
- **Installed agents** (Guardz, SentinelOne, Blackpoint, MSP360) talk to their vendor directly and
  continuously. DE Tech Tool installs them; it does not mediate what they send. Their data flows are
  the **vendor's** to document and the client's to accept, and belong in the client's own security
  review rather than here.

That second group is the larger exposure and the one this document cannot close.

## The one thing the code does control

Warranty lookups send **serial numbers** to Dell, Lenovo and HP. That is the tool actively
transmitting device identity to a third party, and it is unavoidable if you want a warranty answer.

What can be controlled:

| Control | Status |
|---|---|
| Serial only, never a user name | **Held** — `Invoke-DEWarrantyWeb` sends serial + model |
| HTTPS only | **Held** — the tool refuses non-https endpoints |
| API keys never persisted or logged | **Held** — `Protect-DEText` + `Remove-DESecretKeys`; tested (`License.Tests`, `SensitiveData.Tests`) |
| Result carries no key or token | **Held** — asserted in `Functions.Tests.ps1` |
| Warranty answers cached rather than re-queried | **Held** — `Get-DEWarranty` caches per serial |

## What needs doing

1. **Procurement confirms BAA status** for Dell, Lenovo, HP, JumpCloud, Guardz, SentinelOne,
   Blackpoint and MSP360. That is a legal/ops question, not an engineering one.
2. **Decide the PHI rule.** If a client's device data can include PHI (a healthcare client), does the
   tool run differently there — for example suppressing warranty lookups and agent installs? That is
   a policy decision for Joe.
3. **Put this register in the client-facing security pack.** Clients ask which vendors see their
   data. The table above is the answer as far as the code can give it.
4. **Re-check on vendor change.** Adding a package to `packages.json` should add a row here — the
   same discipline as [INSTALLER-TRUST-POLICY.md](INSTALLER-TRUST-POLICY.md) R6.

## Honesty note

Everything in the "What they receive" column is read from the code and is accurate. Everything in
the "BAA status" column is deliberately blank or marked unverified, because **no BAA has been
reviewed by this work**. Filling those cells in with a plausible-looking "covered" would be worse
than leaving them open: it would be a compliance claim nobody checked.


# DE Tech Tool - 104-move tracker

Status board for the sequenced 104-move plan for **DE Tech Tool** (the `windows/` tree in this repo). Every move below is a GitHub issue; this file is the index that keeps them in plan order.

> **[DE-TECH-TOOL-ARCHITECTURE.md](DE-TECH-TOOL-ARCHITECTURE.md) stays the live done/open board for the roadmap** (move 103). This tracker is the execution checklist underneath it.

## How to use it

- **Pick work from the top.** Moves 1-10 are ordered by leverage and several gate later sections; the sections after that are not a strict sequence within themselves.
- **Closing the issue ticks the box.** This file is generated from GitHub: an open issue renders `- [ ]`, a closed one `- [x]`. Never edit a checkbox by hand - close (or reopen) the issue and re-run the generator.
- **The issue carries the detail**, the PR links and the decisions. Do not add detail to this file.
- **Ownership is fixed at capture.** `Joe` marks the moves that need Joe's decision, access or hardware. Everything else an agent can do unaided.
- **These are backlog items, not work locks.** They carry the `backlog` label and a `[TECHTOOL-nnn]` title prefix. Under `docs/ACTIVE-WORK-COORDINATION.md`, an open issue is a concurrency lock only once someone claims it and prefixes its title `[ACTIVE]`.

## Legend

| Marker | Meaning |
|---|---|
| `- [ ]` | Open |
| `- [x]` | Done (its issue is closed) |
| `Joe` | Needs Joe: a decision, account access, or physical hardware |
| `agent` | Any DE AI agent can complete it unaided |
| `agent + Joe` | Agent writes it, Joe runs it |
| *note* | Blocking or overlap detail captured when the plan was written |

## Plan documents

Written while working through the plan. Each gates a section of it:

| Document | Move | What it governs |
|---|---|---|
| [AUDIT-MODE-CHECKLIST.md](AUDIT-MODE-CHECKLIST.md) | 5 | Validating on a real DE Windows laptop in audit mode (roadmap step 3). Feeds move 25. |
| [INSTALLER-TRUST-POLICY.md](INSTALLER-TRUST-POLICY.md) | 6 | Trust rules for every installer the tool downloads or runs. Gates all of section C. |
| [AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md) | 73 | STRIDE threat model and the per-job-type enable/deny rules for the call-home agent. Gates all of section E. |

## Blocked and gated moves

These are the dependencies worth knowing before picking anything up:

| Move | Blocked by | Why |
|---|---|---|
| 49-58 (D. Signing and release) | **7** | No signing until the code-signing certificate exists. It is the longest lead item - order it first. |
| 41 | **48** | Cannot implement the no-hash policy before Joe decides the outcome. |
| 79-82 (F. Remote assist) | **8** | No adapter work until JumpCloud Remote Assist access and licensing are confirmed. |
| 93 | **9** | Retention cannot be applied until DE sets the retention periods (G8). |
| 39-48 (C. Installer integrity) | **6** | Hash work starts only after the installer-trust policy is confirmed in writing. |
| 25 | **5** | The real-laptop run follows the audit-mode checklist. |
| 59-78 (E. Hub and call-home agent) | **73** | No job type is enabled before the agent threat model exists. |
| 19 / 104 | each other | Both retire compatibility names/aliases. Keep one canonical issue and cross-link. |

## Summary

| Section | Moves | Done | Open | Needs Joe |
|---|---|---|---|---|
| Start here (highest leverage) | 10 | 7 | 3 | 5 |
| A. Quality and trust (11-24) | 14 | 12 | 2 | 0 |
| B. Real-device validation (25-38) | 14 | 0 | 14 | 1 |
| C. Installer integrity (39-48) | 10 | 2 | 8 | 1 |
| D. Signing and release (49-58) | 10 | 0 | 10 | 0 |
| E. Hub and call-home agent (59-78) | 20 | 1 | 19 | 0 |
| F. Remote assist (79-82) | 4 | 0 | 4 | 0 |
| G. Client and dropship workflows (83-90) | 8 | 0 | 8 | 0 |
| H. Sensitive data (91-96) | 6 | 1 | 5 | 0 |
| I. Supportability and docs (97-104) | 8 | 1 | 7 | 1 |
| **Total** | **104** | **24** | **80** | **8** |

## The moves

### Start here (highest leverage)

- [x] **1** Triage the 75 empty catch {} blocks in the analyzer output: cleanup-only versus control path. `agent` - [#719](https://github.com/digeratiexperts/digeratiexperts-site/issues/719)
- [x] **2** Make control-path catches (licence, evidence, verification) log a WARN, never swallow silently. `agent` - [#720](https://github.com/digeratiexperts/digeratiexperts-site/issues/720)
- [x] **3** Fix the 3 remaining non-catch analyzer warnings, so the warnings are all empty catches. `agent` - [#721](https://github.com/digeratiexperts/digeratiexperts-site/issues/721)
- [x] **4** Add a local pre-push script that runs the same analyzer and Pester checks as CI. `agent` - [#722](https://github.com/digeratiexperts/digeratiexperts-site/issues/722)
- [x] **5** Write the real-laptop audit-mode checklist (roadmap step 3). **agent + Joe** - [#723](https://github.com/digeratiexperts/digeratiexperts-site/issues/723)
  - *Joe runs the hardware side; the checklist itself is written by an agent.*
- [x] **6** Confirm the installer-trust policy in writing before any hash work starts. `agent` - [#724](https://github.com/digeratiexperts/digeratiexperts-site/issues/724)
  - *Gates every item in section C. Needs DE sign-off on the wording once drafted.*
- [ ] **7** Buy the code-signing certificate. **Joe** - [#725](https://github.com/digeratiexperts/digeratiexperts-site/issues/725)
  - *Longest lead item. Gates all of section D.*
- [ ] **8** Confirm JumpCloud Remote Assist access and licensing. **Joe** - [#726](https://github.com/digeratiexperts/digeratiexperts-site/issues/726)
  - *Gates section F.*
- [x] **9** Set retention periods for device evidence (G8). **Joe** - [#727](https://github.com/digeratiexperts/digeratiexperts-site/issues/727)
  - *Gates item 93.*
- [ ] **10** Run the VPS go-live script, which unblocks the DE Tech Tool secrets and migrations. **Joe** - [#728](https://github.com/digeratiexperts/digeratiexperts-site/issues/728)
  - *See GO-LIVE.md.*

### A. Quality and trust (11-24)

- [x] **11** Test that a failed control can never appear as PASS in any report. `agent` - [#729](https://github.com/digeratiexperts/digeratiexperts-site/issues/729)
- [x] **12** Golden-file tests for client-facing reports: no costs, margins, keys or vendor sourcing. `agent` - [#730](https://github.com/digeratiexperts/digeratiexperts-site/issues/730)
- [x] **13** Automated check that client output contains none of the restricted fields. `agent` - [#731](https://github.com/digeratiexperts/digeratiexperts-site/issues/731)
- [x] **14** Redaction tests: BitLocker recovery passwords never reach logs, state or receipts. `agent` - [#732](https://github.com/digeratiexperts/digeratiexperts-site/issues/732)
- [x] **15** Test that Guardz keys and SentinelOne tokens are never persisted. `agent` - [#733](https://github.com/digeratiexperts/digeratiexperts-site/issues/733)
- [x] **16** Mutation-test the licence and fail-closed paths. `agent` - [#734](https://github.com/digeratiexperts/digeratiexperts-site/issues/734)
- [ ] **17** Audit every 'policy warn' path for fail-open risk. `agent` - [#735](https://github.com/digeratiexperts/digeratiexperts-site/issues/735)
- [x] **18** Drift check: exported module functions against the docs. `agent` - [#736](https://github.com/digeratiexperts/digeratiexperts-site/issues/736)
- [ ] **19** Remove compatibility aliases once the installed base is checked. `agent` - [#737](https://github.com/digeratiexperts/digeratiexperts-site/issues/737)
  - *Overlaps item 104 (retire compatibility names). Keep one canonical issue and cross-link.*
- [x] **20** Add a changelog entry per version, linked to its PR. `agent` - [#738](https://github.com/digeratiexperts/digeratiexperts-site/issues/738)
- [x] **21** Confirm the 2 Windows-only launcher tests run on Windows CI and report. `agent` - [#739](https://github.com/digeratiexperts/digeratiexperts-site/issues/739)
- [x] **22** Add a Pester test for every contract schema's validators. `agent` - [#740](https://github.com/digeratiexperts/digeratiexperts-site/issues/740)
- [x] **23** Test that the contracts refuse secret-shaped keys. `agent` - [#741](https://github.com/digeratiexperts/digeratiexperts-site/issues/741)
- [x] **24** Fuzz the Hub payload builder with malformed input. `agent` - [#742](https://github.com/digeratiexperts/digeratiexperts-site/issues/742)

### B. Real-device validation (25-38)

- [ ] **25** Audit-mode run on a DE Windows laptop, recorded as evidence. **Joe** - [#743](https://github.com/digeratiexperts/digeratiexperts-site/issues/743)
  - *Roadmap step 3. Pairs with item 5.*
- [ ] **26** Run on Windows Home and record what the tool reports. `agent` - [#744](https://github.com/digeratiexperts/digeratiexperts-site/issues/744)
- [ ] **27** Run on a 32-bit RMM host and confirm the 64-bit relaunch. `agent` - [#745](https://github.com/digeratiexperts/digeratiexperts-site/issues/745)
- [ ] **28** Run as SYSTEM under an RMM agent. `agent` - [#746](https://github.com/digeratiexperts/digeratiexperts-site/issues/746)
- [ ] **29** Run the OOBE path on a clean VM image. `agent` - [#747](https://github.com/digeratiexperts/digeratiexperts-site/issues/747)
- [ ] **30** Run the after-first-sign-in path. `agent` - [#748](https://github.com/digeratiexperts/digeratiexperts-site/issues/748)
- [ ] **31** Reboot mid-run and confirm resume works. `agent` - [#749](https://github.com/digeratiexperts/digeratiexperts-site/issues/749)
- [ ] **32** Force a failed apply and confirm rollback. `agent` - [#750](https://github.com/digeratiexperts/digeratiexperts-site/issues/750)
- [ ] **33** Run on a machine with Guardz or SentinelOne preinstalled. `agent` - [#751](https://github.com/digeratiexperts/digeratiexperts-site/issues/751)
- [ ] **34** Boot-rescue test from a real WinPE USB. `agent` - [#752](https://github.com/digeratiexperts/digeratiexperts-site/issues/752)
- [ ] **35** BitLocker recovery path, on a throwaway volume only. `agent` - [#753](https://github.com/digeratiexperts/digeratiexperts-site/issues/753)
- [ ] **36** Measure run time on a slow laptop and set timeouts from the numbers. `agent` - [#754](https://github.com/digeratiexperts/digeratiexperts-site/issues/754)
- [ ] **37** Confirm a cancelled run leaves no half-applied state. `agent` - [#755](https://github.com/digeratiexperts/digeratiexperts-site/issues/755)
- [ ] **38** Record every real-device finding as a tracked issue. `agent` - [#756](https://github.com/digeratiexperts/digeratiexperts-site/issues/756)

### C. Installer integrity (39-48)

- [x] **39** Inventory every installer source in the catalog and playbooks. `agent` - [#757](https://github.com/digeratiexperts/digeratiexperts-site/issues/757)
- [ ] **40** For each, record the URL, the vendor-published hash and whether it is verified. `agent` - [#758](https://github.com/digeratiexperts/digeratiexperts-site/issues/758)
- [ ] **41** Flag installers with no vendor hash; choose pin-on-first-trusted-download or drop. `agent` - [#759](https://github.com/digeratiexperts/digeratiexperts-site/issues/759)
  - *Decision needed from Joe at item 48 before this is implemented.*
- [ ] **42** Re-check installer hashes automatically in CI, rate-limited. `agent` - [#760](https://github.com/digeratiexperts/digeratiexperts-site/issues/760)
- [ ] **43** Check Authenticode signatures where the vendor provides them. `agent` - [#761](https://github.com/digeratiexperts/digeratiexperts-site/issues/761)
- [ ] **44** Alert when a vendor changes a file without changing its version. `agent` - [#762](https://github.com/digeratiexperts/digeratiexperts-site/issues/762)
- [ ] **45** Refuse any installer whose hash does not match, with a clear message. `agent` - [#763](https://github.com/digeratiexperts/digeratiexperts-site/issues/763)
- [ ] **46** Write the trust policy as a short document the technicians can read. `agent` - [#764](https://github.com/digeratiexperts/digeratiexperts-site/issues/764)
  - *Pairs with item 6, which is the written DE confirmation of the policy.*
- [ ] **47** Test the refusal path for each mismatch type. `agent` - [#765](https://github.com/digeratiexperts/digeratiexperts-site/issues/765)
- [x] **48** Decide the outcome for installers that publish no hash. **Joe** - [#766](https://github.com/digeratiexperts/digeratiexperts-site/issues/766)
  - *Blocks item 41.*

### D. Signing and release (49-58)

- [ ] **49** Set up signing in Sign-DETechConsole.ps1 once the certificate exists. `agent` - [#767](https://github.com/digeratiexperts/digeratiexperts-site/issues/767)
  - *Blocked on item 7. See also umbrella issue #620.*
- [ ] **50** Pick and test a timestamp server. `agent` - [#768](https://github.com/digeratiexperts/digeratiexperts-site/issues/768)
- [ ] **51** Sign every script and module; verify signatures in CI on Windows. `agent` - [#769](https://github.com/digeratiexperts/digeratiexperts-site/issues/769)
- [ ] **52** Confirm integrity.json covers every shipped file. `agent` - [#770](https://github.com/digeratiexperts/digeratiexperts-site/issues/770)
- [ ] **53** Add a reproducible-build check: same inputs, same hash. `agent` - [#771](https://github.com/digeratiexperts/digeratiexperts-site/issues/771)
- [ ] **54** Write a release checklist used for every build. `agent` - [#772](https://github.com/digeratiexperts/digeratiexperts-site/issues/772)
- [ ] **55** Verify the per-client watermark with a tool, so its claim can be checked. `agent` - [#773](https://github.com/digeratiexperts/digeratiexperts-site/issues/773)
- [ ] **56** Test that an unsigned build is labelled unsigned everywhere. `agent` - [#774](https://github.com/digeratiexperts/digeratiexperts-site/issues/774)
- [ ] **57** Automate the release zip and its hash record. `agent` - [#775](https://github.com/digeratiexperts/digeratiexperts-site/issues/775)
- [ ] **58** Keep the signing key off every build machine except the signing step. `agent` - [#776](https://github.com/digeratiexperts/digeratiexperts-site/issues/776)
  - *Overlaps the "Blocked on DE" certificate item in umbrella issue #620.*

### E. Hub and call-home agent (59-78)

- [ ] **59** Finalise the de.techconsole.job/v1 contract and its device validators. `agent` - [#777](https://github.com/digeratiexperts/digeratiexperts-site/issues/777)
- [ ] **60** Design the Hub job-queue endpoints: lease, acknowledge, result. `agent` - [#778](https://github.com/digeratiexperts/digeratiexperts-site/issues/778)
- [ ] **61** Design the one-time enrolment token exchange. `agent` - [#779](https://github.com/digeratiexperts/digeratiexperts-site/issues/779)
- [ ] **62** Issue per-device client certificates in the Hub; support revocation. `agent` - [#780](https://github.com/digeratiexperts/digeratiexperts-site/issues/780)
- [ ] **63** Use mTLS on the agent connection. `agent` - [#781](https://github.com/digeratiexperts/digeratiexperts-site/issues/781)
- [ ] **64** Add certificate rotation. `agent` - [#782](https://github.com/digeratiexperts/digeratiexperts-site/issues/782)
- [ ] **65** Verify job signatures on the device, including expiry. `agent` - [#783](https://github.com/digeratiexperts/digeratiexperts-site/issues/783)
- [ ] **66** Keep a replay store of nonces on the device. `agent` - [#784](https://github.com/digeratiexperts/digeratiexperts-site/issues/784)
- [ ] **67** Reject any action ID not in the signed local catalog. `agent` - [#785](https://github.com/digeratiexperts/digeratiexperts-site/issues/785)
- [ ] **68** Build the Windows service skeleton, with no actions yet. `agent` - [#786](https://github.com/digeratiexperts/digeratiexperts-site/issues/786)
- [ ] **69** Implement heartbeat and inventory deltas. `agent` - [#787](https://github.com/digeratiexperts/digeratiexperts-site/issues/787)
- [ ] **70** Upload evidence with resumable retries and idempotency keys. `agent` - [#788](https://github.com/digeratiexperts/digeratiexperts-site/issues/788)
- [ ] **71** Queue evidence offline with a size bound; never drop it silently. `agent` - [#789](https://github.com/digeratiexperts/digeratiexperts-site/issues/789)
- [ ] **72** Build install, upgrade and uninstall for the agent, each signature-checked. `agent` - [#790](https://github.com/digeratiexperts/digeratiexperts-site/issues/790)
- [x] **73** Write a threat model for the agent before any job type is enabled. `agent` - [#791](https://github.com/digeratiexperts/digeratiexperts-site/issues/791)
  - *Hard gate: no job type is enabled before this exists.*
- [ ] **74** Design the break-glass shell: disabled by default, time-limited, transcribed. `agent` - [#792](https://github.com/digeratiexperts/digeratiexperts-site/issues/792)
- [ ] **75** Test that a stolen device key can be revoked and stops working. `agent` - [#793](https://github.com/digeratiexperts/digeratiexperts-site/issues/793)
- [ ] **76** Test the agent with the Hub unreachable and confirm local functions still run. `agent` - [#794](https://github.com/digeratiexperts/digeratiexperts-site/issues/794)
- [ ] **77** Load-test the Hub job queue with many devices. `agent` - [#795](https://github.com/digeratiexperts/digeratiexperts-site/issues/795)
- [ ] **78** Add a kill switch the Hub can use to stop all agent jobs. `agent` - [#796](https://github.com/digeratiexperts/digeratiexperts-site/issues/796)

### F. Remote assist (79-82)

- [ ] **79** Build a provider adapter interface: start, stop, status, audit. `agent` - [#797](https://github.com/digeratiexperts/digeratiexperts-site/issues/797)
  - *Blocked on item 8 (JumpCloud Remote Assist access and licensing).*
- [ ] **80** Record remote-session start and end as evidence events. `agent` - [#798](https://github.com/digeratiexperts/digeratiexperts-site/issues/798)
- [ ] **81** Test that a remote session cannot start without a logged reason. `agent` - [#799](https://github.com/digeratiexperts/digeratiexperts-site/issues/799)
- [ ] **82** Evaluate MeshCentral as a later option, not a first build. `agent` - [#800](https://github.com/digeratiexperts/digeratiexperts-site/issues/800)

### G. Client and dropship workflows (83-90)

- [ ] **83** Put the Zoho Desk ticket ID on the device record, so evidence links back to the ticket. `agent` - [#801](https://github.com/digeratiexperts/digeratiexperts-site/issues/801)
- [ ] **84** Test the dropship kit against real serial number samples. `agent` - [#802](https://github.com/digeratiexperts/digeratiexperts-site/issues/802)
- [ ] **85** Test the OEM placeholder-serial refusal against a real serial list. `agent` - [#803](https://github.com/digeratiexperts/digeratiexperts-site/issues/803)
- [ ] **86** Enforce Alamo-only branding with tests. `agent` - [#804](https://github.com/digeratiexperts/digeratiexperts-site/issues/804)
- [ ] **87** Add a sanity test per bundle tier. `agent` - [#805](https://github.com/digeratiexperts/digeratiexperts-site/issues/805)
- [ ] **88** Monitor vendor warranty endpoints for changes; set a cache policy. `agent` - [#806](https://github.com/digeratiexperts/digeratiexperts-site/issues/806)
- [ ] **89** Test the 'refuse a device other than the ordered one' path with a wrong serial. `agent` - [#807](https://github.com/digeratiexperts/digeratiexperts-site/issues/807)
- [ ] **90** Write a one-page client explainer of what the tool changes on their device. `agent` - [#808](https://github.com/digeratiexperts/digeratiexperts-site/issues/808)

### H. Sensitive data (91-96)

- [ ] **91** Classify device evidence fields: serials, user names, profile paths. `agent` - [#809](https://github.com/digeratiexperts/digeratiexperts-site/issues/809)
- [ ] **92** Redact user names and profile paths from evidence sent to the Hub; test it. `agent` - [#810](https://github.com/digeratiexperts/digeratiexperts-site/issues/810)
- [x] **93** Apply the retention period to local evidence bundles, once DE sets it. `agent` - [#811](https://github.com/digeratiexperts/digeratiexperts-site/issues/811)
  - *Blocked on item 9 (Joe sets the retention periods).*
- [ ] **94** Log reads of evidence in the Hub (G4). `agent` - [#812](https://github.com/digeratiexperts/digeratiexperts-site/issues/812)
- [ ] **95** Assess encryption at rest for local state and evidence. `agent` - [#813](https://github.com/digeratiexperts/digeratiexperts-site/issues/813)
- [ ] **96** Check the BAA status of any vendor that receives device data (G7). `agent` - [#814](https://github.com/digeratiexperts/digeratiexperts-site/issues/814)

### I. Supportability and docs (97-104)

- [ ] **97** Export a diagnostic bundle with a test that it contains no secrets. `agent` - [#815](https://github.com/digeratiexperts/digeratiexperts-site/issues/815)
- [ ] **98** Cap log size and rotate the logs. `agent` - [#816](https://github.com/digeratiexperts/digeratiexperts-site/issues/816)
- [ ] **99** Test the update flow against the signed manifest. `agent` - [#817](https://github.com/digeratiexperts/digeratiexperts-site/issues/817)
- [ ] **100** Make crash reports carry no sensitive data. `agent` - [#818](https://github.com/digeratiexperts/digeratiexperts-site/issues/818)
- [ ] **101** Write a support runbook mapping each failure to its fix. `agent` - [#819](https://github.com/digeratiexperts/digeratiexperts-site/issues/819)
- [ ] **102** A technician quick-start, checked with a real technician. **Joe** - [#820](https://github.com/digeratiexperts/digeratiexperts-site/issues/820)
- [ ] **103** Keep DE-TECH-TOOL-ARCHITECTURE.md as the live done/open board. `agent` - [#821](https://github.com/digeratiexperts/digeratiexperts-site/issues/821)
- [x] **104** Retire compatibility names only after the installed base is checked. `agent` - [#822](https://github.com/digeratiexperts/digeratiexperts-site/issues/822)
  - *Overlaps item 19 (remove compatibility aliases). Keep one canonical issue and cross-link.*

---

Generated by `scripts/build-techtool-tracker.ps1` from the `[TECHTOOL-nnn]` issues on https://github.com/digeratiexperts/digeratiexperts-site. Close an issue to tick its box, then re-run the generator.


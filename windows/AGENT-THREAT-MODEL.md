# DE Tech Agent threat model (call-home agent)

**Move 73** of the 104-move plan ([issue #791](https://github.com/digeratiexperts/digeratiexperts-site/issues/791)). This
document is the **hard gate on section E (moves 59-78)**: no job type of `de.techconsole.job/v1` is enabled before this
document exists, and none is enabled that its rules do not allow. Section E builds to this document; a pull request that
flips a job type on must show the checklist rows for that type in §7 are met.

**Status:** in force on merge. The eight decisions this document left open (D1-D8) were made by **Joe on 2026-10-31** and are recorded in §12; the rules below read as decided, and the job types they gate follow them.

**Scope:** the call-home path described in [DE-TECH-TOOL-ARCHITECTURE.md](DE-TECH-TOOL-ARCHITECTURE.md) ("Call-home
design"): the **DE Tech Agent Windows service**, its **Hub control plane** (Intelligence Hub), the **signed local
catalog**, and **every planned job type** of `de.techconsole.job/v1`. The interactive tool, the boot rescue and today's
technician-initiated Hub sends are in scope only where the agent reuses them.

**Out of scope, with pointers:** licence, watermark and copied-tool threats -> [PROTECTING-THE-TOOL.md](PROTECTING-THE-TOOL.md);
installer supply chain -> [INSTALLER-TRUST-POLICY.md](INSTALLER-TRUST-POLICY.md) (gates section C); the Hub's separate
script-running endpoint agent (Go, controls C1-C21) -> Intelligence-Hub `docs/ENDPOINT-AGENT-SECURITY.md` — its controls
are the pattern for the Hub side of this one and are cited below as C-numbers; local evidence storage ->
[STORAGE.md](STORAGE.md); sensitive device fields -> moves 91-96.

**How to use it.** §7 is the rule set section E follows, per job type. §8 maps every move 59-78 to the threat it answers.
Nothing in §7 is weakened without DE approval (§13).

---

## 1. System under study

| Component | Runs where | Privilege | State |
|---|---|---|---|
| DE Tech Agent (Windows service) | Client device | SYSTEM | Planned: moves 68-72. Outbound-only; the same action engine as the tool |
| DE Tech Tool (interactive) | Client device, technician session | Technician / elevated per action | Exists. Today a job is "only a plan the technician confirms" (`job.schema.json`) |
| Boot rescue | WinPE from USB/ISO | Local system of the offline volume | Exists. Never needs the Hub or the agent; prompts for the send secret and stores nothing |
| Hub control plane | techsales.digerati-experts.com (Intelligence Hub) | Service | Partially exists (de-sync intake, licence service); job-queue endpoints planned (move 60) |
| Signed local catalog + client profiles + trust files | Device (`console/catalog`, `integrity.json`) | Read-only at runtime | Exists |
| Release/update channel | Release zips, RMM/Intune | Release machine (move 58) | Exists for the tool; agent self-update planned (move 72/99) |

Data flow, in one picture:

```
  [technician / RMM]                [DE Tech Agent, SYSTEM]                     [Hub control plane]
        |                                  |                                          |
        | confirm plan (today)             |--- outbound TLS + mTLS (61-64) -------->|
        |                                  |    enroll, heartbeat/inventory delta,    |
        |                                  |    lease job, acknowledge, result,        |
        |                                  |    evidence upload, catalog refresh,      |
        |                                  |    identity rotation / revocation         |
        |                                  |<-- signed job envelope (65-67) ----------|
        |                                  |    jobId, ids, action id+version, typed   |
        |                                  |    params, issued/expiry, nonce,          |
        |                                  |    privilege, catalog hash, signature     |
  [WinPE rescue] -- handoff (USB + ProgramData\DE\TechConsole\handoff) --> [on-device review]
```

Hard rules that hold everywhere: **no inbound management port on client devices**; **endpoints never talk to the
database directly**; **no unsigned server-supplied script ever executes** (architecture "Updates").

## 2. Assets

| ID | Asset | Impact if lost |
|---|---|---|
| A1 | The ability to run code on client devices (SYSTEM) | Crown jewel: a breach at every client at once |
| A2 | Client data the actions can read (profiles, user names, inventory, documents) | Client confidentiality, contract and BAA exposure |
| A3 | Job results and evidence bundles (can contain sensitive data) | Same, plus incident detail |
| A4 | Device private keys / per-device certificates (moves 62-64) | An impostor device joins the fleet |
| A5 | Enrolment tokens (move 61) | Rogue enrolment |
| A6 | The job signing key and any reviewer keys (§9) | Forged jobs fleet-wide; the Hub is a tier-0 asset |
| A7 | Signed local catalog, client profiles, trust files (`integrity.json`) | Uncontrolled actions run under DE's name |
| A8 | The de-sync HMAC secret (`DE_HUB_SIGNING_SECRET` / `TECHCONSOLE_TO_HUB_SECRET`) | Forged events into the Hub record |
| A9 | Technician identity and licences | Attribution and revocation fail (PROTECTING-THE-TOOL) |
| A10 | The fleet record (which device, which client, which jobs ran) | Detection and forensics fail |
| A11 | The trust clients place in DE | Irreversible; the reason every rule below exists |

## 3. Adversaries

Aligned with ENDPOINT-AGENT-SECURITY §1, extended for this device fleet:

1. **External attacker** holding a stolen enrolment token, an intercepted request, or nothing but the internet.
2. **Attacker with Hub database write** (SQL injection, leaked backup): edits job rows under the approval seal.
3. **Attacker with full Hub server control** (root on the VPS, or the environment): can sign jobs. The Hub is tier-0.
4. **A standard local user, or malware running as that user**, on a managed device.
5. **A malicious or careless insider**: a technician, an owner_admin acting alone, or an AI agent or tool with repo or
   server access (ADR 0022 makes agent tooling part of this class).
6. **A compromised build or update channel.**
7. **A stolen or lost device** in the wrong hands, including offline attacks on its state.
8. **An ex-technician with a copied build** (PROTECTING-THE-TOOL is the answer; named here so the agent never
   contradicts it).

## 4. Trust boundaries

| ID | Boundary | Crossed by |
|---|---|---|
| TB1 | Client device <-> Hub network | The outbound TLS/mTLS call-home channel (moves 61-64) |
| TB2 | SYSTEM service <-> interactive user session (and WinPE <-> Windows volume) | Any helper UI, the rescue handoff, prompts |
| TB3 | Job envelope <-> action engine | Signature, expiry, nonce, kind allowlist, signed catalog (moves 65-67) |
| TB4 | Device state store (keys, nonce store, queued evidence, licence) <-> everything else on the device | File ACLs, atomic writes, TPM/DPAPI |
| TB5 | Hub application <-> Hub database | Sealed jobs, parameterized queries, least-privilege DB role |
| TB6 | Build/release machine <-> runtime | Release packages, manifests, `integrity.json`, Authenticode |
| TB7 | Technician identity <-> job issuance | Approvals, `issuedBy`, licence binding |
| TB8 | Client tenant <-> client tenant | Account/device binding on every job, result and evidence item |
| TB9 | Hub operator (human or AI agent) <-> production | PR review, DE merge approval, key ceremony, ADR 0022 rules |

## 5. STRIDE threats and mitigations

Every mitigation that is a move names it; every C-number is the Hub-side control it reuses.

### Spoofing

| ID | Threat | Mitigation | Verified by |
|---|---|---|---|
| S1 | A rogue device enrols with a stolen enrolment token | One-time, short-lived, limited-use tokens stored only as a hash; proof of key possession; enrolment rate-limited; tokens revocable; devices enrolled with an approval-required token stay **pending** (no jobs, no results) until a technician approves them (C2, C18 pattern) — **move 61** | Enrolment tests; IR-4 runbook |
| S2 | Something impersonates the Hub to the agent (forged jobs, forged updates) | mTLS with a pinned Hub identity (**63**); job signatures verified against keys pinned at build/enrolment time, never keys sent by the server (**65**); signed local catalog (**67**); signed, sha256-pinned update manifests (architecture "Updates"). Any unknown key: refuse, record, alert (C20 pattern) | Move 65 refusal tests; cross-language signature vectors |
| S3 | A device key is cloned from a stolen device | TPM-backed non-exportable keys when available (**62**); identity bound to account/client/device IDs, never inferred from hostname; immediate server-side revocation (**75**) | Move 75 test; TPM-absent fallback recorded as residual risk |
| S4 | A captured job or request is replayed | Expiry window in the envelope (**65**) and a per-device replay store of nonces where each nonce is accepted once (**66**); bounded clock skew, monotonic "latest time seen" floor (licence precedent) | Replay tests; move 36 timings |
| S5 | Someone who is not the technician uses their copy | Licence + watermark + technician binding (PROTECTING-THE-TOOL); every applied change records technician, licence ID and build ID | Audit assertions; Hub device record |
| S6 | Another local user impersonates the service or a helper | Service-owned state under `ProgramData\DE` with SYSTEM/Administrators ACLs; the service never writes user-controlled paths; any future helper UI pairs mutually and loopback-only (C10, C11 pattern) | TB2 tests when the helper exists |
| S7 | An agent credential or repo access is abused on the Hub side | Task-scoped, expiring, revocable agent credentials (ADR 0022 C1); PR review; DE approves every merge; two-person key ceremony (§9) | Backstage audit; release governance |

### Tampering

| ID | Threat | Mitigation | Verified by |
|---|---|---|---|
| T1 | A job is edited after approval (adversary 2) | The envelope is sealed and signed over jobId, account/device ids, action id + version, typed parameters, issued/expiry times, nonce, required privilege/approval and catalog/profile hashes (**59, 65**); a mismatch is refused and reported, never run; Hub-side job seal with automatic delivery pause on mismatch (C3 pattern) | "Refuses a job whose row was edited" test |
| T2 | The local catalog or a client profile is tampered with | Action IDs must match the catalog whose sha256 the job pins (**67**); `integrity.json` + Authenticode; a tampered copy reports itself tampered everywhere (PROTECTING-THE-TOOL layer 5) | Move 67 tests; integrity tests |
| T3 | The agent binary or an update is tampered with (adversary 6) | Install, upgrade and uninstall are each signature-checked (**72**); updates are signed, sha256-pinned, strictly newer, and self-tested before the swap; no unsigned server-supplied script executes | Move 99 update tests; attacker-signed 9.9.9 refusal |
| T4 | Evidence or results are altered on the device | Results bound to jobId and payload hash; append-only Hub audit; evidence reads logged (**94**) | Move 94 tests |
| T5 | Trust or policy files are altered to relax enforcement | Covered by `integrity.json`; a missing or malformed policy fails closed on real builds (the move 17 rule) | FailClosed tests |
| T6 | Command injection through job parameters | Typed parameters per contract schema; parameters reach actions only as structured values or environment-style variables, never spliced into command text (C6 pattern); contracts refuse secret-shaped keys (**23**); the payload builder is fuzzed (**24**) | "Parameters cannot inject commands" tests; move 24 fuzzing |

### Repudiation

| ID | Threat | Mitigation | Verified by |
|---|---|---|---|
| R1 | Nobody can prove who ordered a job | Jobs carry `issuedBy` and a reason/ticket; every token, enrolment, job, delivery, result and refusal is written to the append-only audit (C16 pattern); device evidence records jobId, technician, licence and build | Audit assertions |
| R2 | A technician denies a local change | The tool records technician + build ID + licence on every run (PROTECTING-THE-TOOL layer 7) | Existing evidence fields |
| R3 | Evidence disappears | Hub-side copy of results; local deletions logged; retention applied per Joe's periods (**93**, D6: raw evidence 13 months, audit/compliance 6 years) | Move 93 (move 9 decided) |
| R4 | Enrolment is denied after the fact | Token issuance/consumption and device approval are audited; the pending-device approval names its approver (C18 pattern) | Enrolment audit tests |

### Information disclosure

| ID | Threat | Mitigation | Verified by |
|---|---|---|---|
| I1 | Secrets leak through job parameters, output or logs | Contracts refuse secret-shaped keys and BitLocker-shaped values; secret-named keys are dropped before validation (existing `Remove-DEContractSecretKeys` rule) rather than sent redacted; output is redacted on the device before egress and before the size cap (C9 pattern) and redacted again at the Hub; BitLocker recovery passwords never leave the typed prompt (move 14) | Redaction tests (14, 15); move 23 |
| I2 | Client data crosses client boundaries | Every job, result and evidence item is bound to one account/device (TB8); account mapping required before any send (the 1.10.1 rule); a job for another device is refused, not queued | Cross-client refusal tests |
| I3 | The call-home channel is eavesdropped | Outbound TLS only, mTLS per device (**63**), no inbound port; the shared de-sync HMAC secret (A8) is never an agent credential | TLS/mTLS configuration review |
| I4 | A local user reads agent state or keys | State directory locked to SYSTEM/Administrators before any key is written; files 0600-equivalent and written atomically; TPM/DPAPI where available (C14 pattern) | ACL tests; move 62 |
| I5 | PII leaks through inventory and evidence (user names, profile paths) | Field classification (**91**) and redaction before upload (**92**); the golden rule is that results carry state, not people | Move 92 tests |
| I6 | The Hub's evidence store leaks | Account scoping on every route; evidence reads logged (**94**); BAA status checked for any vendor that receives device data (**96**) | Move 94/96 checks |
| I7 | Diagnostic bundles or crash reports leak | A tested bundle contains no secrets (**97**); crash reports carry no sensitive data (**100**); log caps and rotation (**98**) | Moves 97, 100 tests |

### Denial of service

| ID | Threat | Mitigation | Verified by |
|---|---|---|---|
| D1 | The job queue or one device is flooded | Jobs are leased and idempotent (**60, 70**); per-device rate limits with the count starting only after the signature verifies (C19 pattern); queue load-tested before fleet use (**77**) | Move 77 results |
| D2 | One bad job bricks a device | Every action has verify/rollback; restart resumes (**31**); a forced failure rolls back (**32**); timeouts set from measured run times (**36**); a cancelled run leaves no half-applied state (**37**) | Moves 31, 32, 36, 37 |
| D3 | The Hub is unreachable | Local functions keep working with no server (**76**); evidence queues offline, size-bounded, and is never dropped silently (**71**); stale cached lists never relax enforcement (licence precedent) | Move 76 test |
| D4 | Clock skew invalidates everything (or extends it) | `net.time` gate before work that needs TLS; bounded validity windows; the monotonic latest-time floor stops clock-setback attacks (licence precedent) | Skew tests |
| D5 | A mass job goes wrong fleet-wide | Mass-impact jobs need a person's approval even from the catalog (C8 pattern; threshold **10 devices**, D5 decided 2026-10-31); staged rollout; fleet kill switch and per-account pause (**78**) | Move 78 + blast-radius tests |
| D6 | The update channel is poisoned | Signed manifests only; self-test before swap; if the release key is doubted, the manifest is pulled and a fresh install carries the new key (Hub IR-3 pattern) | Move 99; IR runbook |

### Elevation of privilege

| ID | Threat | Mitigation | Verified by |
|---|---|---|---|
| E1 | A job runs an action its job type does not allow | The **two-key check** of §7: the kind allowlist and the signed local catalog must both accept the action ID | Per-kind refusal tests (part of moves 59, 67) |
| E2 | A local user escalates through the service | TB2 rules (S6); parameters arrive as data; the service never follows user-supplied paths | C10/C11-pattern tests |
| E3 | A read-only job changes the device | The `audit` job type has no Apply/Remediate/Rollback at all (§7.1); elevation gates (`gate.elevated`) are enforced on the device regardless of who signed the job | Audit-kind mutation tests |
| E4 | The break-glass shell is abused | **Not built** (D4, decided 2026-10-31: defer, do not build; move 74 is answered by that decision). If it is ever revisited it is a separate capability: disabled by default, just-in-time approved, short-lived, fully transcripted, and **no job type enables it** | Decision recorded; nothing to test while it does not exist |
| E5 | A compromised Hub signs arbitrary jobs (adversary 3) | Job-key tier-0 handling: ceremony and rotation (§9), key rotation (**64**), device revocation (**75**), kill switch (**78**), per-build reviewer-key pinning (C21 pattern) — **adopted**, D3: two offline hardware keys (primary + backup YubiKey), both held by Joe; every delivered job is reviewable by payload hash | Rotation/revocation tests; audit drill |
| E6 | A job retargets another device or client | `deviceKey` shape and certificate binding; account mapping required; never infer tenant from hostname | Cross-device refusal tests |

## 6. Residual risks (honest list)

- **PowerShell is readable and editable.** Enforcement is server-held value, integrity reporting and watermarking, not
  obfuscation (PROTECTING-THE-TOOL "the honest starting point"). An edited copy still has no secrets, no profiles and no
  Hub access.
- **Adversary 3 can sign jobs** while the job key lives on the Hub server. Reviewer-key pinning (D3, decided), rotation, revocation
  and the kill switch narrow it; only a KMS/HSM (§9) closes it. Treat the VPS like a domain controller until then.
- **No TPM means clonable software keys** until revocation catches up. Mitigation is detection speed (C20 pattern) and
  tested revocation (**75**).
- **The de-sync HMAC envelope (A8) is one shared secret per deployment.** A leak forges events until it is rotated. Agent
  traffic does not use it; technician-initiated sends keep it until a per-device event identity supersedes them.
- **Retention is decided; the BAA answer is not.** Joe's periods (D6, 2026-10-31): raw device evidence 13 months,
  audit logs and compliance reports 6 years (HIPAA documentation retention) — implemented by moves 9/93. BAA status
  for vendors receiving device data (move 96) is still open.

## 7. Job types: enable and deny rules

**Definition.** A "job type" is the `kind` of a `de.techconsole.job/v1` envelope:
`provision` | `takeover` | `rescue` | `audit` | `deprovision` | `maintenance`.
The envelope's `actions` array names action IDs from the signed local catalog.

**The two-key check — every job, every type.** A job runs an action only when both accept it:

1. **Kind allowlist (this section).** The agent refuses any action ID not enabled for the job's kind, records the refusal
   as the job's result, and raises a security event. Refusals are reported, never dropped (C20 pattern).
2. **Signed local catalog (move 67).** The action ID and version must exist in the catalog whose sha256 matches the job's
   `catalogSha256`, and the envelope signature must verify (moves 65-66).

### 7.0 Global deny list — no job type may ever

- run anything outside the signed local catalog: **no arbitrary PowerShell, no script text in a job, no
  download-and-execute (`iex (irm ...)`, `curl | sh`), no LOLBin payloads.** Jobs carry typed parameters, never code;
- carry secret-shaped parameters (BitLocker recovery passwords, tokens, passwords, keys) — the contract refuses them
  (moves 23, 59);
- target a device or client other than the enrolled one (deviceKey + account binding, TB8);
- run with an expired envelope, a reused nonce, a bad signature or a wrong catalog hash (moves 65-66);
- run while the fleet kill switch or the account's pause is active (move 78);
- uninstall or impair the security stack (`security.*`) — the single exception is `deprov.agents` inside a
  `deprovision` job with two-person approval (§7.6);
- build, enable or use the break-glass shell (move 74) — **not built** (D4, decided 2026-10-31: defer, do not build);
- send unredacted secrets or personal data in results or evidence (redaction before egress and before caps);
- re-run a non-idempotent action without its lease and idempotency key (moves 60, 70);
- skip technician confirmation while its type is in confirmed-plan mode. **All types start technician-confirmed** (D2, decided 2026-10-31): a type flips to unattended only after 30 days on DE-internal devices with zero incidents, recorded as evidence.

Action families referenced below are the registered catalog IDs (`Register-DEAction`):
`order.*` `rescue.*` `net.*` `maint.*` `identity.*` `jumpcloud.*` `security.*` `apps.*` (`apps.<pkgId>`,
`apps.remove.<pkgId>`, `apps.m365.readiness`) `baseline.*` `browser.*` `branding.*` `ops.*` `plan.*` `deprov.*`.
Attributes that carry weight: `Destructive`, `RequiresElevation`, `RequiresSecrets`, `Gates`.

### 7.1 `audit` — read-only check (enable first)

| | |
|---|---|
| **ENABLE** | The read-only halves — `Detect`, `Compare`, `Verify` — of **every** registered action family: `order.*` `net.*` `maint.*` `identity.*` `jumpcloud.*` `security.*` `apps.*` `baseline.*` (incl. `baseline.cis-audit`) `browser.*` `branding.*` `ops.*` `plan.*` `deprov.data-preserved`. |
| **DENY** | `Apply`, `Remediate`, `Rollback` of every action. An audit job changes nothing: an unknown state reports `unknown`, never a fix. |
| **Secrets** | None in the envelope. A `Detect` that needs a secret it does not have records `unknown`, and never fails open. |
| **Evidence** | Redacted inventory delta and report only; capped; PII fields per moves 91-92. |
| **Approval** | None to run; results visible inside the account scope only. |
| **Enable when (moves)** | 59, 60, 61, 62, 63, 65, 66, 67, 68, 69, 70, 71, 75, 78 + this document. |

### 7.2 `maintenance` — reversible upkeep

| | |
|---|---|
| **ENABLE** | `maint.*` (`pending-reboot` `hardware` `windows-update` `oem` `update-authority` `bitlocker-resume` `warranty`), `net.*` (`connectivity` `time` `sase` `site`), `ops.*` (`backup` `email-security` `mfa` `remote-support`), `browser.*` (`default` `extensions` `firefox` `login-manager` `policy` `updates`), non-destructive `apps.<pkgId>` installs/updates, and `security.*` **install/repair only** (keeping the stack healthy is maintenance). |
| **DENY** | `identity.*` (all — identity work belongs to provision/takeover/deprovision), `jumpcloud.*`, `branding.*`, `baseline.*` changes, `apps.remove.*` (`Destructive`), `deprov.*`, `rescue.*`, `plan.*`, and removal of any `security.*` component (global list). |
| **Secrets** | `RequiresSecrets` actions (`S1_SITE_TOKEN`, `GUARDZ_ORG_KEY`, ...) resolve locally at run time — technician input or vault. **Never in the job envelope.** |
| **Order rules** | Nothing that needs a restart runs on top of a pending reboot (`maint.pending-reboot` gate first). Anything user-visible asks the user first ("Not now" is honoured). |
| **Approval** | None per job for non-destructive work; every applied action records its provenance: jobId, `issuedBy`, action id + version, result. |
| **Enable when (moves)** | 7.1's list + 72 (signed install/upgrade/uninstall) + 76 (Hub-down test) + the D2 rule (technician-confirmed first; unattended only after 30 incident-free days on DE-internal devices, evidenced). |

### 7.3 `provision` — new / dropship build-out

| | |
|---|---|
| **ENABLE** | `order.*`, `net.*`, `maint.*`, `jumpcloud.*` (`agent` `user-mapping` `bind-user` `usergroup.*` `group.*` `policies` `go-extension` `device-trust`), `security.*`, `apps.*`, `baseline.*`, `browser.*`, `branding.*`, `ops.*`, `plan.*`, and the protect stage of `identity.*`: `identity.bitlocker` `identity.bitlocker-backup` `identity.breakglass` `identity.breakglass.verify` `identity.onedrive` `identity.hello`. |
| **DENY** | The takeover-only identity steps: `identity.migrate` `identity.verify-migration` `identity.hello-reset` `identity.entra-leave` `identity.mdm-cleanup`; `deprov.*`; `rescue.*`; `apps.remove.*` except when the client profile's `apps.remove` list names the package **and** the job carries per-job approval (D5). |
| **Order rules (enforced, not advisory)** | `order.verify-device` (dropship) -> `net.connectivity` / `net.time` -> `maint.pending-reboot` -> `jumpcloud.agent` -> BitLocker encrypted with the recovery password escrowed and proven (`identity.bitlocker` / `identity.bitlocker-backup`) -> everything else -> `apps.m365.readiness` last. |
| **Approval** | `Destructive` actions (`apps.remove.*`) need a second approver per job (D5, decided 2026-10-31). **While DE has one person, destructive jobs are not run through the agent at all — hands-on only.** Mass-impact jobs (10+ devices) need a person's approval even from the catalog. |
| **Enable when (moves)** | 7.2's list + 77 (queue load test) + the D5 rules (second approver exists, or the destructive families run hands-on). |

### 7.4 `takeover` — the full takeover runbook (highest impact)

| | |
|---|---|
| **ENABLE** | Everything `provision` enables, plus `identity.migrate` `identity.verify-migration` `identity.hello-reset` `identity.entra-leave` `identity.mdm-cleanup`. |
| **DENY** | `deprov.*`; `rescue.*`; `apps.remove.*` except per profile + approval; security removals (global list). |
| **Order rules (the hard ones)** | Protect -> migrate -> leave: `identity.bitlocker-backup` **verified outside Entra before** `identity.entra-leave` ("leaving Entra can take the only copy of the recovery key with it"); `identity.verify-migration` **before** `identity.hello-reset` and the leave steps; a `rescue.handoff` for another device or one failing its contract is investigated, never marked reviewed. |
| **Approval** | Every `identity.*` apply step is in the destructive family (D5, decided 2026-10-31): named technician on the job **and** a second approver; before/after evidence recorded for each. **While DE has one person these run hands-on at the device, not as agent jobs.** |
| **Enable when (moves)** | 7.3's list + 75/78 proven + the D1 order + reviewer-key pinning in place (D3, decided: two offline hardware keys — primary + backup YubiKey, both held by Joe) + the D2 rule. |

### 7.5 `rescue` — rescue coordination

| | |
|---|---|
| **ENABLE** | `rescue.*` (`rescue.handoff` review marking and rescue-stage detection), read-only `maint.hardware` / `net.connectivity` / `identity.bitlocker` **detect**, and evidence upload of the handoff and its recommendations. |
| **DENY** | Every `Apply` other than marking a valid handoff reviewed; any BitLocker recovery-password handling beyond the rescue's own typed prompt (which stores nothing); every other family. If a `rescue`-kind job is ever consumed by the WinPE side, it arrives **signed on the rescue media**, never from the network — the rescue does not call home. |
| **Enable when (moves)** | 7.1's list (the review half can ship with `audit`). |

### 7.6 `deprovision` — remove DE management (enable last)

| | |
|---|---|
| **ENABLE** | Only `deprov.agents` `deprov.branding` `deprov.breakglass` `deprov.data-preserved` `deprov.jumpcloud` (the tool's own rule: deprovision runs only the `deprov.*` actions that name it), plus read-only `Detect` of anything else for the final report. |
| **DENY** | All other `Apply`; `identity.*`; security removals outside `deprov.agents`; anything touching client data. `deprov.data-preserved` **must verify data is preserved before any destructive step runs**. |
| **Order rules** | Verify data preserved -> remove DE agents (incl. the DE-deployed security stack, `deprov.agents`) -> remove DE branding and break-glass -> leave the client a local administrator -> final read-only audit snapshot as evidence. |
| **Approval** | **Two people for every destructive action** (D5, decided 2026-10-31); the job carries the ticket. **While DE has one person, `deprovision` destructive steps are hands-on only — the agent does not run them.** |
| **Enable when (moves)** | All of the above + 75, 78 + the D1 order + the D5 rules (second approver exists, or the destructive steps run hands-on). |

### 7.7 Enable order (decided: Joe, 2026-10-31)

| Order | Type | Risk | Why here |
|---|---|---|---|
| 1 | `audit` | Read-only | Proves identity, signing and refusal paths with no blast radius |
| 2 | `maintenance` | Reversible, local | Proves the write path on low-risk actions |
| 3 | `rescue` | Read + review | Ships beside `audit`; the rescue itself is already safe offline |
| 4 | `provision` | Write, new devices | Write path on devices with no client history to lose |
| 5 | `takeover` | Write, identity | Highest impact; only after the protect-first invariants are tested |
| 6 | `deprovision` | Destructive | Only with the D5 rules (two-person approval; hands-on while DE has one person) |

## 8. Move map — what section E must deliver, and the threat it answers

| Move | Delivers | Threats answered |
|---|---|---|
| 59 | `de.techconsole.job/v1` finalised + device validators (signature, expiry fields required) | T1, T6, E1 |
| 60 | Hub job-queue endpoints: lease, acknowledge, result | D1, R1, T1 |
| 61 | One-time enrolment token exchange | S1, R4 |
| 62 | Per-device client certificates in the Hub; revocation | S3, I4, E5 |
| 63 | mTLS on the agent connection | S2, I3 |
| 64 | Certificate rotation | S3, E5 |
| 65 | Job signature verification on the device, incl. expiry | S2, S4, T1 |
| 66 | Replay store of nonces on the device | S4 |
| 67 | Reject any action ID not in the signed local catalog | T2, E1 |
| 68 | Windows service skeleton, no actions yet | TB2 baseline; the least-privilege start |
| 69 | Heartbeat and inventory deltas | D1, I5 |
| 70 | Evidence upload: resumable, idempotent | D1, T4, R1 |
| 71 | Offline evidence queue, size-bounded, never silently dropped | D3, I1 |
| 72 | Install / upgrade / uninstall of the agent, each signature-checked | T3, D6 |
| 73 | **This document** | Gates all of the above and every enable below |
| 74 | Break-glass shell — **deferred: not built** (D4, decided 2026-10-31) | E4 answered by decision |
| 75 | Stolen device key revocation stops the agent | S3, E5 |
| 76 | Hub unreachable: local functions still run | D3 |
| 77 | Load-test the Hub job queue | D1 |
| 78 | Fleet kill switch for all agent jobs | D5, E5 |

## 9. Hub-side alignment

- **Reuse the C1-C21 pattern** from Intelligence-Hub `docs/ENDPOINT-AGENT-SECURITY.md` wherever the Hub implements this
  agent's control plane: nonce-per-request (C1), enrolment token hygiene (C2), job seals with auto-pause (C3), pinned
  keys (C4), once-only delivery ledger (C5), parameters never inside script text (C6), two-person approval (C7),
  mass-impact thresholds (C8), redact on both sides with output caps (C9), never write into user-controlled paths
  (C10/C11), signed updates with self-test (C13), state ACLs (C14), tokens on stdin not argv (C15), audit everything
  (C16), stdlib-only supply chain (C17), pending-device approval (C18), per-device rate limits (C19), alerts on
  refusals (C20), reviewer-key pinning (C21).
- **Job key custody (A6):** the same tier-0 treatment as the Hub's job key — two-person ceremony (Hub SOP-1), rotation
  yearly / on departure / on suspicion (SOP-2), kids recorded and keys never pasted into chat, tickets or AI tools.
  JOE DECISION D7 (decided 2026-10-31): env file + SOP-1 ceremony now; a managed KMS/HSM before general
  availability, target Q1 2027.
- **The de-sync HMAC envelope stays** for technician-initiated sends (device record, warranty, rescue handoff). Agent
  traffic uses per-device mTLS and signed jobs. The shared secret (A8) is never accepted as an agent credential.
- **ADR 0022 applies to the operators.** AI agents and tooling that can change the Hub are adversary-5 class: task-scoped
  expiring credentials (C1), side-effect ledger (C2), PR review, DE approves every merge, and the rules in
  ENDPOINT-AGENT-SECURITY §5 ("Never / Always") hold for every contributor to these repos.

## 10. Evidence, secrets and privacy (agent-side rules)

- Secret-shaped keys are refused by contract; secret-named keys are **dropped before validation** (existing
  `Remove-DEContractSecretKeys` rule), never sent as `[REDACTED]`.
- Redact on the device before egress **and** before the output cap, so a secret crossing the cap is still whole (C9).
- Results are capped; the offline queue is size-bounded and reports what it holds (71).
- PII fields are classified (91) and redacted before upload (92): results carry state, not people.
- Evidence reads are logged at the Hub (94). Retention (93) applies Joe's periods (D6, decided 2026-10-31): raw
  device evidence **13 months**, audit logs and compliance reports **6 years** (HIPAA documentation retention).
- BitLocker recovery passwords never reach jobs, logs, state or receipts (14); the rescue prompts and stores nothing.

## 11. Detection and response hooks

- **Refusals are data.** Every refused job or action is recorded as the job result and raises a security event, rate-limited
  per signal so a looping device cannot flood inboxes (C20 pattern).
- **Kill switch (78):** fleet-wide and per-account pause; any staff member can stop delivery, only an owner_admin resumes;
  when the pause state cannot be read, nothing is delivered (fail closed).
- **Revocation (75):** a revoked device certificate stops the agent. Tested, not assumed.
- **Hub down (76):** local functions keep running; queued evidence uploads later.
- **IR cross-refs:** Hub-side incidents follow ENDPOINT-AGENT-SECURITY §4 (IR-1 pause everything, IR-2 job key rotation,
  IR-3 release key, IR-4 rogue device, IR-5 lost laptop, IR-6 bad script, IR-7 alerts). Device-side add-ons here: revoke
  and re-enrol rather than patch in place; after any suspected job-key compromise, review every delivered job by
  `payloadSha256` and device before resuming.

## 12. Decisions for Joe — decided 2026-10-31

Marked **JOE DECISION** where they appear above. Joe made all eight on 2026-10-31 (via Claude, on Joe's explicit
authority); the **Decision (Joe, 2026-10-31)** column is the answer section 7 now follows.

| ID | Decision | Gates | Recommendation in this doc | Decision (Joe, 2026-10-31) |
|---|---|---|---|---|
| D1 | Enable order of the six job types | All of §7 | Adopt §7.7: audit -> maintenance -> rescue -> provision -> takeover -> deprovision | **Adopt the §7.7 order.** |
| D2 | Do remote jobs run unattended, or does every job stay a technician-confirmed plan at first? | maintenance, provision, takeover | Start technician-confirmed (that is what `job.schema.json` says today); flip per type after a probation period on DE-internal devices | **Technician-confirmed first.** A job type flips to unattended only after 30 days on DE-internal devices with zero incidents, recorded as evidence. |
| D3 | Pin reviewer keys on client builds (C21 pattern: a job runs only with an offline reviewer's signature over the script hash)? | takeover, deprovision | Adopt once two reviewer keys exist; it is what stops an adversary-3 Hub compromise from running new code | **Adopted.** Reviewer-key pinning with two offline hardware keys (primary + backup YubiKey), both held by Joe. |
| D4 | Build the break-glass shell at all (move 74)? | none - it is never a job type | Defer; if built: disabled by default, just-in-time approved, time-limited, fully transcripted, and never reachable from a job | **Defer. Do not build the break-glass shell.** Move 74 is answered by this decision. |
| D5 | Approval thresholds: which families are "destructive", the second-person rule, the typed self-approval phrase, and the mass-impact number of devices | provision, takeover, deprovision | Destructive = `identity.*` applies, `apps.remove.*`, `deprov.agents`, security removals; second approver for each; mass impact at 25 devices (the C8 number) | **Destructive families as recommended; second approver required.** While DE has one person, destructive jobs are **not** run through the agent (hands-on only). Mass impact = **10 devices**. |
| D6 | Retention periods for device evidence (moves 9 / 93) | evidence handling | Already open as move 9 (schedule gate J8); until set: bounded queues, no silent deletion | **Raw device evidence 13 months; audit logs and compliance reports 6 years** (HIPAA documentation retention). This also answers move 9 (#727, noted there). |
| D7 | Job-key custody: environment file now, KMS/HSM when? (Hub R1) | E5 residual risk | Env file with SOP-1 ceremony now; KMS/HSM on the roadmap, target before general availability | **Env file + SOP-1 ceremony now; managed KMS/HSM before general availability, target Q1 2027.** |
| D8 | Where agent security alerts are sent (the `ENDPOINT_ALERT_EMAIL` equivalent) | detection (§11) | A DE-attended mailbox, named by Joe | **`security@digeratiexperts.com`** (Joe to confirm the Zoho alias exists). |

## 13. Change control

- A PR that enables a job type cites this document and shows the §7 checklist rows for that type met.
- A new action family is added to the §7 lists in the same PR that registers it.
- Weakening any rule here needs DE approval, recorded in the same PR, the way the installer-trust policy was confirmed
  in writing (move 6).
- This document is a plan document of the 104-move plan (tracker row, move 73) and gates section E exactly as
  INSTALLER-TRUST-POLICY.md gates section C.

## 14. Sources

- [DE-TECH-TOOL-ARCHITECTURE.md](DE-TECH-TOOL-ARCHITECTURE.md) — components, call-home design, job security, transport,
  updates; `console/contracts/job.schema.json` (kinds, action ID shape, "a job is only a plan the technician confirms").
- [PROTECTING-THE-TOOL.md](PROTECTING-THE-TOOL.md) — licence, watermark, revocation, tamper reporting.
- [INSTALLER-TRUST-POLICY.md](INSTALLER-TRUST-POLICY.md) — installer trust (section C gate).
- `console/catalog/runbook.json` and `Register-DEAction` (DE.Core) — the action universe, gates, `Destructive`,
  `RequiresSecrets`, `RequiresElevation`, and the deprovision-only rule.
- Intelligence-Hub `docs/ENDPOINT-AGENT-SECURITY.md` — assets/adversaries and controls C1-C21, SOPs, IR runbook.
- Intelligence-Hub `docs/adr/0022-provider-independent-ai-operations.md` — operator/agent class, scoped credentials,
  side-effect ledger, DE merge approval.
- [DE-TECH-TOOL-TRACKER.md](DE-TECH-TOOL-TRACKER.md) — moves 59-78 and their issues.

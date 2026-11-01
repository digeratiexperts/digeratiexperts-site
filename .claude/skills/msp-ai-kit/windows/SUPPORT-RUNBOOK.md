# DE Tech Tool support runbook

**Move 101** of the 104-move plan ([issue #819](https://github.com/digeratiexperts/digeratiexperts-site/issues/819)).
Every failure the tool reports maps to a fix here. The tool itself always prints the fix beside the finding
(`fix: ...` in the log, the Job page and the gap report); this runbook is for when the message is not enough.

**Who uses it:** technicians first, DE engineering second. If a row says *DE engineering*, export a diagnostic
bundle (`Export-DEDiagnosticBundle`, move 97) and send it — it carries no secrets by design.

## 1. Reading a run

| Result | Meaning | What it asks of you |
|---|---|---|
| `PASS` | Applied and verified, or already in desired state | Nothing |
| `NO CHANGE` | Already in desired state | Nothing |
| `INFO` | Recorded for the record (bundles, sends) | Nothing |
| `SKIPPED` | The technician skipped the step | Confirm that was deliberate |
| `PLANNED` | A plan-only (`-WhatIf`) run: nothing was changed | Run in Apply mode to do the work |
| `WARN` | Done or checked, but with a caveat | Read the detail; usually a "fix" line follows |
| `FAIL` | A change was attempted and did not verify | Follow the fix; the step retries (3 attempts) and then rolls back where a rollback exists |
| `BLOCKED` | A gate refused the step before anything ran | Clear the gate named in the detail, then rerun |
| `EXCEPTION` | Drift exists under an approved, time-limited exception | Nothing today; the exception expires and the drift will need fixing then |

**Headless exit codes** (RMM and first boot read these): `0` done · `1` not finished · `2` blocked or refused.
The run also writes a result file (`-ResultFile`, schema `de.techconsole.result/v1`) whose `overall` is
`DONE` / `NOT READY` / `BLOCKED` / `REFUSED` / `ERROR` — read the outcome from the file, never from stdout.

## 2. Failure to fix

### Licence and build

| Symptom | Cause | Fix |
|---|---|---|
| `no DE licence for this change` / `allowed under policy 'warn': no licence on this device` | The device is not activated | Settings > Licence: activate this device with the DE account. A release build flips the policy to `required`, so this blocks there. |
| `this licence is for DE Tech Tool build ... and this copy is build dev` (`wrong-build`) | The licence is pinned to another build (`bid`) | Run the build it was issued for, or activate this copy again |
| `the licence for <tech> does not include '<feature>'` | The licence covers other features | Activate with an account that holds the feature (apply, toolbox, rescue, msadmin) |
| `signature does not verify` | The licence file was edited or truncated | Remove the licence and activate again |
| Licence rejected though valid | It is on the revocation list (lost device, departure) | Expected. If that is wrong, DE engineering checks the Hub revocation entry |
| Clock-back licence refusal | The machine's clock moved behind the latest time the tool has seen | Fix the clock (see `net.time`), then rerun |

### Integrity and tampering

| Symptom | Cause | Fix |
|---|---|---|
| `console.integrity: FAIL` / `tampered` | A file changed after packaging, or a file is missing from `integrity.json` | Do not run changes from this copy. Re-download the signed package and compare its sha256 |
| `not in integrity.json (added after packaging)` | Someone added a script to the installed tree | Remove it or rebuild through `packaging\Sign-DETechConsole.ps1`; never hand-edit an installed copy |
| `integrity.json is missing from a signed build` | The manifest was deleted | Reinstall the signed release; treat as tampering until proven otherwise |
| `Unsigned development build` | A dev checkout or unmarked build | Fine for development; use the signed release for client work |
| Update/deploy `sha256 mismatch` (exit 3) | The downloaded package does not match the expected hash | Nothing is installed by design. Re-download; if it repeats, the mirror or the hash is wrong — DE engineering |
| Update/deploy `integrity or signature verification failed` (exit 3) | The package's content does not match its manifest | Do not install. Report to DE engineering with the package name and hash |

### Orders and gates (dropship)

| Symptom | Cause | Fix |
|---|---|---|
| `REFUSED: wrong device` / `wrong device for order ...` | This machine is not the one on the order | Compare the chassis serial with the order. A different unit shipped: update the order manifest (serial) before provisioning. The safety gate cannot be overridden by an approval |
| `order.verify-device: BLOCKED (serial typed at the device did not match)` | A mistyped serial | Type it from the sticker; the report names both serials |
| `serial '...' is not usable as a device key (blank or an OEM placeholder)` | WMI reports a placeholder (To be filled by O.E.M., Default string, ...) | Type the serial from the chassis sticker; the device key refuses placeholders by design |
| `gate.order-match` or another gate `BLOCKED` | A prerequisite is not met | The gate's `Unblock` line says exactly what clears it; gates marked safety gates refuse even approved exceptions |
| `REFUSED: cannot read profile ...` | The profile file is not valid JSON | Fix or re-issue the profile (dropship kits carry `profile.json` beside the tool) |
| `REFUSED: -Headless needs -Client ...` | No client, profile or order was named | Pass `-Client <id>`, `-ProfileFile` or `-Order` |

### Hub sends and records

| Symptom | Cause | Fix |
|---|---|---|
| `saved for manual upload (no Hub endpoint configured)` | Settings has no Hub URL | Set the Hub connection in Settings (see GO-LIVE.md) |
| `saved for manual upload (no Hub token this session)` / no signing secret | The runtime secret is missing this session | Enter `DE_HUB_SIGNING_SECRET` at run time (never stored), then send again |
| `the client profile has no hub.accountId` | The client is not mapped to a Hub account | Set `hub.accountId` in the client profile |
| `Hub refused: account not mapped` (or another Hub reason) | The Hub declined the record; the reason is the Hub's own | Fix what the reason names (usually the account mapping); the refused payload is kept in evidence for manual upload |
| `the record has no usable serial, so it has no device key` | Placeholder or missing serial | Fix the serial first (see above) |
| `left out secret-named field(s): ...` | A record carried secret-looking keys | Good outcome (they were dropped before sending). Find the source of the key name and stop putting it in notes |
| `warranty lookup` sends nothing | No confirmed answer (unknown / manual / failed) | Nothing wrong: the Hub keeps one warranty per device, so "not known" would replace a real one. Record the end date from the maker's page and send again |

### Identity, security and apps

| Symptom | Cause | Fix |
|---|---|---|
| `identity.breakglass.verify: FAIL (credential check)` | The break-glass account was never signed into | Sign in with it once (the password is set at apply time and not stored) |
| `two EDRs on one device fight each other` (`security.edr-conflicts`) | A previous security tool remains | Remove the old one per the plan; the new agent install follows |
| `security.*: FAIL (install)` | Installer failed or the agent did not start | Read the step's verification line; run the installer by hand once to see its own error; check the network egress |
| App install `exit 3010` reported as PASS | The installer asked for a restart | Restart; the step re-checks after |
| `restart required ... resume: <action>` | A change needs a restart to finish | Restart the device; the console resumes where it left off |
| `configuration needs a reviewed recipe` | App configuration without a reviewed recipe | By design: no installer runs. Review and register the recipe (DE engineering) |

### Storage, evidence and logs

| Symptom | Cause | Fix |
|---|---|---|
| `evidence bundle contained a registered secret and was withheld` | Redaction missed a form and the sweep caught it | The bundle was deleted, nothing leaked. Report it as a console bug to DE engineering (this is a safety net doing its job) |
| `state file unreadable ... kept as <file>.corrupt-...` | The state file broke | The old file is preserved aside; the run continues clean. Send the corrupt file to DE engineering if the cause matters |
| `state contains a secret-like key name; scrubbed before write` | Something wrote a secret-shaped key into state | Find the source (usually a pasted value in a note field); the scrub already protected the file |
| Log files piling up / one log enormous | — | Fixed by move 98: logs rotate at 5 MB (`settings.log.maxBytes`) and old sessions prune at startup (`Invoke-DELogPrune`); tune in state if a site needs more |
| `diagnostic bundle` export refuses | Same secret sweep as evidence | Same as above: report as a console bug |

### Warranty

| Symptom | Cause | Fix |
|---|---|---|
| `status: unknown` | The lookup could not say | Open the maker's check page and record the end date (`maint.warranty` records who recorded it) |
| `status: manual` | No public API for the maker | Expected for most makers; use the check page |
| `not-applicable` | Virtual machine | Expected |
| The lookup silently degraded to `manual` | A vendor page moved or changed shape | Run `windows/tests/Invoke-WarrantyEndpointCheck.ps1`; if a vendor endpoint changed, update `catalog/warranty.json` and `-Update` the snapshot after review |

## 3. When to escalate to DE engineering

- Anything this runbook maps to *DE engineering* above.
- Any `tampered` status on a copy that should be pristine.
- The secret sweep withholding a bundle (it means redaction missed a form).
- A failure that repeats after the fix here.
- Anything about client data leaving the device.

Send: the diagnostic bundle (`Export-DEDiagnosticBundle`), the device key (`<maker>:<SERIAL>`), the
ticket, and what the runbook row said. Never send secrets, licence tokens or recovery keys by email —
the bundle and the tool already redact them, keep it that way on your side too.

## 4. Related documents

- [README-WINDOWS.md](README-WINDOWS.md) — how the tool works, page by page.
- [GO-LIVE.md](GO-LIVE.md) — the Hub setup in order (endpoint, secrets, account mapping).
- [PROTECTING-THE-TOOL.md](PROTECTING-THE-TOOL.md) — licences, watermarks and tamper reporting.
- [INSTALLER-TRUST-POLICY.md](INSTALLER-TRUST-POLICY.md) — why some installers are pinned or refused.
- [AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md) — what the tool is designed never to do.

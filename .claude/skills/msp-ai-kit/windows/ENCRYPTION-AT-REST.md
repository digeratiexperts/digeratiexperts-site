# Encryption at rest: local state and evidence

Move 95 of the [104-move tracker](DE-TECH-TOOL-TRACKER.md); section H (sensitive data). An assessment,
not a change: what the tool writes to disk, what protects it, and what that leaves open.

**Verdict: nothing is encrypted at rest.** The protections are access control and *not writing the
sensitive thing at all* — which is a defensible design, but it is not the same thing, and the
difference matters if a device is imaged or stolen.

## What is written, and where

`Initialize-DEConsole` makes seven folders under the data root (`ProgramData\DE\TechConsole` on a
real device; a temp dir in tests):

| Folder | Holds | Format | Encrypted |
|---|---|---|---|
| `state\` | per-machine state, `*.json` | plain JSON | **no** |
| `evidence\` | evidence bundles, reports, receipts, `.zip` | plain | **no** |
| `logs\` | `techconsole-*.log` | plain text | **no** |
| `profiles\` | client profiles | plain JSON | **no** |
| `packages\` | staged installers | binaries | **no** |
| `backups\` | prior state | plain | **no** |

## What protects it

**1. An explicit ACL, applied once.** `Protect-DEDataFolder` in `DE.Core.psm1` runs:

```
icacls <path> /inheritance:r /grant:r *S-1-5-18:(OI)(CI)F *S-1-5-32-544:(OI)(CI)F /T /C /Q
```

SYSTEM (`S-1-5-18`) and Administrators (`S-1-5-32-544`) get full control, inheritance is removed,
nobody else gets anything. A `.acl-v1` marker stops it running twice.

**2. The sensitive values are never written.** Runtime secrets are `SecureString` held in memory
(`Set-DESecret`) and cleared on exit (`Clear-DESecrets`). They are registered for redaction the
moment they arrive, so anything that *is* written has already had them stripped.

**3. Redaction runs before every write.** `Protect-DEText` on log lines, `Remove-DESecretKeys` on
state, `Remove-DEPersonalFields` on anything heading to the Hub (move 92). BitLocker recovery
passwords, AWS keys, JWTs and bearer tokens are replaced by shape, not only by name.

**4. The evidence bundle refuses to ship a leak.** `Export-DEEvidenceBundle` deletes the zip and the
folder if a registered secret is found anywhere in it, and says so.

## What that leaves open

| # | Gap | Why it matters | Severity |
|---|---|---|---|
| 1 | **Nothing is encrypted.** Anyone who can read the files can read them | An offline image, a stolen laptop, or a backup copies state, evidence and logs verbatim | **High** |
| 2 | **The ACL is fail-open.** If `icacls` fails the tool logs a WARN and carries on | The protection is then absent and nothing stops working to tell you | **High** |
| 3 | **The ACL only applies under `ProgramData`, elevated, on Windows.** | A portable run, a test dir, or a non-elevated session gets no protection at all | Medium |
| 4 | **A local administrator reads everything regardless** | The ACL grants Administrators full control. That is unavoidable for a tool that must elevate | Accepted |
| 5 | **The `.acl-v1` marker means the ACL is not re-checked** | If permissions are later loosened, nothing notices | Low |

### On gap 2 specifically

`Protect-DEDataFolder` does:

```powershell
if ($r.ExitCode -eq 0) { <write marker> } else { Write-DELog -Level WARN -Message "data folder ACL not set..." }
```

A warning is the wrong shape for a security control. This is the same class of finding as move 17's
licensing audit: a security property that silently degrades. It should at minimum be visible in the
run's readiness, and arguably block an Apply run.

## What is actually in these files

From [EVIDENCE-DATA-CLASSIFICATION.md](EVIDENCE-DATA-CLASSIFICATION.md), after move 92:

- **device** — serial, model, asset tag. Identifies an asset, not a person.
- **personal** — withheld from the Hub, but **still present in local evidence**, which is correct:
  the local bundle is the technician's record of what was on the machine.
- **path** — leaf names only in Hub payloads; full paths can still appear locally.

So local state and evidence carry **client names, serials, control results and user names** — real
sensitivity, just not credentials.

## Recommendations

Ordered by what buys the most.

1. **Make the ACL failure loud.** A missing ACL should surface in the readiness result and the
   headless `RESULT` line, not only in the log. Cheap, and it closes gap 2.
2. **Re-check the ACL, not just the marker.** Verify the granted rights on start rather than trusting
   `.acl-v1`.
3. **Consider EFS or BitLocker-scope the data folder.** On a BitLocker-protected OS volume the data
   is already protected at rest *when the machine is off* — which is the realistic theft case. That
   is worth stating in the evidence bundle rather than building new crypto.
4. **Do not roll your own encryption.** If at-rest encryption is required beyond BitLocker, use
   DPAPI (`Protect-CmsMessage` with a machine cert, or `ConvertTo-SecureString` with the Windows
   store). Hand-rolled AES with a key beside the data is worse than nothing.

## The honest summary

For the realistic threat — a laptop with BitLocker on, powered off, lost or stolen — the data is
protected by full-disk encryption and the tool does not weaken that. For the threat of *another
process or user on a running machine*, the ACL is the only thing standing in the way, and it fails
open. That is the gap worth closing first.

## Not in scope here

- **Move 93** (retention periods) waits on Joe's decision, move 9. Encryption and retention are
  different questions: this is about who can read the files, that is about how long they exist.
- **Hub-side storage.** What the Intelligence Hub does with the data it receives is its own
  assessment; move 92 governs what is sent.

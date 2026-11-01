# Installer trust - what the tool checks, and what a refusal means

Move 46 of the [104-move tracker](DE-TECH-TOOL-TRACKER.md) ([#764](https://github.com/digeratiexperts/digeratiexperts-site/issues/764)).
The short version of [INSTALLER-TRUST-POLICY.md](INSTALLER-TRUST-POLICY.md) for technicians on a
client device. The policy is the rule; this page is what the rule looks like while you work.

## Before the tool runs any installer

1. **It only uses sources we recorded.** Every installer comes from the vendor's own download host
   or from a file DE supplied. The address is in the catalog (`console\catalog\packages.json`);
   nobody types a download link at run time. No mirrors, no "I found it on...".
2. **It checks the file's fingerprint (sha256).** The catalog records what the file must hash to.
   Before anything runs, the tool hashes the file and compares. A mismatch is a refusal - always.
3. **It checks the signature when the vendor signs.** If the vendor signs their installer, the
   signature must be valid and be the vendor we expect. A broken signature where the vendor signs
   is treated exactly like a wrong fingerprint.
4. **winget installs are winget's trust.** For winget packages we record the package id and say
   plainly that we did not see a hash (rule R8). We never pretend to have verified something we
   did not see.

## The two labels you will see on a hash

| Label | What it means | What it does NOT mean |
|---|---|---|
| `vendor-published` | the vendor publishes this exact hash for this exact file | - |
| `pinned-first-download` | the vendor publishes no hash, so we downloaded (or were handed) the file once over TLS, recorded its hash, and check every later use against it | it cannot catch a file that was already wrong the very first time - that is why it is labelled |

DE-supplied installers (SentinelOne, Guardz, Blackpoint SNAP, MSP360, Timus, the PABX script) are
hashed the moment they are handed over, before first use (rule R9). "DE supplied it" is not a
trust argument - the file is fingerprinted like everything else.

## When the tool refuses an installer

You will see a message like:

```
trust policy refused JumpCloud Agent : sha256 mismatch (have 3f2a..., want 9c81...). The refused
download was deleted (R3). This refusal is not overridable (R3/R4)
```

What to do:

- **Read both hashes.** The message always says what the file hashed to (`have`) and what the
  catalog expects (`want`). That pair is the whole story: the file is not the file we recorded.
- **A refused download is deleted on purpose.** Do not go looking for it in the cache - it is gone
  so nobody runs it by hand.
- **Some refusals cannot be overridden at all** (a wrong fingerprint, or a broken signature where
  the vendor signs). There is no "continue anyway" - and there is deliberately no way to add one.
- **Other refusals can be overridden with a reason** (for example a vendor who does not sign and
  has no hash recorded yet). The tool records who checked the file and how, as a warning in the
  evidence - it never records the install as a PASS on trust grounds.
- **Still stuck?** Stop and escalate to DE engineering with the message text and the client name.
  A refusal is the tool working, not the tool broken.

## What never happens

- The tool never installs a file whose fingerprint or signature failed.
- It never "warns and continues" past a mismatch.
- It never falls back to a different download site.
- **Nobody edits the catalog to make a refusal go away** (rule R10). When a package legitimately
  changes, its record is updated in a reviewed change citing the vendor's own published value -
  never edited to match whatever file we happen to have.

## Where the full records live

- The policy, in full: [INSTALLER-TRUST-POLICY.md](INSTALLER-TRUST-POLICY.md)
- Every installer source and its record: [INSTALLER-SOURCES.md](INSTALLER-SOURCES.md)
- The weekly automated re-check: `tests\Invoke-InstallerSourceRecheck.ps1` - if a vendor silently
  changes a file, this is what raises it

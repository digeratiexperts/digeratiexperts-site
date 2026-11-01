# Evidence data classification

Move 91 of the [104-move tracker](DE-TECH-TOOL-TRACKER.md); section H (sensitive data). What the tool
records about a device, and what it is allowed to hand to the Intelligence Hub.

The machine-readable source is `Get-DEEvidenceFieldClasses` in
`console/modules/DE.Evidence/DE.Evidence.psm1`. This document explains it. **If the two disagree, the
code is right and this is stale.**

## Why classify first

Redaction done by pattern-matching field names is guesswork that silently misses. Classifying once,
as a table, means every later decision - what the Hub gets, what a client report shows, what is
retained - refers to the same four answers instead of inventing its own.

## The four classes

| Class | Meaning | Goes to the Hub? | Examples |
|---|---|---|---|
| **device** | Identifies the machine | **Yes** | `serial`, `model`, `assetTag`, `hostname`, `manufacturer`, `deviceKey`, `role`, `os` |
| **personal** | Identifies a person | **No** | `assignedUser`, `localUserName`, `jumpcloudUser`, `email`, `endUserEmail`, `upn`, `displayName` |
| **path** | A filesystem path, which leaks a user name through its segments | **No** | `profilePath`, `profileDir`, `homeDir`, `documentsPath`, `userProfile`, `localAppData` |
| **operational** | State, timestamps, results - nothing identifying | Yes | `readiness`, `areas`, `controls`, `exceptions`, `warranty`, `status`, `result` |

### A deliberate exception: the technician name is ours

`technician` and `issuedTo` look personal but classify as **operational**. The build is watermarked
with who it was issued to, so a leaked copy names its source the first time it runs anywhere with a
network ([PROTECTING-THE-TOOL.md](PROTECTING-THE-TOOL.md)). Redacting them would break that.

The distinction is *whose* data it is. Section H is about the client's device data - the people who
use the machine. DE's own accountability record of which technician ran which build is a different
thing, and it is deliberately sent.

### Device fields are not optional

`deviceKey` is `<maker>:<SERIAL>`, and it is how the on-device tool, the boot rescue and the Hub all
name the same machine without talking to each other. Withholding it would break the three-component
contract in [DE-TECH-TOOL-ARCHITECTURE.md](DE-TECH-TOOL-ARCHITECTURE.md). Serials identify an asset
owned by the client, not a person - the same number is printed on the chassis sticker.

### Why personal fields go

The Hub manages **devices, not people**. The device record's job is "this machine, in this client,
at this site, with these controls verified". Which human was signed in when the audit ran is not
part of that, and it is exactly the sort of value that becomes a liability in a breach.

This is also what moves 12 and 13 established for client-facing output: the client report names no
vendors and carries no internal detail. The Hub is a DE system, so it sees more than a client does -
but still not the person.

### Why paths go

A profile path is a user name with extra steps. `C:\Users\jpetrovich\Documents\` identifies a person
more precisely than the `localUserName` field does, because it survives a rename. The leaf name of a
file is often still useful (`recovery-key.txt`); the directory path above it is not.

## The default is deliberate

An **unknown field classifies as `operational`** - it is *not* withheld. That is the safe direction
for this decision: a miss shows up in the output where someone can see it and add it to the table,
rather than silently dropping a field a reader needed. It is the opposite of the fail-closed default
in licensing (move 17), and the reason is that there a mistake permits an action, while here a
mistake hides information.

## What follows from this

| Move | Uses the classification to |
|---|---|
| **92** | Redact `personal` and `path` values from what goes to the Hub |
| 95 | Decide what encryption at rest must protect |
| 96 | Decide which vendors count as receiving device data |

## Keeping it honest

`SensitiveData.Tests.ps1` asserts every field name that actually appears on a device record resolves
to a class, that no name sits in two classes, and that an unknown name defaults to `operational`.
Adding a field to `New-DEAssetRecord` without classifying it fails the test.

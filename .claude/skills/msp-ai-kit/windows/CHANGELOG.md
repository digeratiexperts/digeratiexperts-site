# DE Tech Tool changelog

One entry per released version, newest first. Each entry links what shipped it: the pull request
where the work landed in this repository, or the commit that carried the version when it landed
without one — the releases up to 1.8.0 were pushed straight to `main` before this work moved to
pull requests.

The version of record is [`console/VERSION`](console/VERSION). `windows/tests/Changelog.Tests.ps1`
refuses to pass when the newest entry is not that version, so a release cannot ship without its
entry. Summaries come from the release notes in [`DE-TECH-TOOL-ARCHITECTURE.md`](DE-TECH-TOOL-ARCHITECTURE.md)
and the commit history.

## 1.11.0 — 2026-10-07 — [PR #529](https://github.com/digeratiexperts/digeratiexperts-site/pull/529)

The Intelligence Hub canonical identity/location/network standard v1.0.0 is projected into the tool
through `DE.Naming`: `firstname.lastname` internal users, `-ext` externals, `-admin`/`-priv`
privileged identities, `<CLIENT>-<ROLE>-<ASSET4>` hostnames, location as its own hierarchy, and
`/16` → `/20` → `/24` network plans only from a Hub-assigned block. Existing takeover identities
and networks stay explicit inherited exceptions.

## 1.10.5 — 2026-10-07 — [PR #523](https://github.com/digeratiexperts/digeratiexperts-site/pull/523)

The DE Windows baseline owns the pre-logon authorized-use / security-monitoring notice:
`windows.logonNotice` in each client profile selects DE standard wording, client-approved custom
wording, or disabled; the tool writes `LegalNoticeCaption`/`LegalNoticeText`, verifies exact
desired state, records the pre-DE values once, and restores them on rollback.

## 1.10.4 — 2026-10-05 — [PR #476](https://github.com/digeratiexperts/digeratiexperts-site/pull/476)

A headless run sends the warranty lookup to the Hub right after the device record
(`Send-DEHubWarranty`, same terms as the Evidence page button: only a confirmed answer; `-WhatIf`
sends nothing; a send that cannot happen is a WARN and never changes the exit code). Go-live checks
use the Hub devices panel.

## 1.10.3 — 2026-10-04 — [PR #438](https://github.com/digeratiexperts/digeratiexperts-site/pull/438)

The Evidence page's Send to Intelligence Hub sends the latest warranty lookup as its own signed
`device.warranty` event after the device record. Only a confirmed answer goes. DE Microsoft Admin
0.6.0: the Hub worker runs Exchange Online and Azure jobs unattended, signing in with the Graph
app's certificate only when such a job has verified, and posting a job it cannot sign in for as
Failed with what is missing.

## 1.10.2 — 2026-10-03 — [PR #426](https://github.com/digeratiexperts/digeratiexperts-site/pull/426)

Device and email migration sends record the Hub's own reason when it refuses ("Hub refused:
account not mapped"), shared with the boot rescue (`Get-DEHubErrorReason`), and the Evidence page
shows it. Secret-named keys in a device record are left out of what goes to the Hub instead of
being sent as `[REDACTED]`, which the Hub refused; local state and logs still keep them redacted.
`GO-LIVE.md` lists every production step in order.

## 1.10.1 — 2026-10-03 — [PR #405](https://github.com/digeratiexperts/digeratiexperts-site/pull/405)

The boot rescue sends its handoff to the Hub only with the client's Hub account number (asked at
the rescue prompt, or `-AccountId` on media made for one client); before this the Hub refused every
rescue send as "account not mapped". DE Microsoft Admin 0.5.0 adds the Hub job loop
(`Invoke-DEHubJobLoop`).

## 1.10.0 — 2026-10-02 — [PR #341](https://github.com/digeratiexperts/digeratiexperts-site/pull/341)

Licence follow-ups for the Hub licence service (Intelligence-Hub PR #310): the tool downloads the
Hub's revocation list into its protected data folder and refuses a licence revoked in it or in the
shipped `trust/revoked.json`; a licence pinned to a build (`bid`) works only in that build; a
licence survives a restart.

## 1.9.0 — 2026-09-29 — [PR #269](https://github.com/digeratiexperts/digeratiexperts-site/pull/269)

The company-branded lock screen as its own enforced step (image, users cannot change it, shown at
sign-in, Windows Spotlight off for every profile), and Hub connection and code signing in Settings.
DE Microsoft Admin 0.4.1.

## 1.8.0 — 2026-09-29 — [commit b4e8dd04](https://github.com/digeratiexperts/digeratiexperts-site/commit/b4e8dd04)

Device-bound Hub-signed licences and watermarked builds, the pinned Toolbox of proven MSP scripts,
the Command line page, and Windows PowerShell 5.1 support across the console.

## 1.7.0 — 2026-09-29 — [commit 8cc8c064](https://github.com/digeratiexperts/digeratiexperts-site/commit/8cc8c064)

Hub account mapping for signed device events: events carry the client's Hub account so the Hub can
route them without guessing.

## 1.6.0 — 2026-09-29 — [commit 0c88b03b](https://github.com/digeratiexperts/digeratiexperts-site/commit/0c88b03b)

Scan & fix becomes the main page: checkboxes, action buttons, and one plan-only/live switch.

## 1.5.2 — 2026-09-29 — [commit 3c673739](https://github.com/digeratiexperts/digeratiexperts-site/commit/3c673739)

Joe's review answers folded in.

## 1.5.1 — 2026-09-28 — [commit 6ed620ab](https://github.com/digeratiexperts/digeratiexperts-site/commit/6ed620ab)

Fixes from the function-by-function review.

## 1.5.0 — 2026-09-28 — [commit 63ffe11c](https://github.com/digeratiexperts/digeratiexperts-site/commit/63ffe11c)

ProActive and standalone plans, playbooks and dropship kits: one catalog
(`console/catalog/bundles.json`) of tiers, GCC High and Co-Managed variants, add-ons and solutions.

## 1.4.0 — 2026-09-28 — [commit 79249582](https://github.com/digeratiexperts/digeratiexperts-site/commit/79249582)

The console carries its own version (`console/VERSION`, shown in the window title) and the
one-file installer lands: `Install-DETechConsole.ps1`, with the console buttons crash-guarded.

# The DE Tech Tool moved

The DE Tech Tool (DE Technician Console, DE Microsoft Admin, boot rescue, plan playbooks,
packaging, dropship kits and their Pester suites) used to live here under `windows/`.
On 2026-11-05 it moved to the **private** repository
[`digeratiexperts/de-tech-tool`](https://github.com/digeratiexperts/de-tech-tool), with its full
commit history. Joe's decision: the tool runs elevated on client endpoints and should not sit in
the public website repository.

| You want to | Go to |
|---|---|
| Change, test or release the Tech Tool | `de-tech-tool`: `windows/` (same paths as before) |
| Plan, tracker, go-live, runbooks | `de-tech-tool`: `windows/DE-TECH-TOOL-TRACKER.md`, `windows/GO-LIVE.md`, `windows/SUPPORT-RUNBOOK.md` |
| Canonical identity / location / network projection | `de-tech-tool`: `windows/CANONICAL-IDENTITY-LOCATION-NETWORK.md` |
| Regenerate the tracker | `de-tech-tool`: `scripts/build-techtool-tracker.ps1` |
| The Windows AI Toolkit loader (`Install-MspAiKit.ps1`, `Start-MspAiKit.cmd`) | `de-tech-tool`: `windows/` |
| MSP / MSSP prompt packs (this skill) | Here: `kit.config.json`, `modules/`, `scripts/build.mjs` |

`de-tech-tool` carries its own copy of this kit at its root, because the release zip, installer
test and AI-pack loader expect `windows/` inside a kit folder. The copy here stays the source for
the website's agents; changes to `modules/` or `kit.config.json` that the Tech Tool should ship
need to be made in `de-tech-tool` too.

The website does not serve a Tech Tool download, so nothing on the site depends on the move.
Older commits of this public repository still contain the tool; see the removal PR.

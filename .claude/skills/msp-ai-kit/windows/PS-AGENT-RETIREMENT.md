# The PowerShell DE Tech Agent is retired

**Date:** 2026-11-05. **Decision:** cross-repo review 2026-11-04, step 5, "One endpoint runtime"
(Intelligence-Hub `docs/architecture/2026-11-04-cross-repo-review.md`), and ADR 0017 /
`docs/architecture/TECH-PLATFORM-CONVERGENCE.md` in the Hub. Joe asked on 2026-11-05 to finish the
review's projects.

The Intelligence Hub's **Go endpoint agent** (`agent/` in `digeratiexperts/Intelligence-Hub`) is the one
endpoint runtime. Its go-live and pilot steps are in the Hub's `docs/ENDPOINT-AGENT-GO-LIVE.md`, its security
controls (C1-C21) in `docs/ENDPOINT-AGENT-SECURITY.md`, and its reviewed action library in `agent/library/`.

The PowerShell skeleton that lived in `windows/agent/` is removed from this repository. It never ran an
action, was never installed on a device, and the Hub routes it would have called were not built, so removing it
changes no running behaviour.

## What was removed

| Module (move, website PR) | Hub decision (TECH-PLATFORM-CONVERGENCE.md) |
|---|---|
| `DE-TechAgent.ps1`, `DE.AgentService` service skeleton (68, #933), `DE.AgentInstall` (72, #937) | Retire. The Go service is the one service. |
| `DE.AgentIdentity` enrolment and revocation (75, #939) | Retire. Move 75's revocation cases become Go test cases. |
| `DE.AgentTrust` job signature and expiry (65, #929), `DE.AgentReplay` nonces (66, #930) | Retire. Compare their test vectors with Go's and port any case Go lacks. |
| `DE.AgentCatalog` signed local catalog (67, #932) | Retire. The catalog is the Hub's. |
| `DE.AgentPause` device half of the kill switch (78, #942) | **Port** a device-side "stop on pause" check to the Go agent. |
| `DE.AgentHeartbeat` heartbeat and inventory deltas (69, #934) | **Port** inventory deltas only. |
| `DE.AgentEvidence` resumable upload (70, #935), `DE.AgentQueue` offline queue (71, #936) | **Port** resumable, idempotent evidence upload; adopt the stricter of move 71's "never drops silently" and the Go outbox. |
| `DE.AgentLoadTest` (77, #941) | Keep as a Hub-side test of job delivery, not device code. |

Their Pester suites went with them: `AgentEvidence`, `AgentHeartbeat`, `AgentIdentity`, `AgentInstall`,
`AgentPause`, `AgentQueue`, `AgentService`, `HubQueueLoadTest`, `JobCatalog`, `JobReplay` and `JobSignature`
(`.Tests.ps1` under `console/tests/`).

**To read the code for a port**, it is in git at the last commit that held it, `296721de`:

```
git show 296721de:.claude/skills/msp-ai-kit/windows/agent/DE.AgentPause.psm1
git show 296721de:.claude/skills/msp-ai-kit/windows/console/tests/JobSignature.Tests.ps1
```

## What stays

- **Move 76** (local functions run with the Hub unreachable) is a property of the desktop Tech Tool and stays.
- **The design documents stay as input** for the Go agent, each marked retired at the top:
  [JOB-CONTRACT.md](JOB-CONTRACT.md) (59), [HUB-JOB-QUEUE.md](HUB-JOB-QUEUE.md) (60),
  [AGENT-ENROLMENT.md](AGENT-ENROLMENT.md) (61), [AGENT-DEVICE-CERTIFICATES.md](AGENT-DEVICE-CERTIFICATES.md) (62),
  [AGENT-MTLS.md](AGENT-MTLS.md) (63), [AGENT-ROTATION.md](AGENT-ROTATION.md) (64),
  [AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md) (73), [AGENT-BREAK-GLASS.md](AGENT-BREAK-GLASS.md) (74),
  [HUB-QUEUE-LOAD-TEST.md](HUB-QUEUE-LOAD-TEST.md) (77) and [AGENT-KILL-SWITCH.md](AGENT-KILL-SWITCH.md) (78).
  The Hub folds mTLS and rotation into its own security document; the threat model already maps onto C1-C21.
- **`de.techconsole.job/v1`** (`console/contracts/job.schema.json`, `catalog/job-kinds.json`, `DE.Contracts`)
  stays: the Tech Tool still reads it, and the Go agent's sealed jobs are checked against the same vectors.

## Hub PR #784 (history)

Intelligence-Hub PR [#784](https://github.com/digeratiexperts/Intelligence-Hub/pull/784), "Hub job queue - lease,
ack, result, cancel (Tech Agent move 60)", is the Hub half of [HUB-JOB-QUEUE.md](HUB-JOB-QUEUE.md): the
`techagent_*` tables and the `/techagent/v1` lease, ack and result routes this skeleton would have called. Joe put
it **on hold** on 2026-11-03 under the one-agent decision, and it stays an open draft there. Nothing in this
repository calls it. Whether to close it, or mine it for the Go agent's queue, is the Hub's decision, not this
repository's.

## What does not come back

No PR adds a second endpoint agent to this repository. `console/tests/AgentBreakGlassDoc.Tests.ps1` fails if a
`windows/agent/` folder reappears. New device-side work goes to the Go agent in the Hub.

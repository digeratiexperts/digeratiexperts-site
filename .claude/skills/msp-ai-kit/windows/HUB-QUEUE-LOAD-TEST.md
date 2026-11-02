# Load-testing the Hub job queue

**Move 77** of the 104-move plan ([issue #795](https://github.com/digeratiexperts/digeratiexperts-site/issues/795)).
**Harness only. This has not been run against a real Hub, because the queue it would test (the move 60 design) is not built.**
What exists is the instrument, `windows/agent/DE.AgentLoadTest.psm1`, and the instrument is itself tested, so that when the queue
exists the numbers it produces can be trusted. It answers **D1** (the queue or one device is flooded) of
[AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md).

## 1. What the harness is

| Piece | What it does |
|---|---|
| `Invoke-DELoadTest` | N simulated devices poll on a seeded, jittered schedule in **virtual time** (an hour runs in seconds; the same seed gives the same run). Each leased job is acknowledged and then finished after a set time. Options: a thundering **herd** (everyone at t=0), lost acknowledgements |
| `New-DEModelHub`, `Invoke-DEModelHub` | An in-process Hub that follows the design: a job is acknowledged at most once; a lease never acknowledged returns to the queue, up to 3 attempts; at most 20 jobs per device; 300 requests per device per 5 minutes (then `429`); a pause answers `423`. It exists so the harness and its checks can be validated today, and as the reference the real queue is compared with |
| `Test-DEQueueInvariants` | What a correct queue keeps after any run: no job leased while already held, none acknowledged or finished twice, attempts at most 3, depth at most 20, every job in a known state |
| `Get-DELoadSummary`, `Get-DELoadVerdict` | Latency p50, p95 and p99, the peak requests in any second, errors by status, fairness (busiest device over quietest), and a pass or fail against explicit thresholds |

The harness takes a **transport**, a script block. Today it is the model; against a real Hub it is an HTTP client (section 3).

## 2. What passes

| Measure | Threshold |
|---|---|
| p95 latency of a request | at most **500 ms** |
| Server error rate (5xx) | at most **0.1 percent** |
| Invariants | **none violated**, and every run is checked, not only the last |

These are the defaults in `Get-DELoadThresholds`; a run reports the reasons it failed, not just that it did.

## 3. How to run it against a real Hub (when there is one)

1. **Staging, never production.** A copy of the Hub with its own database, so a failed run costs nothing real.
2. **A transport that is a real client.** One identity per simulated device: enrolment tokens from the staging Hub and a client
   certificate each (the enrolment and certificate designs), over mTLS. Virtual time drives the schedule; a real transport makes each call for real, so
   run enough load generators in parallel to reach the device counts below, and compare the virtual and the measured latency.
3. **Run the scenarios**, each at 1,000, 5,000 and 10,000 devices:

| Scenario | What it tests |
|---|---|
| S1 steady | Everyone polls every 60 seconds with 20 percent jitter |
| S2 herd | Every device polls at the same instant, as after a Hub restart |
| S3 lost acknowledgements | A share of acknowledgements never arrive: the re-lease path, and its ceiling |
| S4 pause storm | A pause, then a resume, with the fleet polling throughout |
| S5 one abusive device | One device polling far over its limit must be limited and must not slow the others |

4. **Check the invariants after every scenario** against the Hub's own tables, not the harness's counts.
5. **Tune from the numbers**: the re-lease ceiling of 3, the depth of 20, the poll interval and its jitter are the design's guesses
   (the job queue design asks Joe about them), and this is the evidence that settles them.

## 4. What the tests already show

The model reproduces the design's rules, and the same checks **catch three deliberately broken Hubs**: one that leases a held job
again, one that re-leases an acknowledged job, and one with no attempt ceiling. A herd of 2,000 devices at one instant fails the latency
threshold in the model; the same devices with jitter pass it.

## 5. Decisions

None for Joe in this move. The numbers it will eventually produce decide the two the job queue design left open.

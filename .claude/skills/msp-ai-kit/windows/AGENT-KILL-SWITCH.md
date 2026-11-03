# The kill switch: stopping every agent job

**Move 78** of the 104-move plan ([issue #796](https://github.com/digeratiexperts/digeratiexperts-site/issues/796)).
It answers **D5** (a mass job goes wrong fleet-wide) and **E5** (a compromised Hub signs jobs) of
[AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md). A kill switch has two halves. **This change builds the device half.** The Hub half is
specified in the job queue design (section 7) and **is not built**: it needs its own pull request in `digeratiexperts/Intelligence-Hub` and
Joe's explicit merge approval there. Until the Hub half exists, the device half is ready and waiting, and nothing can be paused.

## 1. The two halves

| Half | What it does | Where | State |
|---|---|---|---|
| Hub | A fleet-wide or one-account pause. Any staff member pauses, only an owner_admin resumes. Every lease answers `423` while it is in force, and **nothing is delivered if the pause state cannot be read** | Intelligence-Hub, the job queue and its pause table | Designed (move 60), **not built** |
| Device | Honours the pause: no new work, a running job stops before its next action, and it never un-pauses itself | `windows/agent/DE.AgentPause.psm1` | **Built here** |

## 2. What the device does

- **A `423` is recorded on disk**, atomically, with a time to ask again: the Hub's `Retry-After`, bounded to 30 seconds .. 1 hour, and 5 minutes
  when the Hub gave none. It survives a restart.
- **While paused the agent takes no new work.** `Get-DEPauseDecision` refuses `lease` and `run`.
- **The device never lifts a Hub pause.** When the time to ask has passed it may send one lease request (a probe) and the Hub decides:
  another `423` keeps the pause; a job (`200`) or nothing to do (`204`) ends it. A refusal, a rate limit or a failure says nothing about the pause, so
  it stays.
- **A running job stops before its next action.** `Invoke-DEActionSequence` asks before every action, the first included, whether it may continue.
  The action in flight is never killed mid-way (half-applied state is worse than a late stop); the next one does not start, and the rest are reported
  as not run. A cancel request stops it the same way, and a cancel check that fails counts as a cancel. The first failed action stops the job.
- **Fail closed.** A pause state that cannot be read, or that says something unexpected, is a pause with no probe: unknown never means go.
- **A pause stops work and nothing else.** The heartbeat, certificate renewal, evidence upload and reporting what already ran carry on: pausing
  work must not make the fleet's identities lapse or hide what happened (the rotation design).

## 3. A local hold

A technician at a device can stop its agent's work with `Set-DELocalHold`. It has no timer, **the Hub cannot lift it or replace it**, and only
`Clear-DELocalHold` (at the device) removes it. The same function repairs an unreadable pause state. In the other direction, `Clear-DELocalHold`
**refuses to clear a Hub pause**: only the Hub resumes.

## 4. What the operator does

1. **Stop everything:** pause fleet-wide from the Hub (any staff member). Every device's next lease answers `423`; running jobs stop at their next action.
2. **Check:** the heartbeat keeps arriving and reports each device's state as paused, so the pause can be seen to have reached the fleet.
3. **Resume:** an owner_admin resumes on the Hub. Devices notice on their next probe, within the Retry-After the Hub sent (an hour at most).
4. **One device only:** a local hold, or revoke the device (the revocation design).

## 5. What is not here

The Hub's pause endpoints and table, the staff page, and the heartbeat field that reports the pause (the service composes this module with the
heartbeat, move 68). The kill switch's own staged-rollout and blast-radius tests need the real queue and belong to its first run
(the load test design).

## 6. Decisions this asks for

None new. The behaviours above follow the job queue design (section 7) and the rotation design (the pause does not stop renewal).

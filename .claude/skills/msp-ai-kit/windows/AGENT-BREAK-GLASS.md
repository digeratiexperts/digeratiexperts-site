# The break-glass shell: deferred, and what must hold if it is ever revisited

**Move 74** of the 104-move plan ([issue #792](https://github.com/digeratiexperts/digeratiexperts-site/issues/792)).
**Design only, and the design is a decision: do not build it.** Joe decided this on 2026-10-31 (decision **D4** in
[AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md) section 12): *"Defer. Do not build the break-glass shell."* Move 74 asked for a design
of a shell that is disabled by default, time-limited and transcribed; the answer, for now, is that no such shell exists, and this
document records why that is a safe place to stand, what keeps it true, and what would have to be true before anyone built one.

It answers **E4** of the threat model (the break-glass shell is abused) **by decision**: there is nothing to abuse.

## 1. What this is not

The tool already has a **break-glass administrator account** (the `breakglass` identity actions): a local administrator a technician can
sign in with when the managed identity is unavailable. That is an *account*, set up and verified by the tool, and it has nothing to do with
this document. The **break-glass shell** is a different thing that does not exist: a way for DE staff to run commands on a client
device **remotely**, through the agent, without a signed job.

## 2. Why deferral is safe

- Every action the agent can ever run is a **catalog action** carried by a **signed job** that has passed both keys of the two-key
  check. A shell is the opposite: arbitrary commands, chosen live.
- The threat model's global deny list already says **no job type may ever** "build, enable or use the break-glass shell", and **no
  job type enables it**: it would be a separate capability, never a kind of job.
- DE's alternative for a device that needs hands-on work is **hands-on work**: a technician at the machine with the interactive
  tool, or the remote-assist adapter (section F, gated on move 8). Neither is a shell inside the agent.

## 3. What keeps it true

A test holds the agent's own code to it. **No file in `windows/agent` may contain a remote-shell capability**: a remote session, a remote
command, an encoded command, a download-and-execute, or a piped shell. The same test runs a planted example through the same scan, so the scan
is known to see one. The agent tree, which does not exist as a shell today, is the one place such a thing would be added, so it is the
place guarded.

## 4. If it is ever revisited

This is the list a future proposal has to meet **before any code is written**, taken from the threat model's E4 row and from the decisions
around it. Joe decides whether to revisit; an agent does not.

1. **A separate capability, not a job type.** It has its own switch, its own endpoint and its own audit. No job kind enables it and no job
   can reach it.
2. **Disabled by default**, on every device, in every build.
3. **Just-in-time approval** by a person who is not the requester, for one device and one reason, recorded by name.
4. **Short-lived**: it expires on its own, with a maximum measured in minutes, and cannot be extended by the session itself.
5. **Fully transcribed**: every command and its output is recorded, redacted on the device before it leaves, and stored where the client
   can later be told what was run.
6. **Stoppable by the kill switch** (move 78): pausing the fleet or one account ends open sessions, and a session cannot start while
   delivery is paused.
7. **Two-person for destructive commands** while DE has a second approver, and **not available at all** while DE has one person, the same
   rule as destructive jobs (D5).
8. **Reviewer-key pinned** (D3): enabling it on a build needs the offline reviewer's signature, so a compromised Hub cannot switch it on.
9. **No secrets typed through it**, and no recovery key ever displayed (the BitLocker rule).
10. **A threat-model update first**: a new row in the document that gates section E, approved the way that document was.

## 5. Decisions

None are open. D4 is decided. The only question this document leaves is *whether and when* to revisit, which is Joe's.

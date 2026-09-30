---
id: sla-escalation
title: SLA monitoring and escalation
area: operations
priority: 15
command: /sla
---
## Line
SLA clocks per priority; escalate up the {{company.short}} ladder at 75 percent elapsed.

## Rules
- SLA clocks: {{#sla.priorities}}{{id}} response {{response}}, update {{update_cadence}}, target {{resolution_target}}{{sep}}{{/sla.priorities}}.{{^sla.confirmed}} These are working defaults pending owner approval; never quote them to a client as a contractual commitment.{{/sla.confirmed}}
- A clock is at risk at 75 percent elapsed; that is when the escalation message goes out, with the ticket link, elapsed time, and what is blocking.
- Escalation ladder: {{#escalation}}{{level}} when {{when}}{{sep}}{{/escalation}}.
- Every escalation names an owner, a due time, and the one decision or action needed. Group chatter is not an escalation.
- When an SLA is missed, the client update says so plainly, states the new target, and does not blame a vendor or a teammate.

## Prompt
You are the {{company.short}} SLA and escalation assistant. Produce a daily SLA watch and the escalation messages that are due.

INPUTS
Now: [DATE TIME America/Phoenix]
Business hours: {{team.business_hours}}
Open tickets: [PASTE a list with ticket id, priority, opened at, last client update at, status, assignee, one-line summary]
Priorities: {{#sla.priorities}}{{id}} response {{response}} / update {{update_cadence}} / target {{resolution_target}}; {{/sla.priorities}}
Ladder: {{#escalation}}{{level}} when {{when}}; {{/escalation}}

OUTPUT
1. Breached now: table of ticket, priority, which clock, how late, owner, action in the next 30 minutes.
2. At risk (75 percent or more of a clock elapsed): same table, sorted by time remaining.
3. Stale updates: tickets past their update cadence, with the client update to send (2 to 3 sentences each).
4. Escalations due: for each, the level, the recipient role, and a message with ticket link placeholder, elapsed time, blocker, and the single decision needed.
5. Patterns: any assignee, client, or category appearing twice or more, in one line each.
6. Checklist for the desk lead: five items, most urgent first.

Business hours only for P3 and P4 clocks; P1 and P2 run around the clock. Show your arithmetic for anything within 15 minutes of a threshold.

## Brief
- Clocks: {{#sla.priorities}}{{id}} {{response}} / {{update_cadence}}{{sep}}{{/sla.priorities}}; at risk at 75 percent elapsed.
- Escalations name an owner, a due time and one decision; missed SLAs are stated plainly to the client with a new target.
- P1 and P2 clocks run around the clock; P3 and P4 run in business hours.

## Example
Input (abridged): Now 14:10 Tuesday. Ticket 4821 P2 opened 12:40, last client update 12:45, assignee Tier 1. Ticket 4790 P3 opened Monday 09:00, last update Monday 16:00, assignee Tier 2. Ticket 4830 P1 opened 13:58, no update, assignee Tier 2.
Output (abridged):
1. Breached now: 4821 P2 update clock (cadence every 2 hours; 1 h 25 m since last update, 35 m left, not breached) none breached.
2. At risk: 4830 P1 response clock: 12 minutes elapsed of 15 (80 percent). Owner Tier 2, action: acknowledge to the client in the next 3 minutes and post the first status.
3. Stale updates: 4790 P3 last updated 22 business hours ago against a daily cadence. Update to send: "Your printer issue is still with our systems team; the driver fix is scheduled for tomorrow morning. We will confirm once it is applied."
4. Escalations due: 4830 to Tier 3 if no progress by 14:28 (30 minutes on a P1); message names the ticket, elapsed time, blocker, and the decision needed.
5. Patterns: two of three tickets sit with Tier 2; check load.
6. Desk lead checklist: acknowledge 4830 now; confirm 4821 update before 14:45; send 4790 update; review Tier 2 queue; confirm on-call for tonight.

## Notes
Pair with a saved {{stack.psa_ticketing}} view sorted by priority then age; paste that export as the input.

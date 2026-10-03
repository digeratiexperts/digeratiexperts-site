# Claude takeover: decisions and remaining dependencies

Joe authorized Codex to take over the supplied handoff and merge #343. This document answers each outstanding question using Joe's recorded local decisions. It records implementation separately from production release.

## Answers to Claude

| Question | Answer | What this means |
| --- | --- | --- |
| 2a VPN | D — Timus Networks | Timus is the selected secure-access platform. JumpCloud provides identity where applicable. Do not replace this decision with Tailscale, WireGuard, OpenVPN, Perimeter 81 or Twingate. New ControlOne SASE work is excluded; existing migration requirements remain separate. |
| 2b Cytracom | A — use the voice API | Keep the phone page. Connect UCaaS voice after provider documentation and authorized access arrive. Keep voice separate from the ControlOne migration. Store documented credentials securely on the server, never in the browser or repository. |
| 2c Ship Center | C — DE staff enter tracking numbers | No shipping aggregator is selected. Actual staff entry and persistence still require implementation and authorization for staff-only access. Rates, labels and live tracking depend on authorized USPS, FedEx and UPS access. Sample tracking records are not shipment evidence. |
| 3 Test login | Approved existing QA credentials required | This host lacks PORTAL_QA_EMAIL and PORTAL_QA_PASSWORD. Blank names are documented in .env.example. They do not provision an account. Joe must supply an approved test login through secure test-environment settings. Never guess a password or use a real customer tenant for fixture testing. |
| 5 Popup | A — clients keep the findings | The third fact now reads “Yours to keep” and explains ownership with DE, the current provider or no engagement. No assessment delivery deadline or score is promised. |
| Registry #343 | Merged | Merge commit e2d4ffa4910a12bbe80521cd67fa6ef1aa3da758 records the prior releases. It contains registry changes only. |
| Notes a25bc4bd | Preserved in this branch | The notes were applied without committing the original branch. That original branch is still unpushed; this branch contains the decisions plus current implementation status. |

## Provider requirements before integration

**Timus:** official partner API documentation and base URL/version; authentication/scopes; authorized DE tenant and sandbox; identity/tenant mapping; supported device, status, last-connection and configuration endpoints; client-visible field rules; rate limits and expiry/revocation behavior. JumpCloud SAML configuration, commercial terms and pilot acceptance remain separate prerequisites. Until verified, no client profile is generated and no vendor download is represented as provisioned for the account.

**Cytracom:** official voice API documentation and base URL/version; authentication and credential storage requirements; authorized sandbox; extension/user/company mapping; call-history and voicemail availability; permitted settings mutations; rate limits and error contracts. A key alone does not establish that every displayed action is supported. Each endpoint requires server authorization and company scoping before enabling it.

**Carriers:** authorized carrier accounts and documented API access for the exact tracking/rates/labels capabilities selected; sandbox access; supported services and tracking normalization; credential scopes, limits and error contracts. Staff-entered tracking needs a real shipment record, staff-only writes, client-scoped reads and auditability. None of these are supplied by the example rows currently on the page.

No vendor was contacted and no paid API calls, purchases, live labels or customer changes were made.

## Implemented locally

- Imported vendor decisions and the claims notes into an isolated branch based on main after #343.
- Updated the popup ownership fact while preserving its layout and trigger behavior.
- Marked VPN, phone and shipping data as examples. Disabled unavailable downloads, configuration regeneration, phone saves/voicemail actions and shipment creation/tracking. Removed fake success callbacks and fictional configuration-file availability. Ship Center's support action links to portal tickets.
- Removed unsupported assessment scheduling/results, enquiry and quote turnaround deadlines from the active homepage sections, related pages and Version 7. A support SLA is not evidence for assessment or sales deadlines.
- Qualified broad 15-minute claims as Critical first response per the published SLA. Replaced fixed onboarding/offboarding turnaround with environment-specific planning and approvals. Pricing and server authority are unchanged.
- Updated the claims register and documented missing QA variable names without creating or exposing values.

## Verification and release boundary

See the checkpoint report and evidence under C:/Users/Joe/DE/Evidence/2026-10-02-portal-claude-takeover. Local portal screenshots use synthetic browser fixtures with intercepted APIs. They verify rendering and unavailable-action behavior; they do not verify login, live provider access, staff authorization or tenant isolation.

The handoff reported #330 and #333 live. #343 preserves that historical release evidence. This takeover has not independently reverified those prior deployments. New local changes are not production changes until reviewed and released. Version 6 has a separate active owner and was not edited. Historical cyber-statistic citations and unresolved service-domain taxonomy are not independently validated by these copy fixes.

## Remaining work and owners

- Joe/provider administrators: supply approved QA account access and provider documentation/access through secure channels.
- Codex after those prerequisites: implement and verify server-side tenant-scoped integrations and real staff shipment entry under an explicit staff-access scope; perform authenticated QA.
- Joe/release owner: authorize publication/release of this concrete local change under workspace AGENTS.md stop gates. #343's explicit merge authorization does not authorize unrelated protected-branch merges or production restarts.

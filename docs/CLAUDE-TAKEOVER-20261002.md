# Claude takeover: decisions and remaining dependencies

Joe authorized Codex to take over the supplied handoff and merge #343. This document answers each outstanding question using Joe's recorded local decisions. It records implementation separately from production release.

## Answers to Claude

| Question | Answer | What this means |
| --- | --- | --- |
| 2a VPN | D — Timus Networks | Timus is the selected secure-access platform. JumpCloud provides identity where applicable. Do not replace this decision with Tailscale, WireGuard, OpenVPN, Perimeter 81 or Twingate. New ControlOne SASE work is excluded; existing migration requirements remain separate. |
| 2b Cytracom | A — use the voice API | Keep the phone page. Connect UCaaS voice after provider documentation and authorized access arrive. Keep voice separate from the ControlOne migration. Store documented credentials securely on the server, never in the browser or repository. |
| 2c Ship Center | C — DE staff enter tracking numbers | No shipping aggregator is selected. Newer main implements staff manual shipment records; verify them with approved accounts before calling real shipments tested. Rates, labels and live tracking depend on authorized USPS, FedEx and UPS access. Sample tracking records are not shipment evidence. |
| 3 Test login | Approved existing QA credentials required | This host lacks PORTAL_QA_EMAIL and PORTAL_QA_PASSWORD. Blank names are documented in .env.example. They do not provision an account. Joe must supply an approved test login through secure test-environment settings. Never guess a password or use a real customer tenant for fixture testing. |
| 5 Popup | A — clients keep the findings | Main's third fact reads “Yours to keep” and “The findings belong to you.” The recorded decision applies with DE, the current provider or no engagement. No assessment delivery deadline or score is promised. |
| Registry #343 | Merged | Merge commit e2d4ffa4910a12bbe80521cd67fa6ef1aa3da758 records the prior releases. It contains registry changes only. |
| Notes a25bc4bd | Decisions now also on main | Newer main commit 99b17a8d records the decisions. The original local notes branch was preserved. Publishing that older notes-only branch is unnecessary. |

## Provider requirements before integration

**Timus:** official partner API documentation and base URL/version; authentication/scopes; authorized DE tenant and sandbox; identity/tenant mapping; supported device, status, last-connection and configuration endpoints; client-visible field rules; rate limits and expiry/revocation behavior. JumpCloud SAML configuration, commercial terms and pilot acceptance remain separate prerequisites. Until verified, no client profile is generated and no vendor download is represented as provisioned for the account.

**Cytracom:** official voice API documentation and base URL/version; authentication and credential storage requirements; authorized sandbox; extension/user/company mapping; call-history and voicemail availability; permitted settings mutations; rate limits and error contracts. A key alone does not establish that every displayed action is supported. Each endpoint requires server authorization and company scoping before enabling it.

**Carriers:** authorized carrier accounts and documented API access for the exact tracking/rates/labels capabilities selected; sandbox access; supported services and tracking normalization; credential scopes, limits and error contracts. Staff-entered tracking needs a real shipment record, staff-only writes, client-scoped reads and auditability. None of these are supplied by the example rows currently on the page.

No vendor was contacted and no paid API calls, purchases, live labels or customer changes were made.

## Reconciliation with newer main

The initial local snapshot was built at e2d4ffa4 and passed its tests, build and browser checks. Before publishing it, Codex fetched current main at c99c3f5120abafc318d63f4c5c5d60ef4776830e and found newer implementations. Main was merged into this branch, and all conflicting newer code was preserved before applying the remaining fixes. The original snapshot commit 9003e16d remains in local history; its verification is not represented as verification of the reconciled branch.

Main already contains the “Yours to keep” popup (cf5bb8f8), QA production workflow/runbook (800cf2c3), VPN/phone/shipping adapters, staff manual records and data-source configuration. Timus deliberately has no live adapter until its endpoint contract arrives. Cytracom's implemented voice adapter covers documented extensions; call history, voicemail and arbitrary settings support must not be inferred. Staff shipment records exist; real data and provider configuration still require approved access. Newer SLA qualifiers, authentic credentials presentation, tenant boundaries and page redesigns are preserved.

The QA workflow reads GitHub Actions repository secrets, not portal application settings. Follow `docs/runbooks/PORTAL-QA-LOGIN.md` for the current flow. No secret values were supplied or changed in this takeover. GitHub and production secret availability were not independently checked.

## Remaining changes implemented locally

- Imported vendor decisions and the claims notes into an isolated branch based on main after #343.
- Preserved main's popup ownership fact, layout and trigger behavior.
- Marked VPN, phone and shipping data as examples. Disabled unavailable downloads, configuration regeneration, phone saves/voicemail actions and shipment creation/tracking. Removed fake success callbacks and fictional configuration-file availability. Ship Center's support action links to portal tickets.
- Removed unsupported assessment scheduling/results, enquiry and quote turnaround deadlines from the active homepage sections, related pages and Version 7. A support SLA is not evidence for assessment or sales deadlines.
- Preserved main's Critical first-response SLA qualifiers and authentic claims changes. Replaced remaining fixed onboarding/offboarding turnaround with environment-specific planning and approvals. Pricing and server authority are unchanged.
- Updated the claims register and documented missing QA variable names without creating or exposing values.

## Verification and release boundary

See the checkpoint report and evidence under C:/Users/Joe/DE/Evidence/2026-10-02-portal-claude-takeover. Local portal screenshots use synthetic browser fixtures with intercepted APIs. They verify rendering and unavailable-action behavior; they do not verify login, live provider access, staff authorization or tenant isolation.

The handoff reported #330 and #333 live. #343 preserves that historical release evidence. This takeover has not independently reverified those prior deployments or newer main's deployment. New local changes are not production changes until reviewed and released. Version 6 was not edited. Historical cyber-statistic citations and unresolved service-domain taxonomy are not independently validated by these copy fixes.

## Remaining work and owners

- Joe/provider administrators: supply approved QA account access and provider documentation/access through secure channels.
- Codex after those prerequisites: complete the Timus adapter from its official contract, verify the existing tenant-scoped voice and staff shipment implementations against approved provider/account access, and perform authenticated QA. Do not duplicate the staff-entry functionality already on main.
- Joe/release owner: authorize publication/release of this concrete local change under workspace AGENTS.md stop gates. #343's explicit merge authorization does not authorize unrelated protected-branch merges or production restarts.

# Meshy / Digerati 3D asset backlog

> **HISTORICAL RECORD (Tier 3 — `design/DESIGN-AUTHORITY.md`).** This document records what was decided, placed or guarded at a point in time. It explains *why* things are the way they are. Its "do not", "unchanged", "leave alone" and "keep" lines were the guardrails of that task; they do not prohibit future maintenance or redesign work unless a Tier 0–2 file promotes the decision.

**Date:** 2026-08-08  
**Source:** DE production backlog (full Batches 01–10)  
**Related:** `docs/MESHY-BATCH-01.md`, `docs/MESHY-MCP.md`, `docs/VISUAL-SHOPPING-LIST.md`, `docs/VISUAL-ASSET-INVENTORY.md`

### Site placement (2026-08-08)

| Asset | Public derivative | Placed |
|---|---|---|
| Endpoint / Email / Network / Backup / Identity | `client/public/images/visual-system/meshy-batch-01/*` | Homepage outcomes (Identity / Backup / Network) + engagement Email + How-it-works Network + Solutions (network / threat / backup) |
| Batch 01 refine | Done (5 × 10 cr) | Dark charcoal + violet/fuchsia materials on all five |
| Hero `DashboardMockup` | — | **Deferred** (needs composed ecosystem, Batch 10) |
| Mega-menu / portal | — | Stay Lucide |

Registry: `client/src/lib/visualAssets.ts`. Do not overwrite this backlog’s batch tables when updating placement notes.

---

## Library goals

| Goal | Target |
|---|---|
| Reusable core library | ~**40** assets |
| Page use | **Selective** — not every asset on every page |
| Highest-value set | ~**25** security/IT icons + ~**10** industry icons + ~**10** larger compositions |
| Role vs Envato | Envato `4THD2PH` = primary stock; Meshy = controlled Digerati brand concepts |

Do **not** dump the full library onto the site. Build once, place only where the page redesign needs a clear visual.

---

## Global avoid list (all batches)

Never generate or keep assets that feature:

- Threatening humans
- Masks, hoods, faces
- Skulls
- Insects / malware bugs as creatures
- Weapons

Threat / problem assets (Batch 09) must stay **clean and abstract** — containment, barriers, quarantine cubes, rejected keys — not horror or threat-porn.

---

## Licensing & paths

| Rule | Detail |
|---|---|
| Sources | Under `assets/licensed/meshy-<batch>/ORIGINAL/` only |
| Public web | **Never** copy ORIGINALs into `client/public` / `public/` |
| Derivatives | Website-ready exports only after inventory + DE approval; site use only |
| Binaries | Gitignored — docs and task IDs only in git |

---

## Recommended build order

| Step | Action | Gate |
|---|---|---|
| **1** | Regenerate **Identity** (Batch 01) | **Done** (v4 approved) |
| **2** | Refine all five Batch 01 shapes | **Done** |
| **3** | Generate **Batch 02** | **Next** — DE go-ahead / credit comfort |
| **4** | Assessment, SOC, and hero ecosystem **compositions** (Batch 10 subset) | After Batch 02 core exists |
| **5** | Compliance + managed IT (Batches 04–05) | As page work needs them |
| **6** | Industry (Batch 08) **only** for pages being redesigned | Per-page redesign |
| **7** | Threat / problem (Batch 09) **sparingly** | Prefer abstract containment |
| **8** | Communications + secondary (Batches 06–07 leftovers) **last** | Lowest priority |

**Next gate:** generate Batch 02 (Essential security) when DE is ready — prefer finishing Batch 01 polish over starting 12 new assets.

---

## Batch status summary

| Batch | Name | Status |
|---|---|---|
| 01 | Core protection | **Complete** — five approved, refined, derivatives published |
| 02 | Essential security | Planned |
| 03 | Business continuity | Planned |
| 04 | Compliance and risk | Planned |
| 05 | Managed IT | Planned |
| 06 | Communications | Planned (last) |
| 07 | Human security | Planned (last; strict avoid list) |
| 08 | Industry collection | Planned — only when redesigning those pages |
| 09 | Threat and problem | Planned — sparingly; clean/abstract only |
| 10 | Website compositions | Planned — prioritize assessment / SOC / hero after Batch 02 |

---

## Batch 01 — Core protection

| Asset | Visual concept | Status |
|---|---|---|
| Identity & access | ID badge with shield/keyhole | **Approved + refined** — placed on outcomes |
| Endpoint security | Laptop with shield | **Approved + refined** |
| Email security | Envelope with lock | **Approved + refined** |
| Network security | Connected node cluster | **Approved + refined** |
| Backup & recovery | Cloud over storage stack | **Approved + refined** |

Generation log / task IDs: `docs/MESHY-BATCH-01.md`.  
Refine: **done** (all five; dark charcoal + violet/fuchsia).

---

## Batch 02 — Essential security

| Asset | Visual concept | Status |
|---|---|---|
| MFA | Phone with verification code and check | Planned |
| Password manager | Key inside a protected vault | Planned |
| Zero Trust | Segmented gateway with identity badge | Planned |
| Firewall | Protective wall with shield | Planned |
| EDR | Endpoint device with detection pulse | Planned |
| MDR/SOC | Monitoring console with protective radar | Planned |
| Threat detection | Radar scanning a protected object | Planned |
| Vulnerability management | Shield with inspected/open gap | Planned |
| Patch management | Software tile with update/check symbol | Planned |
| Encryption | Data cube wrapped by lock | Planned |
| Secure cloud | Cloud enclosed by shield | Planned |
| Data loss prevention | Document contained by protective barrier | Planned |

---

## Batch 03 — Business continuity

| Asset | Visual concept | Status |
|---|---|---|
| Disaster recovery | Restored server with circular recovery arrow | Planned |
| Business continuity | Operating business node inside protective ring | Planned |
| Immutable backup | Locked storage stack | Planned |
| Cloud backup | Cloud connected to protected storage | Planned |
| Recovery testing | Backup stack with verified checklist | Planned |
| Uptime | Server with heartbeat/status pulse | Planned |
| Redundancy | Two synchronized infrastructure nodes | Planned |
| Incident response | Alert contained inside shield | Planned |
| Security operations | Console with multiple monitored endpoints | Planned |

---

## Batch 04 — Compliance and risk

| Asset | Visual concept | Status |
|---|---|---|
| Cyber Risk Assessment | Clipboard/report with shield and risk gauge | Planned |
| Risk score | Gauge inside a security badge | Planned |
| Compliance readiness | Document with shield/check | Planned |
| Cyber insurance readiness | Policy document protected by umbrella/shield | Planned |
| Audit evidence | Organized documents with verification seals | Planned |
| HIPAA | Medical cross with lock | Planned |
| PCI | Payment card with shield | Planned |
| SOC 2 | Control framework blocks with check | Planned |
| Policy management | Document stack with settings control | Planned |
| Executive reporting | Clean dashboard/report with upward trend | Planned |
| Quarterly business review | Presentation board with metrics | Planned |
| Security roadmap | Protected pathway with milestones | Planned |

---

## Batch 05 — Managed IT

| Asset | Visual concept | Status |
|---|---|---|
| Help desk | Support headset with device | Planned |
| Remote support | Laptop connected to assistance cursor | Planned |
| Device management | Laptop, phone, and tablet grouped together | Planned |
| User onboarding | ID badge entering a verified workflow | Planned |
| User offboarding | Access badge being securely deactivated | Planned |
| Microsoft 365 | Productivity tiles inside protective cloud | Planned |
| Cloud management | Managed cloud with settings gear | Planned |
| Server management | Server rack with health indicator | Planned |
| Network monitoring | Router/network node with pulse rings | Planned |
| Internet connectivity | Router with protected signal | Planned |
| Wi-Fi management | Secured wireless access point | Planned |
| Hardware procurement | Device box with approved check | Planned |
| Lifecycle management | Device surrounded by circular timeline | Planned |
| IT strategy / vCIO | Technology roadmap with compass | Planned |
| Automation | Connected gears and workflow nodes | Planned |

---

## Batch 06 — Communications

| Asset | Visual concept | Status |
|---|---|---|
| Business phone / UCaaS | Desk phone or handset with cloud | Planned |
| Video meetings | Display with participant tiles | Planned |
| Team chat | Secure message bubbles | Planned |
| Contact center | Headset surrounded by communication nodes | Planned |
| Unified communications | Phone, video, and message symbols combined | Planned |
| Mobile workforce | Phone and laptop connected through secure cloud | Planned |

---

## Batch 07 — Human security

| Asset | Visual concept | Status |
|---|---|---|
| Security awareness | Lightbulb or learning card with shield | Planned |
| Phishing protection | Hook stopped before an envelope | Planned |
| Employee training | Training screen with verified learner | Planned |
| Access governance | Multiple identity badges controlled by shield | Planned |
| Insider-risk protection | Authorized user badge inside monitored boundary | Planned |
| HR onboarding automation | Employee badge moving through workflow steps | Planned |

**Batch note:** Avoid threatening humans, masks, hoods, faces, skulls, insects, and weapons for this entire batch (same as global avoid list). Prefer badges, cards, workflows — not people.

---

## Batch 08 — Industry collection

Generate **only** for industry pages that are actually being redesigned.

| Industry | Visual concept | Status |
|---|---|---|
| Law firms | Legal scales or case file with shield | Planned |
| CPA / accounting | Calculator and financial document with lock | Planned |
| Healthcare | Medical cross and patient record with shield | Planned |
| Real estate | Building or house with protected transaction | Planned |
| Animal hospitals | Paw and medical cross with shield | Planned |
| Construction | Hard hat and tablet with protection | Planned |
| Professional services | Briefcase with protected documents | Planned |
| Retail | Storefront and payment terminal with shield | Planned |
| Manufacturing | Factory/gear protected by monitoring shield | Planned |
| Nonprofits | Helping hands or heart protected by secure cloud | Planned |

---

## Batch 09 — Threat and problem assets

Keep **clean and abstract** — not scary.

| Asset | Visual concept | Status |
|---|---|---|
| Ransomware prevention | Locked file blocked by shield | Planned |
| Malware protection | Harmful code fragment contained in quarantine cube | Planned |
| Phishing attempt | Suspicious envelope stopped by barrier | Planned |
| Account takeover | Unauthorized key rejected by identity gate | Planned |
| Data breach prevention | Data escaping toward a closed protective boundary | Planned |
| Zero-day response | Alert symbol contained by patch shield | Planned |
| Insider threat | Access badge exceeding a controlled boundary | Planned |
| Wire fraud prevention | Bank transfer arrow intercepted by shield | Planned |
| Downtime prevention | Broken signal restored by recovery ring | Planned |
| Compliance gap | Incomplete checklist being repaired | Planned |

---

## Batch 10 — Website compositions

Larger scene assets (not small icons). Prioritize assessment, SOC, and hero ecosystem after Batch 02.

| # | Composition | Visual concept | Status |
|---|---|---|---|
| 1 | Hero security ecosystem | Identity, endpoint, email, network, cloud, and SOC as one connected system | Planned |
| 2 | Cyber Risk Assessment preview | Authentic-looking report pages, risk gauge, findings, prioritized recommendations | Planned |
| 3 | 24/7 monitoring scene | Clean operations console with monitored endpoints and alert containment | Planned |
| 4 | ProActive Office ecosystem | Communication, productivity, endpoint, email, and network | Planned |
| 5 | ProActive Business ecosystem | Office stack plus MDR, HR workflow, awareness, reporting, insurance readiness | Planned |
| 6 | ProActive Enterprise ecosystem | Business stack plus compliance, privileged access, testing, recovery, automation | Planned |
| 7 | Assessment journey | Discovery → assessment → recommendation → onboarding | Planned |
| 8 | Managed service relationship | Business environment connected to an accountable local security team | Planned |
| 9 | Business continuity scene | Active business protected by backup, redundancy, and recovery | Planned |
| 10 | Arizona service-area composition | Abstract Arizona / Greater Phoenix map with connected protected businesses | Planned |

---

## Current production focus

1. **Identity regen** — separate agent; no refine until DE approves the new shape.
2. **Docs / workflow** — this file + build order in `MESHY-MCP.md` / `VISUAL-SHOPPING-LIST.md`.
3. **Next** — generate Batch 02 → compositions (assessment / SOC / hero) when DE is ready.

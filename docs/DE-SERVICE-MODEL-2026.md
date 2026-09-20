# DE 2026 Service Model — working knowledge

What Joe's 2026 platform material actually says, recorded so no agent has to
re-derive it. **Source material, not a contract, and not a claims source.**
Public claims still go through `docs/CLAIMS-REGISTER.md`; the executed MSA,
Order Form and SOW control real scope.

- Captured: 2026-09-02, from five files Joe supplied (see Provenance).
- Status: study notes. Open questions at the end are unanswered.

---

## The operating principle

> Clients purchase **outcomes and approved service coverage**. DE manages
> sequencing, standards, service boundaries, and the technical operating model
> behind those outcomes.

Two sentences that govern everything else:

> **"We do not promise outcomes before we understand the environment."**
> **"You see the outcome. DE handles the complexity behind it."**

This is the spine. DE is not selling tools; it is selling an operating model
with a deliberate order of operations, and it refuses to skip the order.

## What DE is not

Recorded because it is unusually explicit, and because it is a positioning
asset rather than a caveat:

- Not an unlimited catch-all rate card. Support entitlement is defined.
- Not the HR department, not the finance department. DE runs the *technology*
  around people and money, and says so in the material.
- Not a vendor catalog. The internal SKU/vendor/margin warehouse stays internal.
- Not a guarantee. "Cybersecurity reduces risk; it does not create an absolute
  guarantee." No audit-result guarantees without a separately contracted
  attestation service.
- Not automatically a fit. Minimums, prerequisites and standards can disqualify
  an engagement, and DE **may pause, defer, limit or reschedule** work when
  prerequisites are incomplete.

## Four ProActive Ecosystems

Published rates are **starting points**; final fees depend on quantities,
licensing, sites, workloads, compliance, recovery objectives and scope. Tier
minimums apply when the per-user calculation comes in lower. Sizing is
guidance — complexity, compliance, sites, workloads, recovery objectives and
risk can move an engagement to a different design.

| Tier | Positioning | Typical fit | Rate | Monthly floor |
|---|---|---|---|---|
| ProActive IT | Visibility + essential control | 1–10 users | $125/user | $1,600 |
| ProActive Office | Managed daily workplace | 11–25 users | $165/user | $2,400 |
| ProActive Business | Integrated managed operations | 26–75 users | $245/user | $5,400 |
| ProActive Enterprise | Advanced governance + customization | 76+ / complex | $345/user | $9,000 |

Regulated path, separate from the ladder:

| Path | Rate | Floor | Positioning |
|---|---|---|---|
| Business GCCH | $425/user | $7,500 | GCC High-aligned Business design |
| Enterprise GCCH | $575/user | $12,500 | Advanced regulated / custom governance |

These match `client/src/data/pricing.ts` exactly, which cites TechSales
`CANONICAL_TIERS`. The site and the sales material agree.

## Twelve capability lanes

The client-facing service architecture, organized by business outcome:

| # | Lane | # | Lane |
|---|---|---|---|
| 01 | Managed IT & Support | 07 | HR / Workforce Technology |
| 02 | Identity, Users & Devices | 08 | Company Spend Card Controls |
| 03 | Cybersecurity & Risk | 09 | Compliance & Reporting |
| 04 | Network, Sites & Secure Access | 10 | Advisory & Planning |
| 05 | Data, Backup & Continuity | 11 | Cloud & Infrastructure |
| 06 | Workplace Technology | 12 | Projects, Procurement & Automation |

**Two lanes are unusual for an MSP and worth treating as differentiators:**

- **07 HR / Workforce Technology** — HRIS structure, recruiting/ATS
  integration, contractor/EOR flows, and the joiner/mover/leaver chain wired
  into identity. Framed with a hard boundary: employment, payroll, benefits,
  tax and legal stay with the client.
- **08 Company Spend Card Controls** — vendor-neutral corporate card controls
  by department, employee, vendor or project. The point is the offboarding
  chain: **"Money access ends with system access."** Not standard in IT,
  optional in Office, a *required operating control* in Business and Enterprise.

## The sequence — the part that is the story

DE establishes authority, visibility and minimum standards *before* deeper
management. Six stages:

| Stage | What happens | Why it matters |
|---|---|---|
| 01 Legal + Authority | MSA/Order Form/SOW, decision maker, access authority | Clarifies who can approve what, and what DE owns |
| 02 Assessment + Discovery | Cyber risk, site, network, endpoint, SaaS, compliance | Finds risk, waste, unsupported conditions, hidden dependencies |
| 03 Environment Intake | Admin access review, users, devices, vendors, baseline docs | Creates visibility and operational context |
| 04 Stabilization | Immediate risks, access gaps, backup concerns, remediation | Stops unknown problems becoming managed-service assumptions |
| 05 Security Foundation | Identity, endpoint, email/collab, site controls to minimum standards | Establishes the security baseline |
| 06 Activate + Expand | Normal operations; Phase 2 and Phase 3 follow | Reactive cleanup → intentional management |

Wrapped in three phases — **Phase 1 Core Services** (establish control),
**Phase 2 Infrastructure + Workplace** (standardize and secure),
**Phase 3 Governance + Expansion** (optimize, govern, expand) — with a
sequencing rule: later phases depend on earlier prerequisites unless an
exception is approved **in writing**.

Assessment is **required** when the service depends on understanding risk,
architecture, access, recovery or current conditions. It can be waived or
narrowed only by approved documented exception.

## Three public doors

| Door | For | Leads to |
|---|---|---|
| 01 · Handle Our IT | Organizations wanting DE to run technology and security operations | Consultation/assessment → the right ProActive managed **or co-managed** design |
| 02 · Solve a Business Need | Organizations needing a defined outcome, not a full MSP relationship | DE designs the approved solution around the need |
| 03 · Client Marketplace | Authenticated DE clients | Approved additions, renewals, equipment tied to entitlement |

Behind all three: the **internal digital warehouse** (vendor, SKU,
compatibility, dependency, cost, margin, fulfillment) so clients never shop
the plumbing.

**Public disclosure rule.** Workplace platform choice is shown where it
matters to the client (Microsoft, Google, Zoho). Everything else stays
outcome-led; internal vendor/SKU mechanics stay in DE's delivery system unless
relevant to compatibility, compliance or contract.

## Standalone + co-managed

> "DE can own one defined role without pretending it owns the whole environment."

Six standalone roles: Network + Secure Access · Managed Workplace · Cloud
Backup/BCDR · Threat Detection + Security Ops · Advisory/Compliance/vCIO/vCISO ·
Cloud/Licensing/Voice.

Critical boundary: standalone and co-managed work **does not silently inherit**
full MSP, SOC, backup, network, compliance or helpdesk coverage. Only the
selected role and documented dependencies are included.

## Workplace is a choice, not a mandate

DE supports **Microsoft 365, Google Workspace and Zoho** rather than forcing
one vendor. Platform is matched to user roles, collaboration needs, security
requirements, licensing economics and the client operating model. Approved
line-of-business SaaS can be licensed, administered, integrated, backed up and
governed as part of the workplace design.

## Four client commitments

| | |
|---|---|
| **OWN IT** — clear service ownership | **SECURE IT** — security-first standards |
| **SHOW IT** — make risk visible | **PLAN IT** — roadmap forward |

"Show it" is the notable one: unsupported conditions, exceptions, material
risks and service issues are **documented instead of hidden**.

## Language and tone observed in the source

Short declaratives, often adversative — asserting what something is by denying
a common misconception:

- "Storage is not backup. Backup is not recovery until it can be restored."
- "Network is a design decision, not a user-count checkbox."
- "Security is an operating system."
- "The identity layer is the control plane."
- "Choose the operating maturity — not a pile of tools."
- "Own the ticket. Own the outcome."
- "Control before complexity."
- "No mystery scope."
- "Projects are scoped when the business is changing."

Section titles are imperative or declarative, never cute. Every capability
block pairs a **claim** with a **boundary**. The house tagline is
**PROTECT. EMPOWER. SUCCEED.** and **"Your technology. Working as one ecosystem."**

---

## The cybersecurity architecture is EIGHT blocks

**Corrected by Joe, 2026-09-02.** An earlier revision of this document asserted
that the "six protection domains" were authoritative because
`ProtectionCommandDeck.tsx` ships exactly six. That was wrong: **the shipping
component is stale, not canonical.**

The current cybersecurity architecture is eight blocks:

| # | Block | | # | Block |
|---|---|---|---|---|
| 1 | Identity & Access | | 5 | Network |
| 2 | Endpoint | | 6 | Detection & Response |
| 3 | Email & Collaboration | | 7 | Human Risk |
| 4 | Browser & Web | | 8 | **Risk & Exposure** |

**Risk & Exposure is retained, not dropped to preserve an old six-count.** It is
distinguishable as the continuous **visibility and intelligence layer** rather
than a peer control that performs the same function as the other seven — but it
remains part of the eight-block architecture and must be represented.

> **This is a separate system from the 12 public capability lanes and the 14
> internal domains. Do not conflate them.** The taxonomy question below stays
> open on its own terms.

### Consequence: production is showing the stale model

`client/src/components/visual/ProtectionCommandDeck.tsx` defines six domains
(Identity & Access, Endpoint Protection, Email & Collaboration, Network &
Connectivity, Data & Recovery, Governance & Compliance Support). It is rendered
by `client/src/pages/sections/DigeratiHowWeProtectSection.tsx`, which is
imported and rendered by `client/src/pages/DigeratiHomepage.tsx`.

**The live homepage therefore presents the obsolete six-domain model.** Two of
its six (Data & Recovery, Governance & Compliance Support) are not cybersecurity
blocks at all — they map to capability lanes 05 and 09 — and four current blocks
(Browser & Web, Detection & Response, Human Risk, Risk & Exposure) are absent.

Not fixed here. `client/src/**` is claimed by `de-site-v2-scrollcraft` on
another branch and is production code. Flagged for Joe to route.

## Discrepancies — still open

1. **Twelve lanes vs fourteen domains.** This material says "Twelve capability
   lanes." `scrollcraft/EXPERIENCE-PLAN.md` and `docs/CLAIMS-REGISTER.md` both
   say DE operates **fourteen domains** — but **no file in the repository
   enumerates the fourteen**. It is referenced, never listed. Either the twelve
   lanes supersede it, or the fourteen exist only outside the repo. Needs Joe.
2. **2024 vs 2026 client view.** `Downloaded__Client_View…` is headed "WHAT YOU
   GET IN DE's 2024's OFFERING" and knows only **two** ecosystems (Office,
   Business). The 2026 model has four. Treat the 2024 sheet as superseded
   except for its feature vocabulary.
3. **Named vendors.** `2026_Workplace_1.docx` names JumpCloud, Intune,
   Autopilot, Atakama, Teams Calling as the standard build. The 2026 public
   disclosure rule keeps vendor mechanics internal. Reading this as an
   **internal** build sheet, not public content, until confirmed.
4. **Assessment as a door.** Joe describes four visitor choices (ProActive,
   Co-Managed, Standalone, Cyber Security Risk Assessment). The material has
   three doors, with co-managed inside Door 01, standalone under Door 02, and
   assessment as a *stage* rather than a door. The site's decision architecture
   needs this reconciled.

## Provenance

| File | Type | What it carries |
|---|---|---|
| `DE_2026_Client_Platform_ProActive_Ecosystems_Modern.docx` | 119 paras, 58 tables | The fullest 2026 platform statement; primary source |
| `DE_2026_Client_Platform_ProActive_Ecosystems_Modern.pdf` | 18 pp | Rendered form of the above |
| `DE_2026_Client_Platform_ProActive_Ecosystems.pdf` | 14 pp | Earlier 2026 cut; adds the operating-principle framing |
| `Downloaded__Client_View…ProActive_Office_Ecosystem.pdf` | 10 pp | **2024** feature checklist; superseded model, useful vocabulary |
| `2026_Workplace_1.docx` | 4 tables | Internal build worksheet: user tiers, ownership, standard build |

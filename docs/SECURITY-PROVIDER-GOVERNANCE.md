# DE Security Foundation — Provider Governance

Status: standing Digerati Experts product and commercial rule  
Decision owner: Joe  
Effective: 2026-09-25  
Applies to: ProActive Ecosystem, public website projections, Store/Solution Builder, proposals, quoting, onboarding, and internal delivery documentation.

## Client-facing rule

Every ProActive tier includes the **DE Security Foundation**. Security does not first appear at Business.

Public and client-facing surfaces sell DE-managed capabilities, not vendor plans. Do not expose provider names, internal SKUs, DE costs, margins, or distributor terms unless an explicit disclosure policy requires it.

Approved public positioning:

- **IT** — managed IT plus the DE Security Foundation: endpoint, identity, email, awareness, and managed security monitoring baseline.
- **Office** — everything in IT plus 24/7 managed detection and response, managed network, and endpoint backup.
- **Business** — everything in Office plus deeper security operations/response, BCDR, user-cloud backup, compliance/risk reporting, and semi-annual reviews.
- **Enterprise** — everything in Business plus the deepest security tier, unified posture, advanced compliance/governance, custom recovery architecture, and quarterly executive reviews.

## Internal provider rule

The provider role belongs to the solution ↔ provider relationship.

| DE capability | Provider | Role | Lifecycle | Client identity |
| --- | --- | --- | --- | --- |
| DE Security Foundation / Managed Threat Protection | Guardz | primary | active | internal by default |
| DE Security Foundation / Managed Threat Protection | Blackpoint Cyber | backup | active | internal by default |

Guardz is the default platform for new ProActive implementations. Blackpoint Cyber is the approved backup/alternate MDR provider and remains commercially modeled rather than treated as legacy.

## Guardz packaging baseline

| ProActive tier | Guardz package | DE service posture |
| --- | --- | --- |
| IT | Pro | managed-security platform baseline; do not claim 24/7 human MDR |
| Office | Ultimate | 24/7 managed detection and response |
| Business | Ultimate | 24/7 MDR plus deeper DE security operations, recovery, and reporting |
| Enterprise | Elite | deepest endpoint/email/telemetry/response posture plus DE governance |

This mapping is the packaging baseline. Commercial cost and margin still require verified vendor source data before quoting or margin decisions.

**GCC High / CUI guardrail:** Business-GCCH and Enterprise-GCCH inherit the DE Security Foundation service requirement, but they do not automatically inherit the standard Guardz implementation. Provider eligibility, data residency, government-cloud compatibility, and compliance scope must be verified separately before assigning a platform.

## Blackpoint commercial rule

Blackpoint remains the active backup provider. Its exact package mapping, current costs, minimums, entitlements, and margin model must be stored from verified commercial evidence. Unknown values remain **review-required**; never substitute Guardz economics or invent a Blackpoint cost.

## Data required in Hub

For both providers retain:

- vendor package/SKU and included capabilities
- billing basis and DE cost
- minimum commitments and contract term
- paid extras and exclusions
- standalone sell behavior
- packaging state for IT / Office / Business / Enterprise
- gross-margin dollars and percentage
- source/effective date and freshness
- disclosure policy
- primary/backup role and lifecycle

## Projection enforcement

Client-safe output must be shaped from DE capability names before rendering. Do not rely on regex masking to hide provider identity. Public website copy should use **DE Security Foundation**, **Managed Detection & Response**, **Managed Threat Protection**, or other approved DE capability language.

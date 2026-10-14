# Portal ← Hub: client representation contract

**Contract:** `client-org-representation/v1`
**System of record:** Intelligence Hub (`digeratiexperts/Intelligence-Hub`), Client Profile → Organization & Governance → Representation & Delegation. Hub decision: `docs/architecture/CLIENT-ORGANIZATION-REPRESENTATION.md` in that repository.
**Status:** built on branch `claude/org-representation-portal`, not released.

## What it is

The Hub records each client's sites, departments, representatives (primary and backup), what each representative communicates about, delegated coordination duties, and — separately — approval authority. The Portal reads a **client-safe projection** of the representation part and authorizes its own users against it on its own server. The Portal never edits these records.

Representation is coordination, not approval. Nothing in this contract changes who approves a Portal service request (`shared/orgDirectory.ts` leaders, managers and IT contacts still do) or who owns a Zoho Desk ticket.

## Read

`GET {TECHSALES_HUB_URL}/api/webhooks/portal/representation?accountId=<hubAccountId>&portalClientId=<portalClients.id>`

- Signed `portal_to_hub` (`PORTAL_TO_HUB_SECRET`); the HMAC covers path **and query**, so a captured request cannot be replayed for another company.
- `accountId` is the canonical Hub `accounts.id` (`portalClients.hubAccountId`). There is no company-name fallback for this contract; an unmapped company has no representatives.
- Client: `fetchHubRepresentation()` in `server/integrations/techSalesClient.ts` (validated with `representationProjectionSchema`, cached 60 s per company, `null` on any error = nobody represents anything).

Payload (`shared/representation.ts`):

| Field | Meaning |
| --- | --- |
| `active` | Only an **active** Hub representation model publishes groups. |
| `model` | `site`, `department` or `hybrid`. |
| `groups[].scopeKey` | Hub group key: `account`, `site:<id>`, `unit:<id>`. |
| `groups[].kind`, `name` | Client-safe group label. Groups the Hub marks internal are not sent. |
| `groups[].portalRefs` | Portal unit ids the Hub group was imported from (`department:<id>`), when known. |
| `groups[].representatives[]` | Live assignments only: `role`, `displayName`, `email`, `portalUserId`, `communicationScopes`, `responsibilities`, `effectiveUntil`. |

Never sent: approval authority, spending limits, headcounts, job titles, provenance, memberships, other employees, internal notes.

## Matching a Portal user

`groupsRepresentedBy()`: the Hub's `portalUserId` when set; otherwise the user's email, case-insensitively. A row with a `portalUserId` for someone else never matches by email. The end date is re-checked on the Portal side; inactive users and DE admins represent nothing.

## Portal routes (`server/representationRoutes.ts`)

| Route | Who | Returns |
| --- | --- | --- |
| `GET /api/portal/representation/me` | any signed-in Portal user | groups they represent; co-representatives by name and role only |
| `GET /api/portal/representation/requests` | representatives | group requests for the groups they currently represent, in their own company |
| `POST /api/portal/representation/requests` | representatives | files a group request; 403 unless they represent that group **and** their communication scope covers the kind |

Kinds → required scope: `group_request` → `group_requests`; `equipment_collection` → `equipment_collection`; `technology_assessment` → `technology_assessments`; `group_concern` → `group_concerns`.

The company always comes from the session (`effectiveClientId`), never the body (the body schema is strict). A Zoho Desk ticket is opened through the same Desk helper as service requests, tagged with the group and the representative's role, and states that representation is not approval authority. Requests live in `portal_group_requests` (`migrations/0018_portal_group_requests.sql`, additive).

Page: `/portal/representation` ("My Groups" under Account in the Portal nav).

## Not in this version

- Hub → Portal push of representation changes (the Portal pulls with a 60 s cache).
- Group requests are not yet forwarded to the Hub as their own event; DE sees them as Desk tickets.
- The Portal's own site/department leader directory (`/portal/organization`) is unchanged. The Hub imports the leaders it can see on Portal service requests as unverified evidence. Making that directory a read-only projection of the Hub is a separate decision for DE.

# Lane A — Update 1 (from Claude, 2026-10-22). This overrides lane-a-roles-nav.md where they differ.

I checked current `main`. The portal already has the foundations. **Extend them; don't build parallel ones.**

## What exists
| Area | Where | What it does today |
|---|---|---|
| Nav registry | `client/src/components/portal/shell/portalNav.ts` | `PORTAL_NAV_GROUPS` + `PORTAL_ADMIN_GROUP`; `navGroupsFor(user, integrations)` filters items by `navAllowed()` and integration mode; items carry `sample` and `integration` flags |
| Role checks (client) | `client/src/lib/portalRoles.ts` | `navAllowed(user, NavKey)`, `PortalUserSession` |
| Integration modes | `server/portalIntegrations.ts` + `/portal/admin/data-sources` | Per area (vpn, phone, shipping): `hidden` drops the item, `live` clears `sample` |
| DB roles | `shared/schema.ts` | `portalUserRoleEnum` = admin, user, viewer · `memberRoleEnum` = owner, admin, member, viewer |
| DE admin today | `navGroupsFor` | `user.role === "admin"` appends the DE Admin group |

## Adjustments to your plan
1. **The registry is `portalNav.ts`.** Add the per-item rules (roles, entitlement, `featureReady`) to `PortalNavItem`; don't create a new registry. In `docs/lanes/registry.md`, document that Wave 2 lanes may edit only their own items' lines in `portalNav.ts`, which keeps merges small.
2. **Change the sample rule in `navGroupsFor`.** Client roles must never see an item with `sample: true`; drop it for them. DE staff keep seeing it, with the badge.
3. **Extend the roles additively.**
   - Add new enum values with a migration.
   - Keep `admin` working exactly as today. It becomes the break-glass/super-admin class until you introduce the DE staff role.
   - Never rename or drop an existing enum value.
4. **Use the existing company concept.** Reuse the companies/tenants table and the admin "Companies" impersonation; "DE staff switches company" should build on it. Check `docs/PORTAL-REPRESENTATION-CONTRACT.md` before changing how a company is represented.
5. **Account Lifecycle Status stays server-side only** (`docs/ACCOUNT-LIFECYCLE-STATUS.md`).
6. **Two DE Admin sample items** (`/portal/admin/import` "Data Import", `/portal/admin/agents` "Manage Agents") are already admin-only. Leave them; Lanes D and E build them.

Log these decisions in `docs/lanes/lane-a-roles-nav.md`.

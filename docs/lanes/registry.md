# Shared registries — how each lane extends them (lane A)

Three registries cross lane boundaries. The rule for all of them: **add your own
lines/files, never edit another lane's** (docs/plans/opencode/LANE-RULES.md). This
keeps merge conflicts small and ownership obvious.

## 1. Portal navigation — `client/src/components/portal/shell/portalNav.ts`

The one nav registry (`PORTAL_NAV_ITEMS`). Every item declares:

| Field | Meaning |
|---|---|
| `href`, `label`, `icon`, `key`, `hint` | Today's route and label (the break-glass menu renders these unchanged). |
| `section` | Today's menu group (`support` / `account` / `programs` / `tools` / `admin`). Absent = a target-menu hub. |
| `rule` | The item's one visibility rule (`shared/permissions` `AccessRule`): `roles` (client hats), `entitlement`, `featureReady`, `sample`, `deOnly`, `superAdminOnly`, `requiresData`. |
| `target` | Its place in the plan's target client menu: `group`, `label` (the rename), `order`, and `hub` when the item folds into a hub. |
| `children` | Hub items only: the merged member hrefs. |
| `integration`, `sample`, `exact` | Unchanged from before lane A. |

**Wave 2 lanes:** edit only the lines of the items you own (e.g. lane C flips
`featureReady` on IT plan and reviews when its data source is real; lane E renames
nothing but turns `integration: "vpn"` live). If you add an item, add a new entry
block and, if it merges into a hub, one href to that hub's `children`.

View logic lives in `navGroupsFor()` / `isNavAllowed()` / `findNavItem()` — do not
add per-page `if (role === …)` conditions; add or change the item's `rule` instead
("One visibility rule per item", plan Phase 2).

## 2. Permissions — `shared/permissions/`

- `types.ts` — the model and the `ruleAllows()` evaluator (lane A owns).
- `lane-a.ts` — lane A's permission rules.
- `index.ts` — merges every `lane-*.ts` and exports `can(principal, permission, companyId?)`.

**Wave 2 lanes:** create `shared/permissions/lane-<your-lane>.ts` exporting a
`Record<string, AccessRule>`, and add **one import + one spread line** to
`index.ts`. Never edit `lane-a.ts` or another lane's file. Route guards use
`requirePermission(permission, targetCompanyId?)` from `server/portalAccess.ts`.

Rule semantics (full text in `types.ts`):

| Key | Effect |
|---|---|
| `superAdminOnly` | Break-glass (`role=admin`) only. Never widened. |
| `deOnly` | DE staff + break-glass. |
| `sample` / `featureReady: false` | Hidden from clients **and** DE staff; only break-glass sees them (update 3 §3). |
| `roles` | Client hats that hold it. `[]` = no client hat. Undefined = every hat. |
| `entitlement` | The company must hold it (clients only; DE classes bypass). |
| `requiresData` | Nav datum that must be true (`sharedFiles`, `itPlan`) — feed it from `GET /api/portal/me` → `navContext.data`. |
| `scoped` | Default: a client principal only acts inside its own `companyId`. |

## 3. Route guards — `server/portalAccess.ts` + `server/portalAccessRoutes.ts`

- `requirePermission(permission, targetCompanyId?)` — mount next to `authMiddleware`.
- `auditMutation()` — already called from `authMiddleware` for mutating
  `/api/portal/*` requests by DE actors; you do not need to call it.
- `actingCompanyId(req)` — the company the request targets (impersonated for DE
  actors, own company otherwise). Pass it (or the route's `companyId`) to `can()`.

**Wave 2 lanes:** new management routes go in your own `server/<lane>Routes.ts`
(see `registerPortalAccessRoutes` for the shape) and are registered from
`server/routes.ts` `registerRoutes()`.

## Adding an entitlement

`shared/permissions/types.ts` `ENTITLEMENT_KEYS` (lane A), the
`portal_client_entitlements` migration set, and the item's `rule.entitlement`.
Entitlements are **off** for every company until DE staff grant them
(`PUT /api/portal/admin/companies/:id/entitlements`). No Zoho/Hub source is wired —
that is a Joe decision (docs/lanes/lane-a-roles-nav.md "Waiting on Joe").

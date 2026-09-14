# Publish gate — Cursor website integration candidate (2026-09-13)

**Branch:** `cursor/review/website-integration-candidate-20260913`
**BASE_SHA:** `fcad54bbd037cfaf69d40fbb768b93b18cfe3b47` (`claude/stabilization-candidate-20260913`)
**PARENT_SLICE:** `claude-ui-candidate`
**Role:** Combined Cursor backend/security/CRM/routing + C4 marketplace scope on Claude frozen UI. No merge/deploy until DE says so.

## Included on Claude UI base

| Slice | Status |
|---|---|
| seeded-admin P0 + MemStorage residual | Done |
| `/store/` trailing slash + SPA unknown HTTP 404 | Done |
| #214 brandAssets + logo guard (`vite.config.ts` untouched) | Done |
| #209 CRM leadTaxonomy | Done |
| #187 shared-auth minimum (skip ZohoASAPWidget) | Done |
| #196 MFA minimum (crypto, migrations, session-expired, no demo-user) | Done |
| C4 marketplace scope API (`shared/marketplaceScope` + portal routes) | Done |

## Claude freeze integrity

Blob-identical to `fcad54bb` for: ZohoASAPWidget, MarketingChrome, openMspAdvisor, SkipToContent, DefaultCanonical, marketplaceTenantState, PortalMarketplace, vite.config.ts.

## Verification (local)

- vitest focused: 10 files / 37 tests PASS
- tsc --noEmit: PASS
- npm run build --ignore-scripts: PASS
- git diff --check: clean after this doc

## Deploy blockers (DE)

1. Durable `MFA_ENCRYPTION_KEY` in shared `.env` before production.
2. Claude acceptance of this branch on combined tree.
3. Hub #156 review branch separate.
4. No production deploy without DE release authority.

# Publish gate — Cursor overnight candidate (2026-09-13)

**Worktree:** `C:\Users\Joe\DE\Repos\digeratiexperts-site-wt-seeded-admin`  
**Branch:** `cursor/seeded-admin-p0-20260912`  
**Role:** Cursor factory evidence for Claude acceptance review. **No merge/deploy** until DE says so.

## Board status

| # | Item | Result |
|---|---|---|
| 1 | Seeded-admin P0 | **Done** — `0ad1c6bb` preserved; bootstrap gate intact after MFA harvest |
| 2 | `/store/` + SPA unknown HTTP 404 | **Done** — `42ec077e` |
| 3 | #214 brandAssets + logo guard | **Done** — `f8585a20` (`vite.config.ts` untouched; Claude freeze) |
| 4 | #209 CRM taxonomy | **Done** — `bf73d3a2` |
| 5 | #187/#196 minimum harvest | **Done this commit** (see gaps) |
| 6 | Combined test/build | Focused 26/26; `tsc --noEmit` pass; vite+esbuild pass (Windows `prebuild` pdfjs spawn EINVAL — skipped via direct vite/esbuild) |
| 7 | Publish gate | This document — **not** production deploy |

## #5 harvest included

### From #196 (security)
- `server/portalMfaCrypto.ts` + tests — AES-GCM TOTP secrets, hashed backup codes
- `portalAuthStore` encrypt/decrypt on read/write (**bootstrap gate kept**)
- `routes.ts` `findBackupCodeIndex` for MFA verify
- Production fail-closed: `MFA_ENCRYPTION_KEY` in `production.config.ts`
- `scripts/run-migrations.mjs` + `npm run db:migrate`
- Migration standalone enum/UUID fixes (`0001`, `0002`)
- `deploy/vps/env.production.example` + `deploy.sh` migrate-before-activate
- Remove synthetic `demo-user` from `use-auth.tsx`
- `portalApi` session-expired event (no hard 401 redirect)

### From #187 (shared session) — Cursor-owned files only
- DeskLoginCard + store auth/cart/session helpers
- Portal Chat/Login/Survey/SalesProcess + Store Checkout/QuoteRequest
- Cookie-preferred auth middleware: `cookieToken || bearer`
- Dropped localStorage bearer injection from `portalApi`

### Explicitly **not** taken (Claude freeze / out of minimum)
- `client/src/components/ZohoASAPWidget.tsx` — ASK DE widget `onBack` / stationary SSO still Claude-owned
- `vite.config.ts`, MarketingChrome, marketplace, WebP assets, etc.
- Full #196 delete of `electron/` / `agent-installer/` / `shipping.ts` (optional cleanup; left for later)

## Verification evidence

```
vitest (focused): 7 files / 26 tests PASS
  portalMfaCrypto, portalAuthStore.bootstrap, DeskLoginCard,
  brandRuntime, storeLegacyRedirects, spaKnownPaths, leadTaxonomy
tsc --noEmit: PASS
vite build: PASS (~38s)
esbuild server: PASS → dist/index.js
```

## Production deploy blockers (DE / Claude)

1. Set durable `MFA_ENCRYPTION_KEY` in shared `.env` **before** any prod deploy (fail-closed).
2. Claude must land ZohoASAPWidget shared-auth wiring (or accept ASK DE inline gaps).
3. Integrate Claude freeze UI stack with this backend/security/CRM/routing candidate.
4. Full `npm test` suite on a Linux/CI agent preferred (local Windows pdfjs prebuild quirk).
5. No push/merge/deploy until Claude go/no-go + DE release authority.

## Claude review packet

Please accept or return a **single consolidated correction list** for:
- MFA at-rest + backup-code verify path
- Cookie-canonical session + no localStorage bearer gates
- Seeded-admin bootstrap still fail-closed
- CRM taxonomy + routing 404/slash
- brandAssets without touching `vite.config.ts`
- Known gap: ZohoASAPWidget deferred

# Website Audit Remediation Tracker

**Site:** https://digeratiexperts.com  
**Repo:** `digeratiexperts/digeratiexperts-site`
**Started:** 2026-08-12  
**Directive:** Preserve existing functionality. When homepage density is reduced, move content — do not delete — and record a **Content Movement Map**.

---

## Phase 0 — Architecture snapshot

| Area | Finding |
|------|---------|
| Framework | React 18 + Vite + Express (not Next.js). Client routing via **wouter**. |
| Deploy | VPS CyberPanel/OLS → Node `:3300` (`digeratiexperts-site`). Cloudflare in front. |
| Canonical public domain | `https://digeratiexperts.com` |
| Legacy domain | `https://digerati-experts.com` → path-preserving **301** to primary (verified for `/`, `/pricing`, `/solutions`, `/official-network-planner`) |
| Portal host | `https://portal.digeratiexperts.com/portal/*` (same app; see `docs/PORTAL-ROUTING.md`) |
| TechSales / Hub | `https://techsales.digerati-experts.com` → `:3100` (separate) |
| Sitemap | `scripts/generate-sitemap.mjs` → `public/sitemap.xml` |
| robots.txt | `public/robots.txt` (portal/admin/internal/checkout disallowed; Sprint 1 also disallows network planner + ecosystem matrix) |
| Metadata | `client/index.html` defaults + `useSEO` / `react-helmet-async` per page |
| Structured data | `client/index.html` ProfessionalService + `client/src/components/JsonLd.tsx` |
| Google reviews | `/api/google-reviews` — production status **`unconfigured`** (missing valid `GOOGLE_PLACE_ID`); see `docs/GOOGLE-REVIEWS.md` |
| Threat feed | Static curated list (CISA KEV / HHS OCR) — now centralized in `client/src/data/securityUpdates.ts` with freshness rules |
| Analytics | GA4 `G-1YDMJ38SXD` + Clarity/FB/LinkedIn/Bing in CSP |
| Auth boundaries | Public marketing SPA; portal JWT cookie `portalAuth`; store RBAC |
| Design tokens | Tailwind + CSS variables in existing global styles |
| Error handling | Root `ErrorBoundary`; Enterprise route now wrapped with local boundary |

---

## Issue register

| ID | Issue | Severity | Affected route(s) | Proposed fix | Status | Validation |
|----|-------|----------|-------------------|--------------|--------|------------|
| P0.1 | Legacy domain must not compete in SERPs | P0 | `digerati-experts.com/*` | Keep topical 301s to primary; classify A/B/C routes; protect internal tools | **Partial — A verified live; C hardened in Sprint 1** | `curl -sI` redirect chain; Search Console monitoring |
| P0.2 | Network Planner publicly reachable with commercial pricing in client JS | P0 | `/official-network-planner`, legacy mirror | `X-Robots-Tag`, robots Disallow, portal auth gate (prod), client gate UI | **Implemented (Sprint 1)** | Smoke + header check; anon browser → login redirect in prod |
| P0.3 | Enterprise route historically failed | P0 | `/solutions/proactive-enterprise-ecosystem` | Verify root cause; ErrorBoundary; smoke coverage | **Verified working on prod 2026-08-12**; hardened with ErrorBoundary | Browser hydrate shows H1 + pricing; smoke includes route |
| P0.4 | Multiple phone identities [DE_PUBLIC_PHONE] vs [DE_PUBLIC_PHONE] vs fake 555) | P0 | sitewide / advisor / portal | Centralize in `shared/companyContact.ts`; only `PRIMARY_PHONE` ([DE_PUBLIC_PHONE]) is public | **Fixed — literals routed through PRIMARY_PHONE; 480 retired** | `shared/publicPhone.test.ts` |
| P0.5 | Unsupported “60% close within 6 months” claim on homepage | P0 | Homepage stats | Use `cyberAwarenessFacts` / `getHomepageCyberFacts()` | **Fixed** | Unit tests ban substrings; UI uses sourced facts |
| P0.6 | “Recent Threats” presented stale items as current | P0 | Homepage threats | Shared feed + 45-day freshness + empty state | **Fixed** | `securityUpdates.test.ts`; empty state on homepage as of Aug 2026 |
| P0.7 | Wrong founder in Organization JSON-LD (`Michael Torres`) | P0 | Schema / homepage | Set founder to Joseph R. Petro | **Fixed** (audit follow-up) | Grep JsonLd; Rich Results test after deploy |
| P0.8 | Dev/file-path notes leaked in Google reviews UI | P0 | Homepage testimonials | Public-safe empty/unavailable copy only | **Fixed** (audit follow-up) | Visual check; no `googleReviewsManual` / docs paths in DOM |
| P0.9 | Placeholder `(480) 555-1000` in receipt HTML + portal seed | P0 | Orders / portal seed | Use primary `[DE_PUBLIC_PHONE]` via `PRIMARY_PHONE` | **Fixed** (audit follow-up) | Grep `555-1000` |
| P1.x | CTA hierarchy, reviews, case studies, Bill of Rights, homepage restructure, store framing | P1 | marketing | Deferred to Sprint 2–4 | **Pending** | — |
| P2.x | Find My Best Fit, assessment preview, resources, industries | P2 | conversion | Deferred to Sprint 5 | **Pending** | — |
| SEO/A11y/Perf/Sec | Full technical excellence pass | P2 | global | Deferred to Sprint 6 | **Pending** | — |

---

## Sprint 1 — Critical trust (this pass)

### Done

1. **Audit doc created** (this file).
2. **P0.5** — Removed indefensible 60% statistic from `DigeratiStatsSection`; wired to canonical sourced facts.
3. **P0.6** — Centralized security updates; homepage shows max 3 items ≤45 days; empty state when stale; archive page unchanged.
4. **P0.4** — Added canonical NAP in `shared/companyContact.ts` (`PRIMARY_PHONE` = **[DE_PUBLIC_PHONE]**). `[DE_PUBLIC_PHONE]` is retired and must not appear unlabeled in app source.
5. **P0.2** — Network Planner / official ecosystem matrix: robots Disallow, `X-Robots-Tag`, production portal-auth redirect, client auth gate UI.
6. **P0.3** — Production Enterprise page verified loading; route-level `ErrorBoundary`; `useSEO` no longer doubles brand title.
7. **Smoke** — Extended `scripts/public-route-smoke.mjs` for security-updates + internal-tool noindex checks.
8. **Tests** — `companyContact.test.ts`, `securityUpdates.test.ts`.
9. **P0.7–P0.9 (audit follow-up)** — Correct JSON-LD founder to Joseph R. Petro; remove review-integration file paths from public UI; replace receipt/portal `(480) 555-1000` with primary phone.

### Content Movement Map (Sprint 1)

| Old / risk content | Action | New destination |
|--------------------|--------|-----------------|
| Homepage “60% close within 6 months” stat | **Removed** (unsupported claim — not relocated) | Replaced by sourced facts from `cyberAwarenessFacts` (`/resources/cyber-facts` remains archive) |
| Homepage “Recent Threats” stale cards (as “recent”) | **Filtered out of homepage** (not deleted) | Full list remains at `/resources/security-updates` |
| Network Planner public marketing exposure | **De-indexed + auth-gated** (tool preserved) | Same route for authorized users; public visitors → portal login |

*No homepage sections deleted for “cleaner design” in this sprint. Density restructuring is Sprint 3 and will extend this map.*

---

## P0.1 — Legacy domain classification (working map)

### A — Public legacy with current equivalent (path-preserving 301 observed)

| Legacy path pattern | Canonical destination |
|---------------------|------------------------|
| `/` | `https://digeratiexperts.com/` |
| `/pricing` | `https://digeratiexperts.com/pricing` |
| `/solutions` | `https://digeratiexperts.com/solutions` |
| Most marketing paths | Same path on primary (OLS/Cloudflare path-preserving 301) |

### B — Valuable content needing migration

| Item | Notes |
|------|-------|
| TBD via Search Console / Wayback crawl of indexed legacy URLs | Human + SEO crawl still required for any unique pages not on primary |

### C — Internal / private (must not rank)

| Path | Status |
|------|--------|
| `/official-network-planner` | noindex + robots Disallow + prod auth gate |
| `/de-ecosystem-matrix-offical` | same |
| `/portal/*`, `/admin/*`, `/internal/*` | already disallowed / redirected |

---

## Remaining human inputs (not unfinished engineering)

- Valid Google Places `GOOGLE_PLACE_ID` (`ChIJ…`) for live reviews
- Confirm any *labeled* secondary numbers (client support / emergency) if they should ever appear beside the public sales NAP — do not invent them
- Approved client logos + case-study metrics
- Certification verification copy
- Decision: migrate Network Planner permanently into TechSales Hub vs keep portal-gated on marketing app
- Search Console: request indexing/removal for any lingering hyphen-domain URLs

---

## Before / after scorecard (Sprint 1 only)

| Category | Before | After (est.) | Notes |
|----------|--------|--------------|-------|
| Positioning | 78 | 80 | Unchanged architecture; trust copy cleaned |
| Trust | 62 | 78 | Stats + threats + phone/advisor integrity |
| Conversion | 70 | 70 | Sprint 2 |
| Service clarity | 85 | 85 | Preserved |
| Pricing clarity | 82 | 82 | Preserved |
| SEO | 72 | 78 | Legacy 301s + tool noindex |
| Local SEO | 75 | 76 | Phone identity clearer |
| Accessibility | 70 | 70 | Sprint 6 |
| Performance | 72 | 72 | Sprint 6 |
| Security | 68 | 82 | Planner gated + headers |
| Visual design | 80 | 80 | No redesign this sprint |
| Mobile UX | 78 | 78 | — |
| Overall readiness | 74 | 80 | Sprint 1 floor raised |

Target remains **90–100** after Sprints 2–6 without sacrificing depth.

---

## Next execution order

1. Sprint 2 — CTA hierarchy, Google reviews (needs Place ID), case-study shells, founder authority, Bill of Rights elevation, vs-traditional-MSP
2. Sprint 3 — Homepage hierarchy + **expanded Content Movement Map**
3. Sprint 4 — Store prospect vs client marketplace framing
4. Sprint 5 — Find My Best Fit + assessment preview
5. Sprint 6 — SEO/schema/a11y/perf/security deep pass

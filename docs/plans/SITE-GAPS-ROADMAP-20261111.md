# Site gaps roadmap (MSP website research, 2026-11-11)

**Owner:** Grok Bot (Joe's web agent), working on Joe's laptop in worktrees named
`digeratiexperts-site-wt-sitegaps-*`, branches `grok/site-*-20261111`.
**Authority:** Joe, 2026-11-11: "do it, approved ... the raw HTML body needs to be fixed for SEO,
fix all the GAPS", then "implement ALL recommendations on the research page".
**Research:** "MSP Website Research and Improvement Plan for digeratiexperts.com" (compared
mspsites.com and its client sites, ITS / itsasap.com, Kelser, Executech, Integris, Ntiva).
**Ledger / lock:** Intelligence-Hub `docs/work-ledger/` entry and relay issue
[Intelligence-Hub#886](https://github.com/digeratiexperts/Intelligence-Hub/issues/886).
**Mode:** Maintenance for the quick wins, SEO, new pages and templates. The homepage restructure
is a Joe-requested restructure, so it goes up as a draft PR for his review and is never merged as-is.

Every PR is opened, never merged by this agent. No deploys, no VPS, no DB migrations, no live
Zoho or vendor configuration.

## PRs and what each owns

| # | PR | Files and areas it owns | Status |
|---|----|-------------------------|--------|
| 1 | [#1006](https://github.com/digeratiexperts/digeratiexperts-site/pull/1006) Quick wins | `client/src/data/caseStudies.ts`, `pages/resources/CaseStudies*.tsx`, `server/marketingRedirects.ts`, pricing canonical, `shared/organizationSchema.ts`, `client/index.html` JSON-LD, `components/JsonLd.tsx`, `shared/companyContact.ts` social links, homepage-v2 `HeroSection` card + pronunciation, `FaqSection` schema, `pages/about/MissionValues.tsx` | open |
| 2 | [#1007](https://github.com/digeratiexperts/digeratiexperts-site/pull/1007) Raw HTML prerender (on #1006) | `scripts/prerender/*`, `server/prerender.ts`, `server/index.ts` shell send, `client/src/main.tsx` swap | open |
| 3 | [#1010](https://github.com/digeratiexperts/digeratiexperts-site/pull/1010) Help Desk + Switching IT providers pages | new pages under `client/src/pages/`, `App.tsx` routes, `MegaMenu.tsx` entries, sitemap, `spaKnownPaths.ts` | open |
| 4 | [#1008](https://github.com/digeratiexperts/digeratiexperts-site/pull/1008) Reviews readiness (on #1006) | homepage proof/reviews section, rating chip by the hero CTAs (hidden when there are no real reviews) | open |
| 5 | [#1009](https://github.com/digeratiexperts/digeratiexperts-site/pull/1009) Homepage chapters + buyer language + fit call + risk reversal + CTA tracking (draft, on #1008) | `client/src/pages/homepage-v2/**` (labels in `homepage-v2/cta.ts`; `ctaCopy.ts` unchanged), `SolutionsIndex.tsx`, `CyberFacts.tsx`, `lib/analytics.ts` `ctaClicked` | open (draft) |
| 6 | [#1011](https://github.com/digeratiexperts/digeratiexperts-site/pull/1011) City and industry FAQs + city schema | `pages/locations/LocationServicePage.tsx`, four `pages/industries/*`, `data/localFaqs.ts` (FAQ, real facts only; app stacks wait on Joe) | open |

Other agents: please avoid editing the files listed for an open PR here until it merges or closes
(`docs/ACTIVE-WORK-COORDINATION.md`). If you must, comment on the PR first.

## Recommendations and where each lands

1. Real reviews by the hero CTA: PR 4 (renders only real reviews; needs a valid Google Place ID or pasted reviews).
2. Placeholder case studies off the public page: PR 1.
3. 15-minute fit call as the first step, assessment second: PR 5 (uses the existing Zoho Bookings embed at `/book`).
4. Split phone lines / Arizona number: **not changed**. Waiting on Joe's number decision.
5. URL cleanup (`/about`, `/services`, one pricing URL): PR 1.
6. Hero tidy (sample report card, pronunciation to About): PR 1. Proof bar: PR 4.
7. FAQPage schema + one Organization entity + live-only `sameAs`: PR 1.
8. Prerender marketing pages (real body HTML without JavaScript): PR 2.
9. Homepage in about 9 chapters: PR 5.
10. Help Desk page for non-managed clients: PR 3.
11. Buyer-language copy on top-level pages: PR 5 (homepage) and PR 3 (new pages). Technical depth stays on solution pages.
12. Risk reversal and a Switching IT providers page: PR 5 (near CTAs) and PR 3 (page).
13. Real team photos and founder note: the existing Team chapter (Joe's real photo) stays in the new homepage order; **more photos wait on a real shoot** (no stock or AI faces).
14. Stronger city and industry templates: PR 6.
15. Close the follow-up loop: CTA clicks tracked (consent-gated `cta_click`) and fit call to the existing Zoho Bookings page in PR 5; forms already reach Zoho via `/api/assessment`. Chat-to-booking and Zoho follow-up sequences are live Zoho config, left for Joe.

## Inputs only Joe can give

- Arizona phone number and whether to split New business / Client support lines.
- A valid Google Place ID (`GOOGLE_PLACE_ID`), or verbatim reviews pasted into `client/src/data/reviewsCatalog.ts` (see `docs/GOOGLE-REVIEWS.md`). The production Place ID is the one the docs call invalid, so the reviews API returns no rating today.
- Help Desk pricing (none exists in the repo), and the hours for remote support.
- A 15-minute Zoho Bookings service, if the fit call should be 15 minutes (the current embed is a 30-minute call).
- Clients willing to be named in case studies (written approval).
- A photo shoot for Joe and the team.
- Working LinkedIn / Instagram / Facebook URLs, if those profiles should be linked again.
- Approval of the new hero headline draft (PR 5).

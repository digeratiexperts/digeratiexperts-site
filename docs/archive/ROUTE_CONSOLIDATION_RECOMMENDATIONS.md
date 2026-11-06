# Route Consolidation Recommendations

Concrete recommendations for the five groups called out for consolidation review. Every
claim below was re-verified against the current codebase this session (route
declarations in `App.tsx`, `grep` for every inbound `href`/`Link` reference, and the
actual page components) — not carried over unverified from the Phase 1 report. **No
routes have been removed, redirected, or otherwise changed.** This is a decision document.

---

## 1. Pricing — `/pricing`, `/ecosystem-pricing`, `/proactive-ecosystem-pricing`

**Evidence:**
- The primary top-nav "Pricing" link and the mega-menu's "Compare All Packages" link both
  point to `/proactive-ecosystem-pricing` ([MegaMenu.tsx:344-345](client/src/components/MegaMenu.tsx#L344-L345),
  [:254-260](client/src/components/MegaMenu.tsx#L254-L260)) — this is unambiguously the
  canonical page.
- `/pricing` and `/proactive-ecosystem-pricing` render the **literal same component**
  (`ProActiveEcosystemPricing`) at two different URLs ([App.tsx:830-839](client/src/App.tsx#L830-L839))
  — not similar content, identical content, with no redirect between them. `/pricing` has
  exactly one internal inbound link, from `ServiceMatrix.tsx` — a component, not the nav.
- `/ecosystem-pricing` renders a **different**, lighter component (`EcosystemPricing`,
  App.tsx:842-846) — a "Service Matrix" subset of the full pricing page. It has two
  internal inbound links (`ManagedWorkplace.tsx`, `ServiceCapabilityMatrix.tsx`) and its
  own page contains a link **to** `/proactive-ecosystem-pricing`
  ([EcosystemPricing.tsx:426](client/src/pages/EcosystemPricing.tsx#L426)) — it points
  visitors toward the fuller page itself, effectively self-identifying as secondary.

**Recommendation:**
- Make `/proactive-ecosystem-pricing` the sole canonical URL. Add a permanent (`301`-
  equivalent SPA) `<Redirect>` from `/pricing` → `/proactive-ecosystem-pricing`. This is a
  same-component duplicate with zero content divergence — the safest possible
  consolidation, no content loss is even possible.
- For `/ecosystem-pricing`: fold whatever unique value the lighter "Service Matrix" view
  has (if any — worth a quick content diff before deciding) into
  `/proactive-ecosystem-pricing` as a section/tab, then redirect `/ecosystem-pricing` →
  `/proactive-ecosystem-pricing` too. Update its two inbound links
  (`ManagedWorkplace.tsx`, `ServiceCapabilityMatrix.tsx`) to point at the canonical URL
  directly rather than relying on the redirect.
- **SEO note:** if either URL is indexed/has external backlinks, a redirect preserves that
  equity; outright deletion would not. Redirecting (not deleting) is the recommendation
  specifically because it's non-destructive either way.

---

## 2. Compliance — `/about/compliance`, `/about/insurance`, `/about/compliance-certifications`

**Evidence:** All three are lazy-loaded, independently-routed pages
([App.tsx:407-426](client/src/App.tsx#L407-L426)) with **zero inbound links from any other
page, nav item, or footer** — confirmed by grepping every `.tsx` file in `client/src` for
each path; the only matches are each page's own file and the route table. Each has a
genuinely distinct angle, not copy-pasted content:
- `/about/compliance` — "Audit-Ready Compliance Documentation": evidence/documentation
  generation.
- `/about/insurance` — "Insurance-Aligned Security & Compliance": cyber-insurance carrier
  requirements specifically.
- `/about/compliance-certifications` — "Navigate Compliance with Confidence": the
  broadest page, a framework-by-framework map (HIPAA, CMMC, PCI-DSS) with an explicit,
  legally-relevant disclaimer that DE is not SOC 2 Type II certified and does not certify
  a client's organization.

**Recommendation:** These three are a case for **content merge**, not just a redirect —
unlike the pricing group, they are not duplicates, they're three unlinked fragments of
what should be one page's sections.
1. Make `/about/compliance-certifications` the canonical destination — it's the broadest,
   most complete framing and already carries the important legal disclaimer.
2. Fold `/about/insurance`'s carrier-requirements angle in as a dedicated section
   ("Meeting your cyber-insurance carrier's requirements") and `/about/compliance`'s
   documentation/evidence angle in as another section ("Audit-ready documentation") —
   both add real, non-redundant value the canonical page doesn't currently have.
3. Redirect `/about/compliance` and `/about/insurance` to the merged canonical page.
4. Link the merged page from primary nav or the About section footer — right now a
   genuinely useful, legally-careful page has no discovery path at all, which is the
   bigger problem being masked by "which of the three" confusion.

---

## 3. Internal tool — `/official-network-planner`

**Evidence:** Zero inbound links from any public page ([App.tsx:853-857](client/src/App.tsx#L853-L857)
is the only reference besides the component's own file). The component itself calls
`GET /api/portal/me` on mount ([NetworkPlannerOfficial.tsx:40](client/src/pages/NetworkPlannerOfficial.tsx#L40))
and gates its content on that check — it is functionally a staff-only tool. But the
*route* is registered in the public marketing route tree, not under `/portal/*`, so it's
reachable pre-auth by anyone who knows or guesses the URL (they'd see a gated/empty state,
not the tool itself, but the route existing outside `/portal/` is still a routing-hygiene
issue, not just a discoverability one).

**Recommendation:** Move the route to live under `/portal/` (e.g.,
`/portal/tools/network-planner`), matching where every other staff-gated screen lives, and
remove it from the public route tree entirely. This isn't a content-consolidation case —
it's a misplaced internal tool that should never have been mounted alongside marketing
pages. Zero visitor-facing impact since nothing links to the current URL.

---

## 4. Orphan — `/de-ecosystem-matrix-offical`

**Evidence:** Zero inbound links (only its own file + the route table). Renders its own
distinct component, `EcosystemMatrixOfficial` ([App.tsx:848-852](client/src/App.tsx#L848-L852))
— a **third**, separate implementation of tier-comparison content, alongside
`/proactive-ecosystem-pricing` and `/ecosystem-pricing`. The URL itself contains a typo
("offical" instead of "official"), which alone is strong evidence this was never meant to
be a real, permanent, linked destination — it reads like a working/staging URL that was
never cleaned up.

**Recommendation:** Safe to remove outright (not just redirect) — nothing links to it
internally, and a misspelled URL is exceptionally unlikely to have accumulated meaningful
external backlinks or organic search traffic. Before deleting, do one quick check that
wasn't done this session: confirm it's not present in `public/sitemap.xml` or Google
Search Console's indexed-URL list; if it is indexed, add a redirect to
`/proactive-ecosystem-pricing` instead of a bare 404, purely to avoid an indexed-URL error
spike, then remove the route.

---

## 5. Quote entry — `/quote-wizard`

**Evidence:** More nuanced than a simple orphan. `/quote-wizard` itself has no inbound
links from navigation, footer, or any marketing page — confirmed by grep. But it is not
fully isolated: `QuoteConfirmation.tsx` (the page a completed wizard session lands on)
links **back** to `/quote-wizard` three times ([QuoteConfirmation.tsx:46,59,65](client/src/pages/QuoteConfirmation.tsx#L46))
— as a breadcrumb and as a "start over" fallback when no saved quote session exists. So
the real shape of the problem is: **`/quote-wizard` is the entry point of a real,
self-contained flow that ends at `/quote-confirmation`, but nothing on the site sends a
new visitor to the start of that flow.** The flow exists and presumably works; it's
missing a front door, not missing a reason to exist.

**Recommendation:** This is a wiring gap, not a consolidation candidate — don't fold its
purpose into `/book` (that would discard a working, more specific intake flow for a more
generic one). Instead, add a real entry point: a CTA from wherever a visitor is deciding
between "book a call" and "get a quote" (the homepage, `/store`'s guided landing, or a
Solutions hub page would all be reasonable candidates — Store's own guided
question-flow language, "Three short questions. We start identity from your work email in
the background, then show Solutions or the Client Marketplace," suggests `/quote-wizard`
might even be a natural alternative or feeder for that exact guided-store moment; worth a
product decision on which surface owns "help me figure out what I need" rather than
having two separate wizards with no cross-link).

---

## Summary table

| Group | Verdict | Action |
|---|---|---|
| `/pricing` | Exact duplicate of `/proactive-ecosystem-pricing` | Redirect (no content loss possible — same component) |
| `/ecosystem-pricing` | Subset content, self-links to canonical page already | Merge unique content, then redirect |
| `/about/compliance`, `/about/insurance` | Distinct-but-unlinked angles | Merge into `/about/compliance-certifications` as sections, then redirect, then **link the result from nav/footer** |
| `/about/compliance-certifications` | Keep as canonical, currently undiscoverable | Add nav/footer link after merge |
| `/official-network-planner` | Misplaced internal tool on public route tree | Move under `/portal/`, remove from public routes |
| `/de-ecosystem-matrix-offical` | Third duplicate tier-comparison page, typo'd URL, zero links | Safe to remove outright (check sitemap/GSC first) |
| `/quote-wizard` | Real flow, missing a front door — not a duplicate | Add a real entry CTA; do not merge into `/book` |

No destructive action is recommended without the sitemap/GSC check noted above for the
one outright-removal candidate. Every other recommendation is a redirect or a merge,
which preserves any existing SEO value or external links by construction.

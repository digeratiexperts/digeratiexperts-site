# Review: security headers and CSP on portal pages

Status: **two small fixes in this PR, the rest for DE review.** Backlog task 19 (T2), 2026-10-10.

Scope: the headers `setSecurityHeaders` (`server/middleware/security.ts`) puts on
every response, read for the client portal (`/portal/*` pages on
`portal.digeratiexperts.com` and the `/api/portal/*` API). The live site could
not be fetched from the review sandbox, so this reads the code, not production
responses; confirm with `curl -sSI https://portal.digeratiexperts.com/portal/login`.

## Fixed in this PR (clear bugs, small)

1. **`X-XSS-Protection: 1; mode=block` → `0`.** Current browsers ignore the
   header; the legacy auditors it switches on in old ones could be abused to
   blank or probe page content. OWASP's secure-headers guidance is `0` (or
   omit) with a CSP doing the work, which this site has.
2. **Portal API responses default to `Cache-Control: no-store`.** `/api/portal/*`
   answers are per-user (tickets, invoices, people, files) and most routes set
   no cache header, so a browser or an intermediary was free to store them.
   The middleware now sets `no-store` for `/api/portal/` paths; a route that
   sets its own header still overrides it. None of the 61 `/api/portal`
   routes set a public cache today.

Both are covered by `server/middleware/securityHeaders.test.ts`.

## For review (not changed)

Ordered by how much they matter for the portal.

| # | Finding | Why it matters | Suggested direction | Effort / risk |
|---|---|---|---|---|
| 1 | **Marketing analytics run on portal pages.** `initAnalytics()` (`client/src/main.tsx`) loads GA, Meta, LinkedIn, Bing and Microsoft Clarity on every route once a visitor consents, including signed-in `/portal/*` pages. The shared CSP allows all of them there. | Clarity records sessions; masking is on by default for inputs, but rendered text (ticket bodies, invoice lines, people) can reach third parties. A client agreeing to marketing cookies on the public site is not agreeing to this. | Skip `initAnalytics()` on `/portal` paths and on the portal host, and give portal pages a CSP without the analytics origins. | Small code change; needs DE's call on what portal analytics, if any, are wanted. |
| 2 | **`script-src 'unsafe-inline'` in production.** | Any HTML injection becomes script execution; the CSP's main XSS protection is off. | Move inline scripts to files or hashes, then drop `'unsafe-inline'` (nonces need per-request HTML). Start with `Content-Security-Policy-Report-Only` to find breakage. | Medium; touches the analytics loader and any inline snippet in `index.html`. |
| 3 | **`/api/health` is anonymous and detailed.** It returns the release commit, `env`, port, which integrations are configured, payments readiness, Desk auth state, spool counts and the staging-review state. The backlog assumed anonymous health was non-disclosing; it is not. | Reconnaissance: tells an attacker which integrations exist and their state. | Keep `status` and `services.database` public (the production-health workflow reads them), move the rest behind an admin check (e.g. `?detail=1` with `requireAdmin`). Deploy verification already uses `release.txt`, so the commit can leave `/api/health`. | Small code change plus a workflow check; decide together with item 4. |
| 4 | **`/release.txt` is public.** | Exposes the exact deployed commit. The repository is public, so this mostly tells an attacker how current production is. | Keep it: the deploy job and the Cloudflare purge read the public copy to prove the edge serves the new release. Or move both to a token-protected endpoint. | Low risk as is. |
| 5 | **`img-src 'self' data: https: blob:`** | Any HTTPS host can receive image requests, an easy exfiltration channel after an injection. | List the hosts actually used (Zoho, Google, analytics) for portal pages. | Low; needs an inventory of image hosts. |
| 6 | **No CSP violation reporting** (`report-to` / `report-uri`). | Breakage and attacks are invisible. | Add a `report-to` endpoint that logs violations (rate-limited). | Low. |
| 7 | **One CSP for marketing and portal.** `frame-src` allows `www.facebook.com` and `td.doubleclick.net`; `connect-src` allows ad and analytics hosts. | The portal does not need them. | A stricter portal policy keyed on the portal host or `/portal` paths (pairs with item 1). | Low once item 1 is decided. |
| 8 | **`style-src 'unsafe-inline'`.** | CSS injection is a weaker risk than script, but can still leak attribute values. | Leave for now; Radix/Tailwind runtime styles need it. | Not worth it yet. |
| 9 | **HSTS `includeSubDomains; preload`.** | Correct for the site; every `*.digeratiexperts.com` subdomain must serve HTTPS forever once preloaded. | Confirm no subdomain (staging, mail, legacy) still needs plain HTTP before submitting to the preload list. | Check only. |
| 10 | **`Cross-Origin-Opener-Policy: same-origin`.** | Breaks `window.opener` for any payment or OAuth popup. Current flows are redirects, so it looks fine. | If a popup flow is added (Zoho Payments, Zoho OAuth), use `same-origin-allow-popups` on that page. | Check only. |

Headers that are correct and stay: `Strict-Transport-Security`,
`X-Frame-Options: SAMEORIGIN` with `frame-ancestors 'self'`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` (camera, microphone, geolocation off; passkeys are not
restricted by it), `Cross-Origin-Resource-Policy: same-site`,
`object-src 'none'`, `base-uri 'self'`, `form-action 'self' https://payments.zoho.com`,
`X-Robots-Tag: noindex, nofollow` on portal paths, and the vault download's own
`default-src 'none'; sandbox` (`server/portalClientVault.ts`).

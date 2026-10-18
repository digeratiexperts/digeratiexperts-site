# Proposal: the year-long cache on /downloads

Status: **proposal for DE review. No headers were changed by this audit.**
Backlog task 18 (T2), 2026-10-10. Source facts reconciled against `main`
7d441d5f on 2026-10-18; external proxy settings remain unverified.

## What the backlog said

"/downloads" is served with a one-year cache. The ask: audit it, write up the
options and risks, and leave the headers alone.

## What the repository actually does

1. **No code in this repository serves `/downloads`.** There is no route, no
   static mount and no `client/public/downloads/` folder. The only mention in
   history is sample data removed in January 2026 (`8124f6b8`, a placeholder
   `fileUrl: "/downloads/agents/jumpcloud-<id>.msi"`).
2. A request for `/downloads/<anything>` therefore falls through to the SPA
   fallback in `server/index.ts` and gets `index.html` with
   `Cache-Control: no-cache, no-store, must-revalidate` and a 404 status.
   `server/spaKnownPaths.ts` grants 200 only to known client routes; it does not
   include `/downloads`. This describes application source, not an external
   proxy or download host.
3. The app's own long caches come from `server/staticCacheControl.ts`:

   | Path in `dist/public` | Cache-Control |
   |---|---|
   | `release.txt`, `*.html` | `no-cache, no-store, must-revalidate` |
   | a file directly in `assets/` matching `<name>-<8-character hash>.<ext>` | `public, max-age=31536000, immutable` (one year) |
   | images anywhere else | `public, max-age=2592000` (30 days) |
   | everything else (resource PDFs, fonts, manifest) | `public, max-age=86400, must-revalidate` (1 day) |

   Resource PDFs under `assets/resources/...` revalidate after one day;
   image covers under `assets/covers/...` use the 30-day image rule. Plain,
   unhashed files directly in `assets/` also follow their file-type rule, not
   the immutable rule. The old one-year default was removed on 2026-10-02;
   the hash-name guard was added on 2026-10-14.

So if production shows a one-year cache on a `/downloads` URL today, it is
being set **outside this application**. The candidates, in order of likelihood:

- **Cloudflare.** Caching → Configuration → *Browser Cache TTL* (when not set to
  "Respect Existing Headers" it overrides the origin; `deploy/vps/README.md`
  already asks for "Respect Existing Headers"), or a Cache Rule / Page Rule
  matching `/downloads*` with an Edge or Browser TTL of a year.
- **OpenLiteSpeed / CyberPanel.** A static context or rewrite for `/downloads`
  in front of the Node proxy (for example a folder of installers in
  `public_html/downloads`) with `expires` enabled. `deploy/vps/openlitespeed-proxy.md`
  says no docroot static context should sit in front of the app, because stale
  files there would shadow it.
- **A different host.** A `downloads.` subdomain or the Intelligence Hub serving
  the files, not this site.

## How DE can confirm which one (two minutes)

```bash
# What the edge returns, and whether Cloudflare served it from cache
curl -sSI https://digeratiexperts.com/downloads/<a real file> | grep -iE 'cache-control|cf-cache-status|age|expires|server|content-type'
# What the origin returns, bypassing Cloudflare (on the VPS)
curl -sSI http://127.0.0.1:3300/downloads/<a real file>
```

- Origin answers `index.html` / `no-store` but the edge answers `max-age=31536000`
  → a Cloudflare rule. Check Caching → Cache Rules and Rules → Page Rules.
- The VPS answers the file itself with a year (via OpenLiteSpeed on port 443,
  not 3300) → an OpenLiteSpeed context. Check the vhost's contexts in CyberPanel.
- Neither → the file is on another host; audit it there.

## Options

| Option | What changes | Benefit | Risk |
|---|---|---|---|
| **A. Versioned file names, keep the year** | Every published download carries its version or a hash in the name (`DE-TechTool-v1.10.3-<build>.zip`); the page links the new name | Fast repeat downloads, no purge needed, an old link keeps working | Needs a naming discipline; a file republished under the same name stays stale for up to a year in browsers (a Cloudflare purge cannot clear browser caches) |
| **B. Short cache with revalidation** | `public, max-age=3600` (or 86400) `, must-revalidate`, with ETag/Last-Modified | Republishing under the same name shows up within the hour/day | More revalidation requests; slightly slower repeat downloads |
| **C. Stable "latest" URL that redirects** | `/downloads/latest/<product>` → 302 (short cache) to a versioned file cached for a year (A + B) | Stable link for docs and email, immutable files underneath | One more moving part to maintain |
| **D. Serve downloads from the app** | A route in `server/` (or `client/public/downloads/` + a rule in `staticCacheControl.ts`) so the policy is in code, tested and reviewed | The policy is visible in the repo and covered by `staticCacheControl.test.ts` | Large binaries through Node; repository size if installers are committed (they should not be) |
| **E. No change** | — | — | Any file replaced under the same name is pinned in visitors' browsers for a year; a security fix to a downloadable installer would not reach people who already fetched the old one |

## Recommendation for DE to decide

Option **C** (or **A** if there is only one or two files): the files themselves
can stay cached for a year because their names change, and the one URL people
bookmark revalidates. If installers or security tooling are ever served from
`/downloads`, do not leave option **E** in place: a year-long, same-name cache
is exactly how a patched installer fails to reach the people who need it.

## Related risk found in the same audit (fixed 2026-10-14)

The old `server/staticCacheControl.ts` rule gave the immutable one-year header
to any file directly in `assets/`, including a hand-placed file with a stable
name. On 2026-10-14 the rule was tightened to Vite's
`<name>-<8-character hash>.<ext>` pattern, with a regression test. Current
source has that guard. This resolved application risk does not establish the
cache policy of a separate `/downloads` host or proxy.

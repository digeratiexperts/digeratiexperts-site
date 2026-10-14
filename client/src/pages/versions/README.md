# Homepage versions

Every homepage the site has had or is considering stays reachable at
`/version-<n>`, listed at `/versions`, so nothing is lost when the next
one lands and any of them can be referenced in future development.

## The rule

- **A version is frozen.** Never edit a `v<n>/` folder. If an idea changes,
  it gets the next number.
- **Numbers are sequential and never reused.** `registry.ts` is the single
  list; `/versions` and the routes in `client/src/App.tsx` read it.
- **Reference only.** Version pages are `noindex`, canonical to `/`, absent
  from the sitemap (`scripts/generate-sitemap.mjs` uses a curated list), and
  never linked from navigation. Each carries a ribbon naming its number.
- **What a snapshot preserves:** the homepage composition
  (`DigeratiHomepage.tsx`), every section it imports, and the components
  listed in the snapshot script's `LOCALISE` map (currently
  `EcosystemProgression`). Shared primitives, hooks, data files, and the
  design tokens stay live on purpose; they are the site's system, not a
  version's copy.

## Versions

| n | Route | What | Kind |
| --- | --- | --- | --- |
| 1 | `/version-1` | Production homepage as on `main` (2d7d12a), snapshot 2026-09-02 | react snapshot |
| 2 | `/version-2` | Version B, the Scrollcraft story page (forwards to the static `/v2`) | static |
| 3 | `/version-3` | Diagram-system sections, PR #178 with the review corrections (c03cad9) | react snapshot |
| 4 | `/version-4` | Clean-sheet redesign, ten chapters (PR #266, merged 2026-09-30) | build |
| 5 | `/version-5` | The practical homepage: one conventional page, every fact from the site's own data files, acceptance script as the definition of done (PR #292, merged 2026-10-01) | build |
| 6 | `/version-6` | Live homepage cleaned in the current DE theme (Claude layouts). Version 5 stays at `/version-5`. | build |
| 7 | `/version-7` | Every live section built from Joe's reviewed mockups (PR #315), live interactions kept, bottom bar with autohide | build |
| 8 | `/version-8` | Version 7 with Joe's 2026-10-03 preferences (live trust strip, Why Arizona cards, light icon tiles); the homepage at `/` since 2026-10-03; `/version-8` is a 301 to `/` | build |
| 9 | `/version-9` | Version 8 with the Signal Thread: one thread through every section, step nodes, content motifs and four kie.ai plates (concept, draft PR; does not replace `/`) | build |
| 10 | `/version-10` | Version 8 with the scene story: one kie.ai scene of the visitor's business that changes state across the opening chapters and returns at the close (concept, draft PR; does not replace `/`) | build |

`/version-0` (not in the registry, which numbers from 1): the previous homepage (`DigeratiHomepage`) rendered as a noindex reference, without structured data. Joe, 2026-10-03: kept when Version 8 replaced `/`.

## Adding a version

1. Freeze the composition you want to keep, from the working tree or a ref:

   ```bash
   node scripts/snapshot-homepage-version.mjs 5              # working tree
   node scripts/snapshot-homepage-version.mjs 5 origin/main  # a git ref
   ```

   The script refuses to overwrite an existing `v5/`.
2. Add the entry to `registry.ts` (number, title, date, status, summary,
   source).
3. Add the route in `client/src/App.tsx` next to the other `/version-*`
   routes, wrapped in `VersionFrame`.
4. Run `npx tsc --noEmit` and `npx vitest run client/src/pages/versions`.

A static build (a Scrollcraft page, an HTML prototype) is a version too:
serve it from `public/<folder>` with `X-Robots-Tag: noindex` in
`server/index.ts`, redirect `/version-<n>` to it there, and register it with
`kind: "static"`.

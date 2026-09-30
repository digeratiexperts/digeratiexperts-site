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
| 4 | `/version-4` | Sections recomposed to flow on scroll (Experience Plan §09) | planned |

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

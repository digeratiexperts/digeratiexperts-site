# Design-system layers

Added 2026-11-18 after reviewing what documentation platforms such as zeroheight offer (single source of truth, tokens, guidance, governance, adoption analytics, AI access). We took the layers this repo lacked. Nothing here changes a token, a component or a page; it is additive and free (no paid service, no network).

| Layer | Where | How it stays true |
|---|---|---|
| Tokens | `/design-system` (Tokens) | Values are read from `client/src/index.css` by the generator |
| Component guidance (status, tier, do/don't, accessibility) | `client/src/design-system/registry.ts` | Hand-written, tested to have all three guidance lists and an existing file |
| Living styleguide | `/design-system` (noindex, header `X-Robots-Tag`, not in nav) | Renders `manifest.generated.json` and live components |
| Agent manifest | `design/design-system.json` | `npm run design-system:build`; `:check` fails when stale |
| Version diff | `/design-system#versions`, linked from `/versions` | Reads `client/src/pages/versions/registry.ts` |
| Changelog | `CHANGELOG` in the registry | Newest first, never deleted, Joe-decided items marked |
| Adoption report | `/design-system#adoption` | Import scan of `client/src` on each build |

## For agents

Before adding a component or hard-coding a colour, read `design/design-system.json`: use a listed token or component. To add or retire a component, edit the registry, run `npm run design-system:build`, commit both generated files. `npm run design-system:check` fails on a stale manifest, a missing file, or a deprecated component still imported.

Not taken from the platforms: hosted editing, Figma sync, and AI doc rewriting. Those need an account or spend and are DE's call.

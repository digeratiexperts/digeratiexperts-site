# Shared DE PDF brand tokens

Client-facing PDF packets should use the same brand bits:

| Token | Value | Role |
| --- | --- | --- |
| Graphite cover | `#050312` | Cover / deep field |
| Paper | `#F7F5F2` | Meta strip / closing |
| Magenta | `#D3126A` | Accent, section rules, chips |
| Magenta soft | `#fce7f0` | Soft fills |
| Ink / muted | `#1a1520` / `#6b6680` | Body type |
| White logo | `de-logo-white.png` data URI | Cover mark |

## Sources of truth (keep in sync by hand)

- Website: `server/pdf/dePdfBrand.ts`
- Hub (when mirrored): `artifacts/api-server/src/lib/de-pdf-brand.ts`

RIC Master Plan keeps its approved indigo print palette in
`ric-plan-pdf-renderer.ts` and does not import these tokens.

## Rendering

- Hub: WeasyPrint via `renderHtmlToPdf` in `signature-doc-renderer.ts`
- Website Store packets: WeasyPrint first, Playwright Chromium `page.pdf()`
  fallback when native WeasyPrint libs are unavailable

### Production activation (website VPS)

Either:

1. Install WeasyPrint for the site Python (`pip install weasyprint` + pango/cairo), set `PYTHON_BIN` if needed, **or**
2. Ensure Chromium is present: `npx playwright install chromium` (or set `PDF_CHROMIUM_PATH`). `playwright` is a production dependency so `npm ci` keeps it.

Until one renderer works, `POST /api/public/solutions/packet-pdf` returns **503** (fail soft). Browser **Print** remains available as secondary.

## VPS deploy

`deploy/vps/deploy.sh` runs `npx playwright install chromium` after `npm ci`
(as the service user, so the runtime finds the browser in the same cache) and
smoke-launches it. Both steps only log `WARN` on failure; set
`SKIP_PDF_BROWSER=1` to skip. If the smoke launch reports missing system
libraries, an admin runs `sudo npx playwright install-deps chromium` once.

# Shared DE PDF brand tokens

Client-facing PDF packets should use the same brand bits on both repos:

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
- Hub: `artifacts/api-server/src/lib/de-pdf-brand.ts`

RIC Master Plan keeps its approved indigo print palette in
`ric-plan-pdf-renderer.ts` and does not import these tokens.

## Rendering

- Hub: WeasyPrint via `renderHtmlToPdf` in `signature-doc-renderer.ts`
- Website Store packets: WeasyPrint first, Playwright Chromium `page.pdf()`
  fallback when native WeasyPrint libs are unavailable (e.g. Windows without GTK)

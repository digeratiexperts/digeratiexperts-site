# Store PDFs on the DE document system: review samples

**EXAMPLE data only.** The names, companies, orders and quote numbers below are test fixtures, not clients.

## Samples

| File | Shows |
|---|---|
| `pdf/quote.pdf` | Preliminary quote (DE-ST-QTE): KPI summary, line items, notes from the request, next step |
| `pdf/order-confirmation.pdf` | Order confirmation (DE-ST-ORD), paid |
| `pdf/receipt.pdf` | Portal receipt (DE-ST-RCP), paid, with the full billing address (bearer owner) |
| `pdf/order-long-unpaid-redacted.pdf` | 26-line unpaid order, opened by confirmation token. 3 pages; the header row repeats, rows don't split, and there is no billing address |
| `pdf/solution-packet.pdf` | Solution packet (DE-ST-SOL), two packages |
| `pdf/quote-chromium.pdf` | The same quote rendered by the Chromium fallback |
| `pages/*.png` | Every page at 110 dpi |

## Rendering

- The PDFs were rendered with WeasyPrint 70 (`pdf_tags=True`), the production primary.
- The Chromium fallback (`tagged`, `outline`) renders the same layout.
- Both engines produce tagged PDFs, with fonts embedded as CID TrueType subsets (no Type 3).

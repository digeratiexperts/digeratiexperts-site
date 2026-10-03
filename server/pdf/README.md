# Store client documents: DE document system

The four Store documents use the **DE document system**: the same tokens, type
and registers as the resource PDFs (`scripts/de-documents/`, approved record
`design/approved/de-document-system-2026-10-03.md`). The documents are the
preliminary quote, order confirmation, portal receipt and solution packet.

| Document | ID | Builder |
| --- | --- | --- |
| Preliminary quote | `DE-ST-QTE` | `server/storeQuotePdf.ts` |
| Order confirmation | `DE-ST-ORD` | `server/pdf/storeOrderPdf.ts` (`confirmation`) |
| Portal receipt | `DE-ST-RCP` | `server/pdf/storeOrderPdf.ts` (`receipt`) |
| Solution packet | `DE-ST-SOL` | `server/pdf/solutionPacketPdf.ts` |

## Transaction family

Each document combines the registers in the same order:
1. **Brief band** (graphite, reverse logo): what the document is, its number, who it is for, and a status stamp (Preliminary, Paid, Awaiting Payment, Draft).
2. **Spec strip**: labelled identification cells.
3. **Spec body**: numbered sections, a line-item table with a repeating header, cadence labels and a ruled total.
4. **Brief close**: next step with live `tel:`, `mailto:` and portal or site links.

Every page after the first carries a running header with the document type, number and ID. The footer reads "Page N of M".

## Building blocks

All in `dePdfBrand.ts`: `coverBlock`, `specStrip`, `section`, `closeBlock`, `documentHtml`, plus `esc` and `usd`.

## Single sources

- **Tokens and font list:** `shared/deDocumentTokens.ts`, shared with `scripts/de-documents/system/styles.mts`.
- **Fonts:** static TTF instances from `scripts/de-documents/fonts/` (OFL), base64-embedded. They are static because Chromium embeds variable fonts as Type 3, which breaks text extraction.
- **Logo:** `brand/digerati-logo-reverse.svg`, with `deLogoWhiteDataUri.ts` as the PNG fallback.
- **Phone and emails:** `shared/companyContact.ts`. The quote's `sales@digerati-experts.com` is pre-existing and still needs DE confirmation (see #339).

## Colour rules

Magenta `#D3126A` is used only for rules and bars. Magenta text uses `#B80F5C`. Status is always spelled out in words, never shown by colour alone.

The Hub (`artifacts/api-server/src/lib/de-pdf-brand.ts`) and the RIC Master Plan keep their own palettes and do not import these tokens.

## Rendering

- Hub: WeasyPrint via `renderHtmlToPdf` in `signature-doc-renderer.ts`
- Website Store packets: WeasyPrint first (`pdf_tags=True`, tagged PDF on
  WeasyPrint 63+), Playwright Chromium `page.pdf()` fallback (`tagged`,
  `outline`, CSS page size and margins). Both engines were checked to render
  the documents identically.

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

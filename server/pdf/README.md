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

## Accessibility (PDF/UA-1)

`renderHtmlToPdf` finishes every document with `finalizePdf.ts`. This is the server-side port of `scripts/de-documents/lib/finalize.py`, built on `pdf-lib`. It fixes the three gaps veraPDF finds in both engines' tagged output:

- **Artifacts:** painting outside marked content (rules, cell borders, backgrounds, the running header and footer) is wrapped as `/Artifact`.
- **Links:** every link annotation gets `/Contents`, for example "Email Digerati Experts at …".
- **Metadata:** XMP with `dc:title`, the language and the PDF/UA identifier, plus `DisplayDocTitle`.
- **PDF 2.0 tags:** Chromium 151 tags `<strong>` as `/Strong`, a type PDF 1.7 does not define. The order template's billing name is one such tag. Such types are role-mapped to their PDF 1.7 equivalent (`Strong`/`Em` → `Span`), which fixes veraPDF 7.1-5. The CI guard found this on 2026-10-05: production order and receipt PDFs had been failing it since Chromium 151.

The PDF/UA identifier is written only when the file is tagged. If finishing fails, the PDF is returned as rendered.

**Validation (2026-10-04):** veraPDF 1.30.2, PDF/UA-1 profile, through `renderHtmlToPdf`. The quote, order confirmation, portal receipt, a 3-page order opened by confirmation token, and the solution packet all pass:
- Chromium (production): 5/5.
- WeasyPrint 70: 5/5.

Rendering is pixel-identical before and after finishing.

**CI guard:** the "Store PDF check" step (`npm run check:store-pdfs`) renders every sample in `scripts/qa/storePdfCases.ts` through `renderHtmlToPdf`. There are 13 of them, covering each template state: quotes with 1, 5 and 30 items, notes, and special characters; orders that are paid, awaiting payment, cancelled, empty, or long and redacted; a receipt; solution packets with 1 and 3 packages. Each PDF is checked for:
- **Layout:** the page count. Short documents stay on one page; long ones paginate.
- **Content:** the expected text extracts. Redacted text is absent. Nothing like "undefined", "NaN", an HTML entity or a placeholder leaks into the text, and no account lifecycle value prints.
- **Metadata:** the title matches the HTML, every link has a text alternative, and the file is under 1 MB.
- **Structure:** checked by `scripts/de-documents/lib/verify.py`, the same verifier the resource PDFs use. The file is tagged; fonts are embedded with ToUnicode and none are Type 3; there is no untagged painting and no split words; and veraPDF PDF/UA-1 passes.

CI uploads the PDFs, their HTML sources, page previews, `report.json` and `summary.md` as the `store-pdfs` artifact, and writes the summary table to the run page.

Locally, the check needs poppler-utils and Python pikepdf; veraPDF is optional. Run:

```
VERAPDF="$(bash scripts/qa/install-verapdf.sh /tmp/verapdf | tail -1)" npm run check:store-pdfs -- --require-verapdf [--only=order-paid,receipt] [out-dir]
```

To add a template state, add a case to `storePdfCases.ts`.

The suite also fails a multi-page sample when its last page holds only the "Next step" close. The close has `break-before: avoid`, so the last rows move to the next page with it (#488).

**Live check (nightly):** `.github/workflows/live-pdf-check.yml` runs `scripts/qa/live_pdf_check.py` against production. It renders a solution packet through the live endpoint, fetches every resource PDF, and runs `verify.py` with veraPDF PDF/UA-1. This catches drift that no commit causes, such as production's Chromium changing (#480). A failure opens or updates one issue, titled "Live PDF check is failing". Run it by hand with `python3 scripts/qa/live_pdf_check.py <out-dir>`.

**Not claimed:** the human-judgement PDF/UA checkpoints (alt-text quality, reading order) have had no independent or screen-reader test. WCAG is not claimed.

**Letter spacing:** Inter caps labels stay at `.03em` or less. Production Chromium 151 splits wider-tracked runs ("SOLUTI ON") for copy/paste and screen readers.

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

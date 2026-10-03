# DE document system

One reusable system for Digerati Experts publications: shared tokens, three registers, three document families, a tagged-PDF renderer and a verification gate. It produces the 13 public resource PDFs in `client/public/assets/resources/` (same URLs and registry entries as before). Any future DE document can be added as one content file.

Direction chosen by Joe on 2026-10-03: **technical precision** is the backbone. **Editorial** and **executive briefing** are registers that the families combine for different purposes. The concepts and audit behind that choice are in `artifacts/design-concepts/resource-pdfs/` (PR #367). Claim: issue #366 (VIS-015).

## Registers

| Register | Voice | Used for |
|---|---|---|
| **Spec** (default) | White page, Space Grotesk headings, IBM Plex Mono labels, numbered sections, scope matrices with status words plus glyph shapes, annotated diagrams | Scope, checks, findings, evidence, comparisons |
| **Editorial** | Warm paper `#F7F5F2`, Newsreader serif headings, a label rail, generous measure | Orientation: purpose, how to use, terms, limitations |
| **Brief** | Graphite band with the reverse logo, a bottom line, numbered takeaways, a recommendation panel | Decisions: report summary pages, and the "Next step" close of every document |

## Families

| Family | Order | Experience |
|---|---|---|
| Datasheet | spec → brief close | Masthead with document ID; title with price box (ProActive levels, from `pricing.ts`) or engagement box; numbered sections; ladder or service diagram; next step |
| Checklist | editorial → spec → brief close | Full editorial first page (purpose, how to use, terms); grouped checks with Yes / No / Unknown boxes and a notes line each; reading guide; notes area; next step |
| Report | brief → spec → editorial → brief close | Summary page (bottom line, KPIs, three takeaways, clickable contents with real page numbers); evidence sections; inline editorial limitations; next step. Samples carry **EXAMPLE · NOT CLIENT DATA** on every page |

Shared on every page: Letter size; running header with family, title, document ID and edition; footer with page "N of M"; one H1; tables with header cells; the magenta `#D3126A` only as rules and marks (text uses `#B80F5C`); gold only inside the logo.

## Files

```
scripts/de-documents/
  build.mts                 render → finalize → verify
  qa-sitecheck.mts          in-site check at 390 / 768 / 1440 + pdf.js render
  system/styles.mts         tokens, page model, the three registers
  system/components.mts     masthead, price box, scope matrix, tables, ladder, flow, checks, callouts, next step
  system/families.mts       the three family compositions; Doc type
  content/*.mts             one file per document (or group); index.mts lists all
  content/shared.mts        edition, links, scope notes, move-up triggers, diagrams
  lib/finalize.py           marks untagged content as artifacts; sets metadata
  lib/verify.py             the gate (see Verification)
  lib/dests.py, sheets.py   contents page numbers; contact-sheet renders
  fonts/                    static TTF instances + OFL licences (fonts/README.md)
  CONTENT-CHANGES.md        content-change register for the 13 PDFs
```

**Single sources.**
- ProActive rates, minimums, inclusions, and the pricing scope note come from `client/src/data/pricing.ts`, imported, never typed.
- Phone and email come from `shared/companyContact.ts`.
- The logo comes from `brand/digerati-logo*.svg`.

A price change in `pricing.ts` reaches every PDF on the next build.

## Build and export

Requirements:
- **Node and Playwright Chromium:** `npx playwright install chromium`, or set `PDF_CHROMIUM_PATH` to a Chromium binary, the same variable `server/pdf/renderHtmlToPdf.ts` uses.
- **Python 3 with the PDF libraries:** `pip install pikepdf pillow`.
- **Poppler tools:** `pdfinfo`, `pdffonts`, `pdftotext` and `pdftoppm`.

```bash
npm run documents:build      # all → scripts/de-documents/out/ (gitignored), then verify
npm run documents:publish    # all → client/public/<doc.file>, then verify
npx tsx scripts/de-documents/build.mts backup-bcdr-checklist   # one document
```

Each build:
1. Renders HTML with Chromium (`page.pdf`, `tagged: true`, `outline: true`).
2. For reports, renders a second pass that fills the contents with real page numbers and sets "Page 1 of N".
3. Runs `finalize.py`.
4. Runs `verify.py` and exits non-zero on failure.

Typecheck: `npx tsc -p scripts/de-documents/tsconfig.json`.

**Add a document:** write `content/<name>.mts` exporting a `Doc`, add it to `content/index.mts`, build, then inspect every page (`python3 scripts/de-documents/lib/sheets.py <dir> 62 <pdf>`).

## Verification

`lib/verify.py` fails a PDF that is:
- untagged
- missing a title, `/Lang` or DisplayDocTitle
- carrying any font that is not embedded, is Type 3, or lacks a ToUnicode map
- holding any painting operator that is neither tagged nor an artifact
- carrying under 50 words of extractable text

It also reports pages, size, structure element counts and link targets.

Results for the 13 published files (2026-10-03):
- All pass.
- 2 or 3 pages each, 52–107 KB.
- Only CID TrueType subset fonts, with zero untagged content.
- Live links to `digeratiexperts.com/book`, `tel:+13254809870` and `mailto:info@digeratiexperts.com`.
- Reports have clickable contents.
- Diagrams and the logo are Figures with alt text.

Visual QA:
- Every page of all 13 was inspected in colour and grayscale.
- `qa-sitecheck.mts` loaded the report, checklist and datasheet pages at 390 / 768 / 1440, confirmed the download link is visible (48 px tall) and returns the new file, and rendered page 1 with the site's own pdf.js.

Evidence: `artifacts/visual-qa/resource-pdfs-redesign-2026-10/`.

## Accessibility: what is and is not established

- **Tagging:** the structure comes from Chromium's tagged-PDF output: headings, lists, tables with header cells, links, and Figures with alt text. `finalize.py` wraps everything Chromium left outside the structure tree in `/Artifact` marked content: running headers and footers, page backgrounds, decorative numerals and rail labels that repeat their headings, and diagram internals that the Figure's alt text describes.
- **Not validated as PDF/UA.** No PDF/UA checker (veraPDF, PAC) was available in this environment, so **no PDF/UA or WCAG conformance is claimed**. Run veraPDF with the PDF/UA-1 profile before claiming either.
- **Figures:** Chromium tags a `<figure>` only when it contains visible text, so every diagram carries a caption.
- **Reading order:** follows the HTML. Two-column blocks read left column, then right.
- **Checkboxes:** drawn boxes for pen or annotation tools, not form fields. Fillable fields were left out because they could not be tested across Acrobat, Preview, Edge and mobile viewers here.
- **Contrast:** every text colour pair is at least 5.8:1 (lowest: magenta text on the light tint, 5.88:1). Status never relies on colour: words plus filled, half or open glyphs.
- **Phones:** fixed Letter pages need pinch-zoom on phones; the text is vector and stays sharp at any zoom.
- **Print:** grayscale was checked by rendering, not by a physical print.

## Site-wide use

The system is not tied to the resource PDFs. Store quotes, orders, receipts and solution packets (`server/pdf/*`) could adopt `system/styles.mts` tokens and the brief/spec registers. That work overlaps open PR #339 (`server/pdf/dePdfBrand.ts`) and was **not** done here; coordinate with that PR's owner first.

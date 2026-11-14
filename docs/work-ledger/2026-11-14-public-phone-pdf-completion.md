# Public phone PDF completion — held companion

Owner: ChatGPT / Codex cloud. Mode: Maintenance.
Branch: `chatgpt/public-phone-pdf-completion-20261114`.
Starting main: `5d8baf37cd30471f8cca476ffcbed6d4bc8f93b8`.
Claim: [Hub relay #886](https://github.com/digeratiexperts/Intelligence-Hub/issues/886#issuecomment-6885360392).
Parent handoff: [Hub #1253](https://github.com/digeratiexperts/Intelligence-Hub/issues/1253).

Joe approved continuing the phone cleanup and preparing safe corrections in an isolated worktree and held draft. This slice does not merge, deploy, touch secrets, run migrations, spend money, or send customer messages.

## Changes and ownership

- Re-exported the 32 PDFs listed in `scripts/public-phone-pdf-manifest.json`: 16 public resource/portal documents and 16 Word-based contract exports. All display the literal `[DE_PUBLIC_PHONE]`; no callable placeholder or retired phone remains in their text or URI annotations.
- Three standalone resource concept renderers now use `lib/public-phone.mjs`. It prints a noninteractive marker for pending, retired, invalid or mismatched contact data, even before the canonical source dependency lands. A real configured line still renders correctly. This helper applies only to DE's public concept contact slot, never customer/vendor contact fields.
- Added a PDF text/annotation scanner and 51 focused regressions. The scanner reads all PDFs in `client/public`, `public` and `document_templates`; it fails closed on extraction errors. Requirements: Python 3 + pikepdf, Node, Poppler `pdftotext`.
- A separate read-only `Public phone artifacts` PR workflow runs those regressions when document/source paths change. It installs PDF readers and uses no secrets, application servers, provider calls or deployment steps. Existing CI/deployment workflows are not edited.
- Added masked before/after contact crops, all unique document page boards, PDF.js fit/zoom renders, concept marker checks and export hashes under `artifacts/visual-qa/public-phone-pdf-completion/`. Before crops mask retired contact digits so the evidence does not republish a personal number.
- All 27 open PR file lists were inspected before implementation. None owned these PDF binaries or the three concept renderers. #1031 and #1022 own the shared generator; #1031 owns the concept JSON. Those files are **not edited here**. Their two-line integration correction is delivered in `docs/handoffs/public-phone-pdf-source.patch`, tested in the isolated source-export sandbox and awaiting the existing owner.

The broad canonical/UI cleanup remains [site #1031](https://github.com/digeratiexperts/digeratiexperts-site/pull/1031) at `29ef5642edd5bd75faaad9b49092588ca92b9833`. This is the immutable source reference for all exports, including the Word files already carrying the marker. No push to that branch occurred.

The shared generator patch preserves the marker in a plain span when no phone URI exists. The JSON patch removes its unused fake `tel:` placeholder. They must be adopted by the owning branch and reconciled with #1022 before the next document rebuild. #1031's wider display-marker behavior and UI/legal/claims overlaps remain outside this companion.

## Verification

- Red: the focused guard initially produced **35 failures**: 32 retired-number PDFs and three callable concept markers, with 15 passing checks. These were actual artifact/render failures, not setup errors.
- Green: `PYTHONPATH=<pikepdf install> node --test scripts/public-phone-artifacts.test.mjs` → **51 passed / 0 failed**. All 46 PDF files were inspected; all 32 replacements contain the marker.
- Resource/policy generator: all **16 exports passed** its metadata, tagging, embedded-font, split-word and veraPDF 1.30.2 PDF/UA-1 machine checks. This does not claim full accessibility conformance. Contract exports were generated with LibreOffice tagging enabled; full PDF/UA validation of those contracts is not claimed.
- `npm run check` → passed.
- `npm run build` → passed, after setting `npm_config_cache` to a writable `/tmp` directory. The first attempt failed in npm's unwritable default cache, before the build. No source repair was necessary.
- `npm test` → 360 files passed, two failed; **2,673 tests passed, two timed out, one skipped**. The failures were unchanged `server/portalUserInvite.test.ts` and `client/src/pages/locations/locationListSemantics.visual.test.ts` (plus its teardown timeout) while the build/browser work ran concurrently. Rerunning just those two files with one worker → **6/6 passed**. The full suite was not rerun or described as wholly green.
- `npm run check:active-work` → passed, 173 claims.
- `git diff --check` → passed.
- Visual: reviewed all 32 contact pairs and boards covering 79 unique document pages; no clipped marker, missing page or blank overflow page found. The site's PDF.js rendered representative checklist/report/datasheet pages at fitted 390/768/1440 widths and 2× zoom. Existing fixed Letter documents still require zoom on phones; body text at a 390 fit is about 5.6 CSS px, 11.2 px at 2×.
- Concept contact DOM checked at 390/768/1440: marker present, no enclosing anchor; marker screenshots inspected. The concepts are fixed-width print layouts, and their marker can sit outside a narrow HTML viewport. These checks establish contact/link behavior, **not responsive HTML operability** or a redesigned concept layout.

## Export differences reviewed

`export-verification.json` records hashes and normalized word-counter differences for every changed PDF. All 16 contract exports preserve the normalized words after substituting the phone marker; whitespace, bullet glyphs and nonbreaking hyphens vary with the exporter.

Four ProActive datasheets also synchronize an existing source scope note: “your Cyber Risk Assessment confirms final scope” becomes “fully managed and co-managed plans start with a required Cyber Risk Assessment, which confirms final scope.” No rates, minimums or contract terms were edited. The other 12 public resource/policy exports preserve normalized words apart from the phone marker. The scope-note sync is explicitly pending reviewer acceptance.

Four older `document_templates/original/` PDFs (order form, network, UCaaS and vCIO) grow from three to four pages. Their existing template PDF counterparts already have four pages. All other page counts stay the same. Current source formatting, including field shading and table presentation, is reflected in these re-exports; the original filenames are retained. No customer or vendor data was substituted.

Changing the three portal agreement PDF bytes changes the hashes attached to future acknowledgments. Agreement versions/catalog and existing acceptance records were not edited. The owning release reviewer should check that behavior before release.

## Reproduction and integration

1. Fetch and archive the immutable #1031 source reference above into a disposable build directory, including `scripts/de-documents`, `shared`, `client/src/data/pricing.ts`, `brand`, `document_templates`, package/TypeScript configuration and the concept JSON. Symlink/install the repository's pinned Node dependencies there.
2. Apply `docs/handoffs/public-phone-pdf-source.patch` **in that disposable directory**. Do not silently apply it to an active owner's working tree. The patch is relative to #1031's source SHA.
3. Run the existing resource generator with `PDF_CHROMIUM_PATH` set and `VERAPDF` from `scripts/qa/install-verapdf.sh`. This environment's Chromium blocks `file://`, so the temporary generator loaded its HTML/fonts from a loopback HTTP server instead: replace the sandbox `file://` URL prefix with the server root in HTML and load the same HTML path over HTTP. No browser security policy was disabled. Build to `scripts/de-documents/out/`, inspect/verify, then copy the 16 listed outputs to their unchanged public paths in the isolated worktree.
4. Export the 16 matching Word sources from that immutable snapshot with `soffice --headless --convert-to 'pdf:writer_pdf_Export:{"UseTaggedPDF":{"type":"boolean","value":"true"},"ExportBookmarks":{"type":"boolean","value":"true"}}' --outdir <temporary-output> <source.docx>`. For template paths, source documents are under `templates/docx/`; original sources are under `original/`. Arimo and Carlito fonts were available to the exporter. No Word source was rewritten in this companion.
5. Run the focused guard and the document pipeline's technical checks. Compare text, links and pages before replacing any binary. Recreate contact sheets/fit renders using the existing document QA helpers; do not publish unmasked retired contacts in evidence.
6. Integrate #1031, #1022 and the source patch through their current owners, rerun the guard on the combined result, independently review, then follow the coordinator's separately authorized release process. Rebuild affected documents again if #1022 changes their claims. A source fix alone does not fix already-downloaded or third-party-scraped copies.

## Release state and next checkpoint

Implemented locally and prepared for a held draft; no production action by this slice. #1028's narrow static marker work was merged separately by the parent coordinator at `fe69f3b6`, after #992; these static files are not edited here and will be preserved when updating this branch from main. That parent release is partial phone cleanup, not proof this companion is live.

Next: independent review of the companion's binary/text/visual evidence and explicit adoption of the generator/JSON patch by #1031's owner. Full canonical/UI cleanup, claim reconciliation and deployed verification remain separate gates. Do not mark this work merged or live based on local tests.

USAGE SIGNALS: Codex cloud; no new account usage limit or manual rescue. No desktop retry. Skill reference gate files were unavailable from the cloud package; the isolation/red/verification/checkpoint requirements in the loaded Implementation skill were followed directly, with the evidence above.

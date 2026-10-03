# Review package: DE document system and the 13 resource PDFs

**For:** Joe · **PR:** #367 (draft, unmerged, not deployed) · **Claim:** #366 (VIS-015)
**Head commit and CI run:** shown at the top of PR #367's description. This file cannot state its own commit SHA.

**Status:** **Approved by Joe, 2026-10-03** (results at `9be76c4`). PR ready for merge. **Not merged. Not deployed. Not production-verified.** Merge and deploy are Joe's decision.

---

## 1. Design direction (confirmed)

Your direction, 2026-10-03: *"I do like the technical one the best but also like both the others kinda equally, they all can be used in either an order or combination."*

Implemented as one system with three registers, which each family combines for its purpose:

| Family | Register order | Purpose |
|---|---|---|
| Datasheet (8) | **spec** → brief close | What it is, what is in scope, what next |
| Checklist (2) | **editorial** opener → **spec** checks → brief close | Why it matters, check it, act on it |
| Report (3) | **brief** summary → **spec** evidence → **editorial** limitations → brief close | Decision first, evidence, limits, next |

Registers: **spec** is technical precision (white, Space Grotesk, Plex Mono labels, numbered sections, scope matrices). **Editorial** is warm paper and Newsreader serif. **Brief** is the graphite band, takeaways and the recommendation panel. Gold appears only in the logo. Magenta is used for rules, with `#B80F5C` for magenta text.

## 2. The 13 PDFs (same URLs, same registry entries)

| Public path | Pages | Size | Doc ID |
|---|---|---|---|
| `/assets/resources/reports/cyber-risk-assessment-sample.pdf` | 3 | 93 KB | DE-RP-CRA |
| `/assets/resources/checklists/security-readiness-checklist.pdf` | 3 | 102 KB | DE-CL-SEC |
| `/assets/resources/checklists/backup-bcdr-checklist.pdf` | 3 | 104 KB | DE-CL-BCDR |
| `/assets/resources/datasheets/proactive-ecosystem-overview.pdf` | 2 | 72 KB | DE-DS-PEO |
| `/assets/resources/datasheets/managed-workplace-overview.pdf` | 2 | 59 KB | DE-DS-MWO |
| `/assets/resources/datasheets/proactive-it-ecosystem-datasheet.pdf` | 2 | 85 KB | DE-DS-PIT |
| `/assets/resources/datasheets/proactive-office-ecosystem-datasheet.pdf` | 2 | 84 KB | DE-DS-POF |
| `/assets/resources/datasheets/proactive-business-ecosystem-datasheet.pdf` | 2 | 81 KB | DE-DS-PBU |
| `/assets/resources/datasheets/proactive-enterprise-ecosystem-datasheet.pdf` | 2 | 80 KB | DE-DS-PEN |
| `/assets/resources/datasheets/co-managed-it-datasheet.pdf` | 2 | 72 KB | DE-DS-COM |
| `/assets/resources/datasheets/ucaas-voice-meetings-datasheet.pdf` | 2 | 52 KB | DE-DS-UCV |
| `/assets/resources/reports/compliance-risk-reports-overview.pdf` | 3 | 82 KB | DE-RP-CRR |
| `/assets/resources/reports/sample-quarterly-business-review.pdf` | 3 | 94 KB | DE-RP-QBR |

The files are in `client/public/assets/resources/` on the PR branch. Each was rebuilt from `scripts/de-documents/` (`npm run documents:publish`).

## 3. Items for your approval

Full detail and sources are in `scripts/de-documents/CONTENT-CHANGES.md`.

| ID | Document | Was (May 2026) | Now | Basis | Ask |
|---|---|---|---|---|---|
| **C-05** | Office | "SOC/security operations can be added…"; "Security Awareness Training is an add-on at this level." | 24/7 managed detection and response and security awareness shown as **Included**. Also lists stronger MFA/SSO and advanced anti-phishing. | `pricing.ts` Office inclusions, word for word | Approve the corrected Office scope |
| **C-06** | Office | "Support is designed around 8x5 operations…" | Line removed. Now: "Response targets and 24/7/365 emergency incident response availability are defined in the DE Service Level Agreement (digeratiexperts.com/legal/sla)." | No source found for "8x5"; the SLA page publishes 24/7/365 emergency response | Approve the removal, or tell me the 8x5 source |
| **C-07** | Office, Business, Enterprise, Overview | Rate on IT and Office only; no minimums | Rate **and** monthly minimum on every level: $125/$1,600 · $165/$2,400 · $245/$5,400 · $345/$9,000 | `pricing.ts`; already Published on the site's pricing pages | Approve showing Business and Enterprise prices in PDFs |
| **C-08** | Ecosystem Overview | Business row implied 24/7 detection begins at Business | Each row states only what that level's `pricing.ts` list includes; added a rate / minimum column | `pricing.ts` | Approve the coverage table |
| **A-03** | IT (Office and Business rows withdrawn) | n/a | "Not included" rows kept **only** where an explicit rule exists (§4). Two inferred rows were **removed** in this revision. | §4 | Approve the remaining IT boundary rows |
| **A-12** | Cyber Risk Assessment sample | One disclaimer sentence | "How to read this sample" panel. Line 1 is original. New lines: "A real assessment reports what is found in your environment, so its findings, rating and sequence will differ." and "The roadmap shows the shape of prioritized remediation, not a commitment to particular dates or outcomes." EXAMPLE stamp on every page. | Brief: label samples, add limitations | Approve the two new sentences |
| **A-14** | Sample QBR | No cadence visual; "Example metrics to include" list only | Cadence diagram (Office annual, Business semi-annual, Enterprise quarterly). Callout: "Metric categories only. This sample shows no values, because none would be real." CTA heading: "Choose your review cadence". EXAMPLE stamp on every page. | `pricing.ts` cadence; the Office annual review was not in the old QBR sheet | Approve the diagram (including Office) and callout |

## 4. Scope-boundary verification

Rule: a statement that something is excluded, or begins at a higher level, must come from an **explicit scope rule**. Absence from a lower level's inclusion list does not count. Every such statement was traced; the full table is in `CONTENT-CHANGES.md` §F.

- **Kept, with explicit sources:**
  - IT: no default backup (original IT sheet: "No default backup program is included at this level"; site copy: "Backup is not included at the IT level").
  - IT: 24/7 MDR only by separate scope (original: "not included unless added separately").
  - IT: compliance reporting not included (original: "handled in higher tiers or standalone engagements").
  - Office: spend-card controls optional.
  - Review cadences per level.
- **Removed (inferred from absence only):**
  - Office: "Backup and DR posture, compliance reporting: begin in ProActive Business".
  - Business: "Audit-grade reporting, quarterly executive reviews: begin in ProActive Enterprise".
- **Corrected:**
  - IT backup wording: "begins in Office" became "backup can be added by scope; endpoint backup is included in ProActive Office", because site copy says backup can be added at IT.
  - Move-up triggers: restored to the original wording, minus "security awareness".
  - Ladder labels: "+" prefixes became a neutral "items from each level's published inclusions".

## 5. Visual improvements (no business meaning changed)

- **Logo and colour:** brand logo (vector, from `brand/`) replaces the Helvetica "DIGERATI EXPERTS" text. The off-brand blue `#0056F5` and cyan `#27CAF2` are removed.
- **Type:** Space Grotesk, Inter, Newsreader and Plex Mono, all embedded. Smallest text 7 pt, body 9.2 pt. Every text colour pair is at least 5.88:1 contrast.
- **Structure:** numbered sections, a running header with document ID and edition, and "Page N of M".
- **Tables:** visible header rows; the old ones were drawn dark-on-dark and invisible.
- **Layout:** no orphaned headings, and short lists and sections kept together. 2 pages per datasheet, 3 per checklist or report.
- **Diagrams:** tier ladder, co-managed lanes, RPO/RTO timeline, QBR cadence, and engagement, lifecycle and planning flows. All are vector, with alt text.
- **Checklists:** Yes / No / Unknown boxes, a 24 pt (about 8.5 mm) writing line per check, and a ruled notes area.
- **Reports:** a summary page with clickable contents and real page numbers.
- **Links:** live links on every document.

## 6. Business-content changes

Every change is listed in `CONTENT-CHANGES.md`:
- §A: general (removed "Draft" footers, live links, document IDs)
- §B: claims corrected to `pricing.ts`
- §C: additions
- §D: removals
- §F: scope audit

No customers, testimonials, metrics, certifications, response times or assessment results were added. Sample reports are labelled EXAMPLE on every page.

## 7. Readability at 390 / 768 / 1440

Rendered with the site's own pdf.js. Fit-width text sizes are in `readability/text-sizes.txt`:

| Viewport | Body text | Smallest label | Verdict |
|---|---|---|---|
| 390 (phone, fitted to width) | 5.6 CSS px | 4.3 px | Needs pinch-zoom, as with any Letter page |
| 390 at 2× zoom | 11.2 px | 8.6 px | Readable; see crops |
| 768 (tablet, fitted) | 10.8 px | 8.2 px | Readable |
| 1440 (desktop, 100%) | 12.3 px | 9.3 px | Readable |

**Crops** in `readability/`, at each width and at 1× and 2× zoom:
- `scope-table-*`: Office scope matrix
- `findings-table-*`: CRA findings table
- `links-*`: next-step links
- `checklist-writing-*`: notes lines

**Links:**
- `lib/links.py` checked all 57 link annotations: 13 each to `/book`, `tel:` and `mailto:`, plus 18 contents entries.
- Each link's text matches its target, and every contents link lands on the page it prints.

**Site:**
- `site/`: resource pages at each width. The "Download PDF" link is visible (48 px tall) and returns the new file (`application/pdf`, byte-identical).
- `site/pdfjs-*`: page 1 rendered by pdf.js.

## 8. Accessibility: checks vs. validated compliance

**Machine validation:**
- **veraPDF 1.30.2, PDF/UA-1 profile: all 13 pass.**
- The May 2026 originals failed 7 rules each (128–174 failed checks per file).
- The build now runs veraPDF and fails on any PDF/UA-1 error.

**Checks performed by the author:**
- Tagging and structure, figure alt text and heading order were reviewed.
- Text extracts cleanly.
- Fonts are embedded with ToUnicode maps; no content is left untagged.
- Contrast was computed for every colour pair.
- Status uses words plus shapes, never colour alone.
- Grayscale was checked by render.

**Not validated, so not claimed:**
- Human-judgement PDF/UA checkpoints were not checked by an independent tester, PAC or a screen reader. That covers alt-text quality, reading order and table logic.
- WCAG 2.2 AA is not claimed.
- Checkboxes are not fillable form fields.
- No physical print test was done.
- No real phone or tablet viewer was used; the renders are pdf.js simulations.

## 9. Previews

| Folder | Contents |
|---|---|
| `full-size/` | Representative pages at 150 dpi: Office datasheet p1–p2, Ecosystem Overview p1, Backup checklist p1–p2, Security checklist p3, CRA sample p1–p3, QBR sample p2 |
| `after/` | Every page of every PDF, one sheet per document |
| `after-all-13-color.jpg`, `after-all-13-grayscale.jpg` | Whole set |
| `before-all-13-pdfs.jpg`, `before-invisible-table-header.jpg` | The May 2026 originals |

## 10. What happens on approval

You approve or amend §3. I apply any amendments, rebuild, and re-run veraPDF and the checks. The PR then leaves draft for your merge decision. After merge and deploy, production verification fetches the 13 live URLs and checks edition `2026.10` in each file. MERGED ≠ LIVE.

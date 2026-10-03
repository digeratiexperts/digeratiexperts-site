# DE document system — direction (2026-10-03)

**Tier 3 record** (evidence of a decision, per `design/DESIGN-AUTHORITY.md`).

- **Task:** redesign of the 13 public resource PDFs, in Exploration Mode (VIS-015, issue #366, PR #367).
- **Concepts:** A editorial clarity, B technical precision and C executive briefing, all on the same ProActive IT datasheet (`artifacts/design-concepts/resource-pdfs/`).
- **Joe's direction:** technical precision is the favourite, but all three should be used, "for different purposes… in either an order or combination". He approved fixing every audit finding with best-judgement decisions.

How the direction was implemented (`scripts/de-documents/README.md`):

- **Registers:**
  - **Spec** is the default.
  - **Editorial** is for orientation: purpose, how to use, terms, limitations.
  - **Brief** is for decisions: report summaries and the "Next step" close everywhere.
- **Families:**
  - Datasheet: spec → brief.
  - Checklist: editorial → spec → brief.
  - Report: brief → spec → editorial → brief.
- **Tier 2 changes, scoped to documents:**
  - Newsreader (serif) is added for the editorial register.
  - IBM Plex Mono replaces Oxanium for labels and IDs.
  - Graphite, warm paper and magenta are kept; magenta text uses `#B80F5C` for contrast.
  - Gold stays inside the logo only.
  - The old PDFs' saturated blue, close to the Store-only electric blue, is removed.
- **No Joe-decided item was challenged.**

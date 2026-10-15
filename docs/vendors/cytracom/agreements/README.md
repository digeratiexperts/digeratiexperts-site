# Cytracom partner agreements

Cytracom's agreements with Digerati Experts as a Cytracom partner, kept here for reference. They are Cytracom's documents, not DE's, and are not signed by DE clients.

| File | What it is | Source |
|---|---|---|
| `Partner_Agreement.pdf` | Terms and Conditions for Partner Agreement (last modified February 20, 2018) | https://unity-globe-prod-agreementdocs.s3.amazonaws.com/Partner_Agreement.pdf |
| `Partner_Resale_Agreement_-_Security_and_Connectivity.pdf` | Partner Resale Agreement – Security and Connectivity, covering ControlOne (last modified March 29, 2022) | https://unity-globe-prod-agreementdocs.s3.amazonaws.com/Partner_Resale_Agreement_-_Security_and_Connectivity.pdf |
| `ControlOne_Pricing_2022.pdf` | ControlOne partner pricing and packaging (approved 03-24-2022) | Provided by Joe. **Not committed**: see below. |

Both agreements are published by Cytracom at the URLs above and were filed here unchanged on 2026-10-09 (Joe).

## Partner pricing stays out of git

This repository is public. The Partner Agreement treats rates and price lists as Confidential Information (section 1.1), so `ControlOne_Pricing_2022.pdf` is listed in `.gitignore` and must never be committed here. Keep it in DE's private document store. A local copy placed in this folder stays on that machine only.

## Relation to the portal agreement gate

The Client Portal agreement gate (`/portal/agreement-gate`, `shared/portalAgreements.ts`) follows the pattern Cytracom's partner portal uses: an "Action Required · Agreement N of M" card per document, a PDF link, and one Sign Agreements step. The documents DE clients sign there are DE's own, built by `scripts/de-documents/content/portal-agreements.mts`.

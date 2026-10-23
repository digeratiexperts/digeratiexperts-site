# Lane F — Enforcement and final QA (Wave 3)

Start only after Lanes B, C, D and E are merged. Read `docs/plans/opencode/LANE-RULES.md` and every `docs/lanes/*.md` log.

**You own:** the guardrail switch, the cross-lane QA report, and small integration fixes.

## Steps
1. Confirm no SAMPLE badge, mock data, or demo flag remains in production code. Then switch the CI guardrail from report-only to **enforce**.
2. Run the full QA matrix from both plans:
   - **Accounts:** break-glass super admin, DE staff (inside a client and inside the Digerati Experts company), client standard user, approver, client admin, billing contact, purchaser, owner.
   - **Entitlements:** Cloud Edge / SASE, Voice and Security Awareness, each on and off.
   - **File delivery:** EICAR, renamed EXE, password-protected ZIP, cross-client access.
   - **Homepage:** every width, floating-layer overlaps, keyboard navigation, every CTA's destination.
   - **Widths:** 390 / 768 / 1024 / 1280 / 1440.
3. Fix only small integration bugs between lanes. Log anything bigger as an issue for Joe.
4. Open one PR with the QA results table, screenshots, and the concurrency report.

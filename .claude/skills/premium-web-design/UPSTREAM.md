# UPSTREAM.md - premium-web-design

- **Provenance:** Original to `digeratiexperts/digeratiexperts-site`. Distilled
  by the lead integration session (2026-10-18/19) from the Apple-discipline
  masterclass rules Joe pasted and adopted for the homepage exploration, plus
  the debugging/verification patterns that produced merged PRs #632-#649.
  No external skill was copied.
- **Local deviations:** The ten rules encode Joe-made decisions for Exploration
  Mode concept work; on the live homepage in Maintenance Mode, `.cursorrules`
  section 9A (Visual System v2, Tier 2) still governs and this skill does not
  displace it.
- **External-service boundary:** No services of its own. Some workflows in this
  skill trigger kie.ai spend; those always run through `.claude/kie-budget/`
  gates with Joe's quoted approval. Never commits or prints `KIE_AI_API_KEY`.

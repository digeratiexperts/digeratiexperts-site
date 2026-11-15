# Public phone rule on main (supersedes #1031)

- Date: 2026-11-15
- Repo: digeratiexperts-site
- PR: claude/public-phone-rule-20261115 (supersedes #1031, chore/public-phone-placeholder at 29ef5642)
- Scope: bring #1031's single-constant phone gate onto current main; keep main's visible `[DE_PUBLIC_PHONE]` static markers (#1028) in all 16 conflicts; `PhoneLink` shows the plain non-dialable marker instead of nothing; apply #1036's `docs/handoffs/public-phone-pdf-source.patch`; guard all four retired numbers (the three already listed plus the 623 area-code line, stored split in `shared/publicPhone.test.ts`) in the source, static and PDF tests; scan Office attribute values (hyperlink targets).
- Ownership: Hub #886 comment 6891029436. Joe 2026-11-15 merge approval. Isolated worktree; #1031's branch and the fix/public-phone-release-integration worktree untouched.
- Validation: see the PR body (typecheck, vitest, static and artifact phone tests, retired-number grep of source and built output).
- Status: active

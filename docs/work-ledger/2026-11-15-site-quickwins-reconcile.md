# Site quick-wins reconciliation

- Date: 2026-11-15
- Repo: digeratiexperts-site
- PR: #1037, fix/site-quick-wins-on-main
- Scope: reconcile main through 39559e58, preserve additive claims, replace substring-host assertions with parsed hostnames, and omit unapproved public telephone from the new organization schema.
- Ownership: Hub #886 comment 6889129590. Isolated worktree; original dirty sitemap and #1031 contact cleanup remain untouched.
- Validation: focused organization/redirect regression tests 8/8 passed. Typecheck, 175-claim validator, and production build passed. Full suite: 357 files passed, 7 failed (timeouts and missing OpenSSL), 1 skipped; 2654 tests passed, 6 failed, 29 skipped. Bounded-worker timeout rerun is in progress. Local Node 24; CI Node 22 remains the release gate.
- Status: repair in review; no migration, production configuration, live calls, or deployment performed.
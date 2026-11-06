# Stale remote branches, 2026-11-06

**Report only. No branch was deleted.** Joe decides what goes. Source: Intelligence-Hub `docs/architecture/2026-11-04-cross-repo-review.md` (stale branches); lock issue #974.

- Repository: `digeratiexperts/digeratiexperts-site`
- `origin/main` at the time of the scan: `8fcd3fab` (2026-11-06)
- Remote branches scanned, `main` excluded: **519**
- "Older than 30 days" means the branch's last commit is before **2026-10-07**.

## Summary

| Group | Count | Safe to remove? |
|---|---:|---|
| 1. No open PR, head already in `main` (an ancestor of `main`) | 135 | Yes: no commit is lost. |
| 2. No open PR, head is the head of a **merged** PR that was squashed or rebased (the change is in `main`, the branch's own commits are not) | 296 | Yes in practice; open the PR named if in doubt. |
| 3. No open PR, not merged, last commit older than 30 days | 69 | Joe's call: these hold work that is not in `main`. |
| 4. No open PR, not merged, last commit within 30 days | 13 | Not stale by either rule; listed so nothing is hidden. |
| Open PR (excluded) | 6 | No. |

Branches named by an unfinished claim in `.ai/ACTIVE_WORK.yaml` carry a note in the tables; keep them until the claim closes: `chatgpt/desk-chooser-height-20261101`, `claude/cookie-banner-askde-overlap`, `claude/legacy-secret-observe`, `claude/legacy-secret-remove`, `claude/sleepy-johnson-bkojbp`.

## How this was produced

1. Fetch every remote branch with prune, then for each `refs/remotes/origin/*`: head SHA, last commit date, `git merge-base --is-ancestor <branch> origin/main`, and `git rev-list --count origin/main..<branch>` ("Commits not on main").
2. PR heads from `git ls-remote origin 'refs/pull/*/head'`; PR states from the GitHub search API (`is:pr is:merged`, `is:pr is:closed`). A branch counts as merged through a PR only when its current head SHA equals the head of a merged PR. A branch that moved after its PR merged lands in group 3 or 4.
3. Open PRs on 2026-11-06: #955, #959, #968, #969 (Claude) and #877, #882 (ChatGPT). Their branches are excluded.
4. "PR state unknown": a PR ref points at the head but the search did not return that PR; check it by hand.

Branches move. Before removing anything, re-run step 1 on that day.

## 1. Head already in `main` (135)

| Branch | Head | Last commit | PR | >30 days | Commits not on main | Note |
|---|---|---|---|---|---:|---|
| `claude/home-exploration-concepts` | `8af87a83` | 2026-10-18 | #632 | no | 0 |  |
| `claude/home-monday-concept` | `a1a9ef0c` | 2026-10-18 | #633 | no | 0 |  |
| `codex/installer-closeout-20261018` | `1d68c6ba` | 2026-10-18 | #628 | no | 0 |  |
| `codex/passkey-signin-closeout-20261018` | `af1feb04` | 2026-10-18 | #629 | no | 0 |  |
| `codex/portal-layout-closeout-20261018` | `da6a4baa` | 2026-10-18 | #630 | no | 0 |  |
| `codex/public-offer-closeout-20261018` | `0d286c9f` | 2026-10-18 | #631 | no | 0 |  |
| `codex/recovered-visual-closeout-20261018` | `be2b279e` | 2026-10-18 | #626 | no | 0 |  |
| `ccr-9279d4c2-nyxiic` | `382c8022` | 2026-10-19 | #651 | no | 0 |  |
| `claude/card-text-color` | `f95f3bb9` | 2026-10-19 | none | no | 0 |  |
| `claude/home-dark-toggle` | `1c8b4f3a` | 2026-10-19 | #652 | no | 0 |  |
| `claude/home-monday-motion` | `1c96a843` | 2026-10-19 | #649 | no | 0 |  |
| `claude/retire-superseded-concepts` | `173b38c2` | 2026-10-19 | #653 | no | 0 |  |
| `claude/skill-asset-rule` | `215c94fa` | 2026-10-19 | #654 | no | 0 |  |
| `claude/skill-premium-web-design` | `41fc662d` | 2026-10-19 | #650 | no | 0 |  |
| `claude/white-cards-fix` | `ce23ec8d` | 2026-10-19 | #655 | no | 0 |  |
| `claude/audit-follow-redirects` | `f5b9fa14` | 2026-10-20 | #672 | no | 0 |  |
| `claude/awesome-bardeen-4pbl2m` | `946824a3` | 2026-10-20 | none | no | 0 |  |
| `claude/db-dead-pool-recovery` | `0c096738` | 2026-10-20 | #665 | no | 0 |  |
| `claude/gifted-cray-mfxf3k` | `616e5c74` | 2026-10-20 | #677 | no | 0 |  |
| `claude/lockfile-audit-fix` | `648240cb` | 2026-10-20 | #675 | no | 0 |  |
| `claude/pdf-renderer-absence` | `413de7ab` | 2026-10-20 | #660 | no | 0 |  |
| `claude/sleepy-archimedes-mccoav` | `abc4ac03` | 2026-10-20 | #678 | no | 0 |  |
| `claude/socket-activation` | `424c4408` | 2026-10-20 | #666 | no | 0 |  |
| `claude/spot-bg-white` | `43219000` | 2026-10-20 | #669 | no | 0 |  |
| `claude/store-pdfs-de-system` | `8c59e26b` | 2026-10-20 | #664 | no | 0 |  |
| `claude/t10-lead-integrator-conditions` | `13668915` | 2026-10-20 | #658 | no | 0 |  |
| `feat/portal-profile-identity` | `28eb0ba1` | 2026-10-20 | #648 | no | 0 |  |
| `feat/store-profile-a11y` | `34c860e8` | 2026-10-20 | #670 | no | 0 |  |
| `fix/ci-node-22` | `4f1b483d` | 2026-10-20 | none | no | 0 |  |
| `opencode/home-chapters-legibility` | `8ca1d047` | 2026-10-20 | #683 | no | 0 |  |
| `claude/bug-hunt-2026-10-21` | `84837c3e` | 2026-10-21 | #679 | no | 0 |  |
| `claude/client-portal-access-ukxrnn` | `28acf4b7` | 2026-10-21 | #684 | no | 0 |  |
| `claude/feature-completeness` | `d3a2ca70` | 2026-10-21 | #680 | no | 0 |  |
| `claude/desk-priority-ceiling-and-kie-brief` | `0193f2ec` | 2026-10-22 | #692 | no | 0 |  |
| `dex-presence` | `6b8916ad` | 2026-10-22 | #689 | no | 0 |  |
| `opencode/lane-a-roles-nav-20261022` | `3e3d5f00` | 2026-10-22 | #700 | no | 0 |  |
| `claude/deps-body-parser` | `09ae055b` | 2026-10-23 | #712 | no | 0 |  |
| `claude/homepage-v2-20261022` | `816980bb` | 2026-10-23 | #702 | no | 0 |  |
| `claude/homepage-verify-20261023` | `9bac802d` | 2026-10-23 | #824 | no | 0 |  |
| `claude/menu-pages-upgrade-20261023` | `7f838347` | 2026-10-23 | #704 | no | 0 |  |
| `claude/portal-agent-release` | `f887e7b7` | 2026-10-23 | #707 | no | 0 |  |
| `claude/portal-business-reviews` | `5972a030` | 2026-10-23 | #710 | no | 0 |  |
| `claude/portal-it-roadmap` | `9fe63a8e` | 2026-10-23 | #709 | no | 0 |  |
| `claude/portal-questionnaires` | `0c46b5d9` | 2026-10-23 | #711 | no | 0 |  |
| `claude/portal-status-staff-access` | `0617c80f` | 2026-10-23 | #708 | no | 0 |  |
| `claude/portal-system-status` | `74c69e78` | 2026-10-23 | #706 | no | 0 |  |
| `claude/zod4-security-upgrade` | `74ab474a` | 2026-10-23 | #705 | no | 0 |  |
| `docs/de-tech-tool-tracker` | `f1562542` | 2026-10-23 | #823 | no | 0 |  |
| `claude/city-pages-20261024` | `87a31d32` | 2026-10-24 | #828 | no | 0 |  |
| `claude/cookie-banner-askde-overlap` | `b076671b` | 2026-10-24 | #832 | no | 0 | named in ACTIVE_WORK claim `cookie-banner-askde-overlap` (implemented) |
| `claude/footer-newsletter-mobile` | `c57a2e0f` | 2026-10-24 | #715 | no | 0 |  |
| `claude/footer-social-links` | `db38dca0` | 2026-10-24 | #717 | no | 0 |  |
| `claude/jolly-edison-app0dk` | `ba37da0c` | 2026-10-24 | #829 | no | 0 |  |
| `claude/new-session-civ635` | `08171cfc` | 2026-10-24 | #718 | no | 0 |  |
| `claude/ool-client-series` | `8138b234` | 2026-10-24 | #830 | no | 0 |  |
| `claude/sleepy-johnson-bkojbp` | `7b6f1e2f` | 2026-10-24 | #826 | no | 0 | named in ACTIVE_WORK claim `portal-buildout-progress-log` (in-review) |
| `opencode/lane-h-homepage-20261022` | `e333b5e8` | 2026-10-24 | #698 | no | 0 |  |
| `techtool/empty-catch-warnings` | `6f0ca5ad` | 2026-10-24 | #833 | no | 0 |  |
| `claude/design-basics-20261024` | `c656df1c` | 2026-10-25 | #827 | no | 0 |  |
| `claude/digerati-experts-v2-scrollcraft-7fkrfd` | `9c55956f` | 2026-10-25 | none | no | 0 |  |
| `claude/ledger-verify-voice-import` | `114f1123` | 2026-10-25 | #842 | no | 0 |  |
| `claude/revert-ool-client-series` | `cb92a774` | 2026-10-25 | #840 | no | 0 |  |
| `claude/t7-register-live` | `21df5fb4` | 2026-10-25 | #841 | no | 0 |  |
| `codex/portal-integrations-20261025` | `417c8b7e` | 2026-10-25 | #847 | no | 0 |  |
| `codex/quote-honesty-20261025` | `4ff4bded` | 2026-10-25 | #848 | no | 0 |  |
| `opencode/home-chapters-doc-sheet-ink` | `b6c6fc13` | 2026-10-25 | #839 | no | 0 |  |
| `opencode/issue-668-db-outage-20261025` | `c6d5501a` | 2026-10-25 | #846 | no | 0 |  |
| `claude/homepage-cta-align-20261026` | `2f3140f6` | 2026-10-26 | #852 | no | 0 |  |
| `claude/inspiring-franklin-1o69vr` | `d7464461` | 2026-10-26 | #849 | no | 0 |  |
| `claude/loving-edison-epagrb` | `80c5b445` | 2026-10-26 | #853 | no | 0 |  |
| `claude/t7-closeout` | `0a296a71` | 2026-10-26 | #854 | no | 0 |  |
| `claude/w1-dashboard-truth-20261026` | `7ad382ff` | 2026-10-26 | #850 | no | 0 |  |
| `cursor/sec-hardening-20261024` | `d57c40ec` | 2026-10-26 | #851 | no | 0 |  |
| `techtool/prepush-and-tracker` | `bd688315` | 2026-10-26 | #843 | no | 0 |  |
| `claude/msp-ai-skills-prompts-htqi09` | `051a8af9` | 2026-10-27 | #856 | no | 0 |  |
| `claude/wizardly-feynman-bwwehp` | `f4e15068` | 2026-10-27 | #857 | no | 0 |  |
| `codex/preserve-article-narration` | `c2d0fac2` | 2026-10-31 | #868 | no | 0 |  |
| `fix/mailclient-inventory-matches-clobber` | `b375b023` | 2026-10-31 | #873 | no | 0 |  |
| `techtool/834-discovery-never-throw` | `ed97cc5f` | 2026-10-31 | #871 | no | 0 |  |
| `techtool/835-warranty-date` | `2c9992c3` | 2026-10-31 | #872 | no | 0 |  |
| `techtool/move-100-crash-redaction` | `88052628` | 2026-10-31 | #907 | no | 0 |  |
| `techtool/move-101-support-runbook` | `176f1d47` | 2026-10-31 | #908 | no | 0 |  |
| `techtool/move-103-architecture-board` | `f04191cd` | 2026-10-31 | #909 | no | 0 |  |
| `techtool/move-104-compatibility-names` | `cae4d77b` | 2026-10-31 | #910 | no | 0 |  |
| `techtool/move-17-policy-fail-open` | `a162ee74` | 2026-10-31 | #870 | no | 0 |  |
| `techtool/move-39-installer-sources` | `7daf88d1` | 2026-10-31 | #883 | no | 0 |  |
| `techtool/move-40-trust-records` | `8fdd4a76` | 2026-10-31 | #897 | no | 0 |  |
| `techtool/move-73-agent-threat-model` | `935a776c` | 2026-10-31 | #874 | no | 0 |  |
| `techtool/move-83-desk-ticket` | `6a8e0b72` | 2026-10-31 | #894 | no | 0 |  |
| `techtool/move-84-dropship-serials` | `b1bb5bfe` | 2026-10-31 | #895 | no | 0 |  |
| `techtool/move-85-placeholder-serials` | `e8c5f1c5` | 2026-10-31 | #884 | no | 0 |  |
| `techtool/move-86-alamo-branding` | `5dfb829e` | 2026-10-31 | #899 | no | 0 |  |
| `techtool/move-87-bundle-tier-tests` | `542e03d5` | 2026-10-31 | #900 | no | 0 |  |
| `techtool/move-88-warranty-endpoints` | `b4932cb1` | 2026-10-31 | #901 | no | 0 |  |
| `techtool/move-89-wrong-serial-refusal` | `c5466d2d` | 2026-10-31 | #902 | no | 0 |  |
| `techtool/move-90-client-explainer` | `8bf6b905` | 2026-10-31 | #903 | no | 0 |  |
| `techtool/move-93-retention` | `469db667` | 2026-10-31 | #889 | no | 0 |  |
| `techtool/move-99-update-manifest` | `d41622d3` | 2026-10-31 | #906 | no | 0 |  |
| `techtool/move16-licence-mutation` | `ee6102d3` | 2026-10-31 | #865 | no | 0 |  |
| `techtool/section-h-move-91` | `43d0d296` | 2026-10-31 | #876 | no | 0 |  |
| `techtool/section-h-move-92` | `8d41370e` | 2026-10-31 | #878 | no | 0 |  |
| `techtool/section-h-move-95` | `8b0aea21` | 2026-10-31 | none | no | 0 |  |
| `techtool/section-h-move-96` | `801c34da` | 2026-10-31 | #880 | no | 0 |  |
| `chatgpt/desk-chooser-height-20261101` | `ac92170e` | 2026-11-01 | #920 | no | 0 | named in ACTIVE_WORK claim `desk-chooser-height-20261101` (implemented) |
| `techtool/move-42-source-recheck` | `2e031193` | 2026-11-01 | #911 | no | 0 |  |
| `techtool/move-43-authenticode` | `9c39ac3c` | 2026-11-01 | #912 | no | 0 |  |
| `techtool/move-44-silent-change` | `04339691` | 2026-11-01 | #913 | no | 0 |  |
| `techtool/move-45-refuse-mismatch` | `03331614` | 2026-11-01 | #914 | no | 0 |  |
| `techtool/move-46-technician-quickref` | `44f0c9ba` | 2026-11-01 | #915 | no | 0 |  |
| `techtool/move-47-refusal-matrix` | `d959642d` | 2026-11-01 | #916 | no | 0 |  |
| `techtool/move-97-diagnostic-bundle` | `9da22a3f` | 2026-11-01 | #904 | no | 0 |  |
| `techtool/move-98-log-rotation` | `f043040f` | 2026-11-01 | #905 | no | 0 |  |
| `techtool/move18-export-drift-check` | `a90018bd` | 2026-11-01 | #887 | no | 0 |  |
| `techtool/move20-changelog` | `a1115403` | 2026-11-01 | #888 | no | 0 |  |
| `techtool/move21-launcher-ci-confirmation` | `00648464` | 2026-11-01 | #891 | no | 0 |  |
| `techtool/move22-contract-schema-tests` | `a0fd65d5` | 2026-11-01 | #892 | no | 0 |  |
| `techtool/move23-contract-secret-refusal` | `704f1c65` | 2026-11-01 | #893 | no | 0 |  |
| `techtool/move24-hub-payload-fuzz` | `6ef88f40` | 2026-11-01 | #896 | no | 0 |  |
| `techtool/phi-restricted-mode` | `d7d530b9` | 2026-11-01 | #898 | no | 0 |  |
| `ccr-6efee60a-js0dvs` | `8d8e9319` | 2026-11-02 | #943 | no | 0 |  |
| `claude/loving-hopper-b5p8eg` | `ce7d07e4` | 2026-11-02 | #864 | no | 0 |  |
| `techtool/phi-discovery-metadata` | `d1fdf066` | 2026-11-02 | #931 | no | 0 |  |
| `techtool/phi-encryption-design` | `c1a81245` | 2026-11-02 | #923 | no | 0 |  |
| `chatgpt/event-contact-receipt-20261101` | `d0cc30f2` | 2026-11-03 | #886 | no | 0 |  |
| `claude/agent-relay-pointer` | `354d8a09` | 2026-11-05 | #972 | no | 0 |  |
| `claude/kb-docs-layout` | `d1db8c03` | 2026-11-05 | #962 | no | 0 |  |
| `claude/kb-docs-layout-release-claim` | `f3cd4d50` | 2026-11-05 | #966 | no | 0 |  |
| `claude/legacy-secret-observe` | `bfa5de14` | 2026-11-05 | #958 | no | 0 | named in ACTIVE_WORK claim `de-sync-legacy-secret-retirement` (active) |
| `claude/portal-reads-hub-licences` | `e5f3cd3a` | 2026-11-05 | #967 | no | 0 |  |
| `claude/retire-stale-claims-20261105` | `f27cea35` | 2026-11-05 | #956 | no | 0 |  |
| `claude/tech-tool-remove` | `045de8b6` | 2026-11-05 | #965 | no | 0 |  |
| `claude/techtool-hub-install-catalog` | `c403abf3` | 2026-11-05 | #961 | no | 0 |  |
| `claude/techtool-retire-ps-agent` | `065007bc` | 2026-11-05 | #963 | no | 0 |  |
| `claude/cool-galileo-1bm4h3` | `236064af` | 2026-11-06 | #973 | no | 0 |  |
| `claude/release-tech-tool-claim` | `437282b0` | 2026-11-06 | #970 | no | 0 |  |

## 2. Merged through a squashed or rebased PR (296)

| Branch | Head | Last commit | PR | >30 days | Commits not on main | Note |
|---|---|---|---|---|---:|---|
| `cursor/redact-leaked-vendor-credentials-0956` | `77e711d6` | 2026-08-06 | #1 | yes | 679 |  |
| `cursor/remove-internal-pages-from-public-bundle-0956` | `5daf9f7b` | 2026-08-06 | #2 | yes | 681 |  |
| `cursor/update-public-site-content-0956` | `ca629f5f` | 2026-08-06 | #3 | yes | 686 |  |
| `cursor/vps-deployment-kit-0956` | `a7348479` | 2026-08-06 | #4 | yes | 690 |  |
| `fix/homepage-hero-nav-2026-08-08` | `e29819f8` | 2026-08-08 | #5 | yes | 707 |  |
| `feat/support-modal-interactive-chat-20260810` | `efdb515b` | 2026-08-10 | #6 | yes | 771 |  |
| `fix/paid-order-reconciliation-20260810` | `02c9e6da` | 2026-08-10 | #16 | yes | 769 |  |
| `fix/store-canonical-managed-catalog-20260810` | `dc01b3d8` | 2026-08-10 | #11 | yes | 769 |  |
| `fix/zoho-payments-secure-v2-20260810` | `4f9fbef6` | 2026-08-10 | #13 | yes | 772 |  |
| `ops/verify-production-release-20260810` | `bd87f372` | 2026-08-10 | #7 | yes | 763 |  |
| `cursor/fix-vitest-msp-advisor-collection-3080` | `e2110b79` | 2026-08-16 | #19 | yes | 903 |  |
| `cursor/homepage-retire-leftover-purple-chrome-3080` | `cb3c74aa` | 2026-08-16 | #20 | yes | 917 |  |
| `cursor/city-homepages-3080` | `aab70d13` | 2026-08-17 | #33 | yes | 944 |  |
| `cursor/de-desk-store-system-3080` | `2f2c94ad` | 2026-08-17 | #22 | yes | 922 |  |
| `cursor/desk-hierarchy-3080` | `19527f58` | 2026-08-17 | #28 | yes | 943 |  |
| `cursor/desk-resize-edges-3080` | `c9d4dc7f` | 2026-08-17 | #27 | yes | 940 |  |
| `cursor/desk-ticket-chips-3080` | `fd14546d` | 2026-08-17 | #25 | yes | 938 |  |
| `cursor/paper-magenta-ink-3080` | `15f51340` | 2026-08-17 | #30 | yes | 944 |  |
| `cursor/sitewide-larger-type-3080` | `70b4b52e` | 2026-08-17 | #21 | yes | 920 |  |
| `cursor/solutions-menu-fit-3080` | `90bf2e12` | 2026-08-17 | #26 | yes | 934 |  |
| `cursor/store-category-pills-3080` | `0cf395ee` | 2026-08-17 | #29 | yes | 942 |  |
| `cursor/store-click-scroll-fix-3080` | `ee79e857` | 2026-08-17 | #24 | yes | 932 |  |
| `cursor/talos-a11y-ux-fixes-dac4` | `b42e5c5d` | 2026-08-17 | #23 | yes | 931 |  |
| `cursor/brand-leftovers-3080` | `7398cbe5` | 2026-08-18 | #32 | yes | 957 |  |
| `cursor/de-sync-foundation-3080` | `5db6df85` | 2026-08-18 | #37 | yes | 979 |  |
| `cursor/proactive-coverage-visualizer-3080` | `c479107a` | 2026-08-18 | #40 | yes | 982 |  |
| `cursor/quote-wizard-contrast-3080` | `78b8be51` | 2026-08-18 | #31 | yes | 948 |  |
| `cursor/sticky-cta-overlap-3080` | `c41e5543` | 2026-08-18 | #38 | yes | 969 |  |
| `cursor/store-epic-polish-3080` | `efb28c37` | 2026-08-18 | #35 | yes | 962 |  |
| `cursor/store-solution-engine-3080` | `d3350850` | 2026-08-18 | #36 | yes | 964 |  |
| `cursor/store-trackpad-gestures-3080` | `c8eafb5f` | 2026-08-18 | #34 | yes | 959 |  |
| `cursor/homepage-section-fields-3080` | `5f64fa6a` | 2026-08-19 | #42 | yes | 982 |  |
| `cursor/store-trust-solution-3080` | `89b3bd1f` | 2026-08-20 | #39 | yes | 992 |  |
| `recovery/pr-history-repair-2026-08-20` | `3aff264d` | 2026-08-20 | #43 | yes | 993 |  |
| `fix/store-orders-server-authoritative-main-20260825` | `7e2d0ea1` | 2026-08-24 | #53 | yes | 1061 |  |
| `stabilization/bundle-budget-20260824` | `5c346793` | 2026-08-24 | #49 | yes | 1055 |  |
| `stabilization/dev-overlay-production-20260824` | `c4c6e361` | 2026-08-24 | #50 | yes | 1055 |  |
| `stabilization/order-recovery-tests-20260824` | `9847641f` | 2026-08-24 | #51 | yes | 1055 |  |
| `stabilization/p0-commerce-20260824` | `4f162da5` | 2026-08-24 | #46 | yes | 1049 |  |
| `stabilization/required-typecheck-20260824` | `2dc7d5e2` | 2026-08-24 | #47 | yes | 1052 |  |
| `stabilization/store-checkout-fallback-20260824` | `3c7a0dc0` | 2026-08-24 | #48 | yes | 1052 |  |
| `chore/remove-dead-store-route-handlers-main-20260825` | `90f5d5e6` | 2026-08-25 | #63 | yes | 1063 |  |
| `cleanup/runtime-dependencies-audit-20260825` | `fc56b526` | 2026-08-25 | #58 | yes | 1066 |  |
| `fix/atmosphere-gradient-mesh-20260825` | `fc0f6046` | 2026-08-25 | #69 | yes | 1084 |  |
| `fix/client-pricing-authoritative-20260825` | `ff155fad` | 2026-08-25 | #55 | yes | 1063 |  |
| `fix/electric-atmosphere-20260825` | `daec8b02` | 2026-08-25 | #67 | yes | 1077 |  |
| `fix/four-tier-managed-catalog-20260825` | `2b4f395b` | 2026-08-25 | #56 | yes | 1065 |  |
| `fix/portal-auth-live-authority-20260825` | `70bc97af` | 2026-08-25 | #52 | yes | 1059 |  |
| `fix/store-panel-theme-toggle-20260825` | `291372a9` | 2026-08-25 | #70 | yes | 1096 |  |
| `fix/store-sticky-panel-overlap-main-20260825` | `7d433a7f` | 2026-08-25 | #62 | yes | 1062 |  |
| `fix/store-vendor-logo-size-main-20260825` | `86896634` | 2026-08-25 | #61 | yes | 1062 |  |
| `perf/split-global-chrome-20260825` | `656924cf` | 2026-08-25 | #60 | yes | 1065 |  |
| `fix/configure-billing-hover-20260825` | `c1f338e7` | 2026-08-26 | #65 | yes | 1068 |  |
| `fix/hide-ask-de-during-drawers-20260825` | `a20a482c` | 2026-08-26 | #68 | yes | 1082 |  |
| `fix/proactive-coverage-rings-picker-20260825` | `3712bdd0` | 2026-08-26 | #66 | yes | 1071 |  |
| `fix/store-cart-drawer-overlap-20260825` | `a0f81a34` | 2026-08-26 | #64 | yes | 1067 |  |
| `chatgpt/port-pr59-campaign-resources-20260827` | `1c5c08a9` | 2026-08-27 | #82 | yes | 1122 |  |
| `chatgpt/repository-authority-and-naming-cleanup-20260827` | `02bfc0ff` | 2026-08-27 | #78 | yes | 1097 |  |
| `chore/de-intelligence-status` | `1e9bcbf4` | 2026-08-27 | #85 | yes | 1122 |  |
| `claude/overnight-store-site-ux` | `a733b862` | 2026-08-27 | #79 | yes | 1116 |  |
| `cursor/faq-paper-light-upgrade` | `57a500e1` | 2026-08-27 | #92 | yes | 1123 |  |
| `cursor/vis-001-visual-system-v2-c9ac` | `e004b88a` | 2026-08-27 | #77 | yes | 1107 |  |
| `feat/de-intelligence-layer` | `b1957fcd` | 2026-08-27 | #84 | yes | 1125 |  |
| `fix/store-de-branding-20260827` | `8e23b851` | 2026-08-27 | #74 | yes | 1089 |  |
| `cursor/de-ecosystem-rule` | `8de61d54` | 2026-08-28 | #98 | yes | 1131 |  |
| `cursor/desk-support-field-outline` | `54aa7eb1` | 2026-08-28 | #93 | yes | 1153 |  |
| `cursor/desk-wider-type-and-advisor` | `dd81bd91` | 2026-08-28 | #91 | yes | 1127 |  |
| `cursor/store-solution-panes` | `e904ad72` | 2026-08-28 | #97 | yes | 1149 |  |
| `cursor/your-solution-cart-ux-c9ac` | `c536284f` | 2026-08-28 | #83 | yes | 1122 |  |
| `feat/de-intelligence-storage` | `60cdae16` | 2026-08-28 | #87 | yes | 1128 |  |
| `feat/de-intelligence-techsales-ingestion` | `6fadbff4` | 2026-08-28 | #96 | yes | 1137 |  |
| `fix/canonical-deploy-origin` | `f19d29f5` | 2026-08-28 | #95 | yes | 1129 |  |
| `fix/deploy-concurrency-v2` | `2cb120b1` | 2026-08-28 | #94 | yes | 1126 |  |
| `fix/main-deploy-concurrency-dispatch` | `013bc601` | 2026-08-28 | #90 | yes | 1125 |  |
| `fix/production-deploy-runner` | `4ae9a7e0` | 2026-08-28 | #86 | yes | 1122 |  |
| `infra/runner-fleet-hardening` | `ff78393d` | 2026-08-28 | #89 | yes | 1126 |  |
| `codex/store-curated-merge` | `47669fbd` | 2026-08-29 | #105 | yes | 1165 |  |
| `cursor/store-architecture-design` | `c5a7251e` | 2026-08-29 | #102 | yes | 1155 |  |
| `cursor/store-door-2-business-needs` | `1d663a86` | 2026-08-29 | #103 | yes | 1158 |  |
| `cursor/store-warehouse-isolation` | `1c1251fa` | 2026-08-29 | #104 | yes | 1163 |  |
| `feature/curated-de-solution-families` | `ade9faf3` | 2026-08-29 | #101 | yes | 1157 |  |
| `fix/public-store-card-parity` | `f80eea94` | 2026-08-29 | #109 | yes | 1169 |  |
| `fix/public-store-mobile-chrome-parity` | `a2903965` | 2026-08-29 | #110 | yes | 1171 |  |
| `test/public-store-door2-mobile-regressions` | `07c94881` | 2026-08-29 | #111 | yes | 1178 |  |
| `claude/fable-visual-batch` | `814716ee` | 2026-08-30 | #148 | yes | 1274 |  |
| `claude/homepage-ask-de-visual-19b3aa` | `b137c766` | 2026-08-30 | #147 | yes | 1260 |  |
| `claude/store-p0-durable-drafts-2026-08-30` | `7348b952` | 2026-08-30 | #145 | yes | 1239 |  |
| `claude/store-p0-followups-2026-08-31` | `48c092ac` | 2026-08-30 | #150 | yes | 1276 |  |
| `codex/store-solution-architecture-v2` | `40c41f6b` | 2026-08-30 | #117, #135 | yes | 1222 |  |
| `cursor/store-solution-builder-scaffold-cfd2` | `eee4a2ff` | 2026-08-30 | #112 | yes | 1182 |  |
| `sync/main-4ea-into-store-jelly-css-fix` | `4ea81737` | 2026-08-30 | #141 | yes | 1230 |  |
| `sync/main-eaf8198-into-homepage-support-116` | `eaf8198b` | 2026-08-30 | #142 | yes | 1234 |  |
| `sync/main-f865-into-homepage-support-116` | `f8652562` | 2026-08-30 | #138 | yes | 1226 |  |
| `sync/main-into-homepage-support-116` | `40c41f6b` | 2026-08-30 | #117, #135 | yes | 1222 |  |
| `sync/main-into-homepage-support-116-v2` | `40c41f6b` | 2026-08-30 | #117, #135 | yes | 1222 |  |
| `chatgpt/install-scrollcraft-skill-20260901` | `be2d4974` | 2026-08-31 | #163 | yes | 1294 |  |
| `claude/jelly-mode-store-settings-56cw6r` | `a9e2ead9` | 2026-09-01 | #172 | yes | 1314 |  |
| `claude/scrollcraft-site-v2` | `5aadb4b7` | 2026-09-01 | #166 | yes | 1300 |  |
| `claude/homepage-versions-archive-7fkrfd` | `5e7009ee` | 2026-09-02 | #181 | yes | 1319 |  |
| `claude/project-bug-hunt-0bjuuq` | `efb4a417` | 2026-09-02 | #182 | yes | 1319 |  |
| `claude/experience-v1-surgery` | `f844f654` | 2026-09-03 | #193 | yes | 1360 |  |
| `claude/restore-homepage-v1` | `501e3084` | 2026-09-03 | #192 | yes | 1358 |  |
| `claude/favicon-og-brand-refresh` | `fc4abe68` | 2026-09-06 | #198 | yes | 1364 |  |
| `chore/timus-controlone-naming-2026-09-09` | `a6df1c21` | 2026-09-09 | #207 | yes | 1380 |  |
| `cursor/c4-marketplace-scope-states` | `26b8c609` | 2026-09-12 | #222 | yes | 1388 |  |
| `cursor/review/desk-ask-de-motion-20260913` | `9a3e4334` | 2026-09-14 | #216 | yes | 1432 |  |
| `cursor/fix-vendor-pdfjs-windows-20260916` | `970fefca` | 2026-09-16 | #218 | yes | 1388 |  |
| `cursor/hotfix-216-corrections-20260919` | `f37c1cf8` | 2026-09-20 | #223 | yes | 1440 |  |
| `chatgpt/security-foundation-20260925` | `b2c3fd70` | 2026-09-25 | #225 | yes | 1470 |  |
| `cursor/portal-hub-identity-20260924` | `f1bea891` | 2026-09-26 | #228 | yes | 1456 |  |
| `cursor/fix-invoice-pay-and-solution-click-20260927` | `649f9d41` | 2026-09-27 | #260 | yes | 1475 |  |
| `cursor/health-probes-fail-closed-20260927` | `ae904823` | 2026-09-27 | #231 | yes | 1458 |  |
| `cursor/threat-refresh-ignore-forwarded-for-20260927` | `9876f345` | 2026-09-27 | #262 | yes | 1477 |  |
| `claude/homepage-v4` | `17039eff` | 2026-09-30 | #266 | yes | 1634 |  |
| `claude/kie-skills-cloud-setup-13a8xh` | `d8089d7b` | 2026-09-30 | #185 | yes | 1719 |  |
| `claude/nano-banana-2-setup-itot5a` | `74ed03a3` | 2026-09-30 | #188 | yes | 1664 |  |
| `claude/portal-access-admin-request-faa282` | `3b790389` | 2026-09-30 | #149 | yes | 1634 |  |
| `claude/production-health-probe` | `1ed98005` | 2026-09-30 | #284 | yes | 1624 |  |
| `claude/pronunciation-dictionary-card-2026-08-31` | `a2b9bb13` | 2026-09-30 | #157 | yes | 1638 |  |
| `claude/remove-unwired-scaffolding` | `3349425c` | 2026-09-30 | #287 | yes | 1630 |  |
| `claude/seo-emergency-response` | `4134d1ef` | 2026-09-30 | #288 | yes | 1632 |  |
| `claude/version-4-spa-path` | `f8f349bc` | 2026-09-30 | #282 | yes | 1621 |  |
| `claude/version-preview-robots-header` | `0c376271` | 2026-09-30 | #285 | yes | 1625 |  |
| `claude/widget-ticket-desk-failure` | `3e412dab` | 2026-09-30 | #289 | yes | 1627 |  |
| `cursor/desk-ticket-oauth-auth-20260930` | `3ac89e83` | 2026-09-30 | #290 | yes | 1734 |  |
| `claude/bug-hunt-fixes-oct` | `4e20aabf` | 2026-10-01 | #299 | yes | 1736 |  |
| `claude/deck-reserve-clears-nudge` | `c1bf928a` | 2026-10-01 | #309 | yes | 1769 |  |
| `claude/desk-status-auth-reason` | `4fd593b5` | 2026-10-01 | #321 | yes | 1809 |  |
| `claude/exit-intent-second-opinion` | `0a6cdbc8` | 2026-10-01 | #295 | yes | 1760 |  |
| `claude/homepage-v5-practical` | `454f192f` | 2026-10-01 | #292 | yes | 1740 |  |
| `claude/homepage-v5-released` | `436d1dda` | 2026-10-01 | #302 | yes | 1758 |  |
| `claude/homepage-v6-sections` | `b49549fa` | 2026-10-01 | #304 | yes | 1770 |  |
| `claude/known-pages-answer-200` | `808bbce5` | 2026-10-01 | #328 | yes | 1819 |  |
| `claude/org-department-tenant-boundary` | `765e78b8` | 2026-10-01 | #326 | yes | 1816 |  |
| `claude/phone-number-and-arrows` | `1e0fc808` | 2026-10-01 | #323 | yes | 1812 |  |
| `claude/phone-tap-targets` | `66e7541a` | 2026-10-01 | #322 | yes | 1811 |  |
| `claude/protection-deck-phone` | `f7b2bb97` | 2026-10-01 | #306 | yes | 1753 |  |
| `claude/registry-release-store-seed` | `8b4edbf9` | 2026-10-01 | #327 | yes | 1816 |  |
| `claude/release-claims-afternoon` | `15f5f236` | 2026-10-01 | #324 | yes | 1813 |  |
| `claude/release-merged-claims` | `14d8fbf7` | 2026-10-01 | #317 | yes | 1805 |  |
| `claude/shared-brand-fonts` | `39f597a2` | 2026-10-01 | #301 | yes | 1751 |  |
| `codex/de-desk-repair` | `4ec20177` | 2026-10-01 | #303 | yes | 1803 |  |
| `claude/portal-people-pick-company` | `b2921cde` | 2026-10-02 | #330 | yes | 1881 |  |
| `claude/registry-cache-live-retire-lane` | `348c5e6f` | 2026-10-02 | #340 | yes | 1855 |  |
| `claude/static-cache-policy` | `c46d9c09` | 2026-10-02 | #338 | yes | 1854 |  |
| `cursor/invent-banner-cta-20261002` | `0f58926f` | 2026-10-02 | #355 | yes | 1902 |  |
| `cursor/invent-blog-store-main-id-20261002` | `db135526` | 2026-10-02 | #361 | yes | 1902 |  |
| `cursor/invent-blogpost-managed-main-20261002` | `3b705afa` | 2026-10-02 | #362 | yes | 1902 |  |
| `cursor/invent-contact-main-id-20261002` | `fecbb353` | 2026-10-02 | #359 | yes | 1902 |  |
| `cursor/invent-cta-copy-20261002` | `f6d7faa8` | 2026-10-02 | #352 | yes | 1905 |  |
| `cursor/invent-ecosystem-diagram-motion-20261002` | `ea082417` | 2026-10-02 | #360 | yes | 1902 |  |
| `cursor/invent-marketing-de-naming-20261002` | `b3d19343` | 2026-10-02 | #356 | yes | 1902 |  |
| `cursor/invent-portal-de-naming-20261002` | `63f82059` | 2026-10-02 | #351 | yes | 1901 |  |
| `cursor/invent-skip-link-pricing-20261002` | `94406c96` | 2026-10-02 | #358 | yes | 1902 |  |
| `cursor/invent-solutions-siblings-main-20261002` | `b80da1eb` | 2026-10-02 | #364 | yes | 1902 |  |
| `cursor/invent-vitest-crlf-win-20261002` | `cdc6a4e7` | 2026-10-02 | #349 | yes | 1893 |  |
| `cursor/portal-vendor-notes-20261002` | `cf5bb8f8` | 2026-10-02 | #369 | yes | 1978 |  |
| `claude/account-managers` | `c09e2f6e` | 2026-10-03 | #402 | yes | 2161 |  |
| `claude/fix-233-store-orders-db` | `d8f0572f` | 2026-10-03 | #379 | yes | 2108 |  |
| `claude/fix-234-admin-metrics-truth` | `28ebb24a` | 2026-10-03 | #383 | yes | 1980 |  |
| `claude/fix-238-sse-canonical-mismatch` | `046fd0fa` | 2026-10-03 | #354 | yes | 1900 |  |
| `claude/fix-242-session-revocation` | `6bf171a1` | 2026-10-03 | #382 | yes | 2106 |  |
| `claude/fix-244-solution-ownership` | `3ec938b5` | 2026-10-03 | #372 | yes | 1981 |  |
| `claude/fix-245-auth-durable-writes` | `f8615897` | 2026-10-03 | #377 | yes | 2087 |  |
| `claude/fix-246-order-form-durable` | `fbf0bf95` | 2026-10-03 | #376 | yes | 1980 |  |
| `claude/fix-248-storage-fail-closed` | `9ae8c602` | 2026-10-03 | #378 | yes | 2037 |  |
| `claude/fix-251-durable-auth-tokens` | `5466232f` | 2026-10-03 | #381 | yes | 2094 |  |
| `claude/fix-253-solution-request-migration` | `6f5773ef` | 2026-10-03 | #374 | yes | 2089 |  |
| `claude/fix-255-invoice-status-guard` | `37094a99` | 2026-10-03 | #380 | yes | 1980 |  |
| `claude/fix-263-payment-readiness` | `7dfe5c30` | 2026-10-03 | #353 | yes | 1900 |  |
| `claude/fix-373-distinct-owner` | `b0d0ffdc` | 2026-10-03 | #394 | yes | 2113 |  |
| `claude/nice-meitner-qrg3ko` | `00f4d635` | 2026-10-03 | #415 | yes | 2187 |  |
| `claude/object-storage-acl` | `c9463e87` | 2026-10-03 | #310 | yes | 1993 |  |
| `claude/physical-hardware-quote-only` | `67d966da` | 2026-10-03 | #337 | yes | 1960 |  |
| `claude/portal-bridge-signed-calls` | `32409299` | 2026-10-03 | #404 | yes | 2161 |  |
| `claude/portal-commands-drop-account-id` | `44923c1c` | 2026-10-03 | #423 | yes | 2194 |  |
| `claude/portal-quote-requested-route` | `6bfe9ef5` | 2026-10-03 | #422 | yes | 2194 |  |
| `claude/registry-brand-icon-live` | `443959f6` | 2026-10-03 | #439 | yes | 2254 |  |
| `claude/resend-verification-abuse` | `bbfd1c8b` | 2026-10-03 | #336 | yes | 1952 |  |
| `claude/store-guidance-cues` | `205e6b00` | 2026-10-03 | #403 | yes | 2160 |  |
| `claude/store-pdf-unify` | `2a703206` | 2026-10-03 | #339 | yes | 1983 |  |
| `claude/test-250-237-route-guards` | `7aeee717` | 2026-10-03 | #384 | yes | 2088 |  |
| `claude/threat-refresh-guard-tests` | `25e23fda` | 2026-10-03 | #413 | yes | 2173 |  |
| `claude/ticket-access-owner-scope` | `fac7a0ff` | 2026-10-03 | #335 | yes | 1964 |  |
| `claude/upbeat-knuth-s2vobf` | `e9a51888` | 2026-10-03 | #406 | yes | 2167 |  |
| `cursor/anonymous-situation-continuity-cfd2` | `9f9a942a` | 2026-10-03 | #345 | yes | 1905 |  |
| `cursor/homepage-v6-current-theme-20261001` | `1ce11caa` | 2026-10-03 | #346 | yes | 2207 |  |
| `cursor/portal-hub-sync-security-d6c5` | `fdcb1aa7` | 2026-10-03 | #347 | yes | 2146 |  |
| `cursor/portal-store-warehouse-20260929` | `a04a8475` | 2026-10-03 | #280 | yes | 1981 |  |
| `cursor/staff-warehouse-ops-20261003` | `9d8d85f9` | 2026-10-03 | #371 | yes | 2152 |  |
| `cursor/store-solution-pdf-20261001` | `a0e39b23` | 2026-10-03 | #320 | yes | 1906 |  |
| `claude/quote-handoff-message` | `5fd83e9f` | 2026-10-04 | #443 | yes | 2264 |  |
| `claude/retire-legacy-generic-routes` | `aa269c1d` | 2026-10-04 | #441 | yes | 2264 |  |
| `claude/solution-request-never-lose` | `792a08b1` | 2026-10-04 | #445 | yes | 2267 |  |
| `claude/store-quote-route-tests` | `6e0c1516` | 2026-10-04 | #420 | yes | 2195 |  |
| `codex/site-request-telemetry-20261004` | `f815ddd6` | 2026-10-04 | #444 | yes | 2267 |  |
| `ccr-c8d1c3be-fzp3ow` | `344f52dd` | 2026-10-05 | #474 | yes | 2307 |  |
| `claude/beautiful-hopper-1uem0k` | `1e21532d` | 2026-10-05 | #469 | yes | 2302 |  |
| `claude/pin-deploy-commit` | `18785720` | 2026-10-05 | #459 | yes | 2298 |  |
| `claude/portal-chat-sessions` | `12a71d81` | 2026-10-05 | #471 | yes | 2308 |  |
| `claude/portal-desk-contact-tickets` | `113a0dc2` | 2026-10-05 | #477 | yes | 2344 |  |
| `claude/portal-desk-ticket-sync` | `568ee8cb` | 2026-10-05 | #473 | yes | 2314 |  |
| `claude/quote-request-never-lose` | `0413efad` | 2026-10-05 | #453 | yes | 2329 |  |
| `claude/revocation-load-fail-closed` | `96923e45` | 2026-10-05 | #455 | yes | 2289 |  |
| `claude/the-box-known-path` | `b4d48464` | 2026-10-05 | #475 | yes | 2338 |  |
| `claude/unfinished-threads-survey-y92doz` | `2035a8eb` | 2026-10-05 | #470 | yes | 2305 |  |
| `cursor/qbs-quote-wizard-20261003` | `e618b0f4` | 2026-10-05 | #433 | yes | 2340 |  |
| `claude/npm-audit-fix` | `bf7ebf1d` | 2026-10-06 | #490 | yes | 2371 |  |
| `claude/phone-hero-hotfix` | `43113419` | 2026-10-06 | #499 | yes | 2391 |  |
| `claude/prose-dark-specificity` | `bd682b50` | 2026-10-06 | #493 | yes | 2371 |  |
| `claude/drop-otplib` | `afbbfddb` | 2026-10-07 | #519 | no | 2441 |  |
| `claude/google-review-qr` | `d5aab7cc` | 2026-10-07 | #531 | no | 2458 |  |
| `claude/home-imagery-match` | `0475bbee` | 2026-10-07 | #492 | no | 2406 |  |
| `claude/home-pink-links` | `9150ce0e` | 2026-10-07 | #510 | no | 2447 |  |
| `claude/homepage-polish` | `61da8b33` | 2026-10-07 | #505 | no | 2416 |  |
| `claude/homepage-restore` | `9c559715` | 2026-10-07 | #507 | no | 2425 |  |
| `claude/nap-city-only` | `18b9b378` | 2026-10-07 | #532 | no | 2459 |  |
| `claude/portal-approvals-directory` | `b3cd6c9b` | 2026-10-07 | #501 | no | 2418 |  |
| `claude/portal-bridge-claim-released` | `8ae62605` | 2026-10-07 | #511 | no | 2436 |  |
| `claude/portal-licensing-kb` | `e34a36de` | 2026-10-07 | #500 | no | 2402 |  |
| `claude/portal-order-controls` | `65fd7c7e` | 2026-10-07 | #502 | no | 2424 |  |
| `claude/portal-organization-admin` | `82b4e044` | 2026-10-07 | #508 | no | 2433 |  |
| `claude/portal-service-requests` | `2c0a3724` | 2026-10-07 | #498 | no | 2397 |  |
| `claude/registry-verified-live-20261007` | `f7f3e620` | 2026-10-07 | #504 | no | 2393 |  |
| `claude/retire-portal-claims` | `e8e8c979` | 2026-10-07 | #534 | no | 2461 |  |
| `codex/remove-unused-otplib-20261007` | `237d9a08` | 2026-10-07 | #516 | no | 2442 |  |
| `feature/mobile-service-requests-2026-10-07` | `95f56d01` | 2026-10-07 | #530 | no | 2481 |  |
| `kb/mobile-device-enrollment-2026-10-07` | `f45adcfa` | 2026-10-07 | #527 | no | 2457 |  |
| `chatgpt/canonical-identity-location-network-20261007` | `c45d6f37` | 2026-10-08 | #529 | no | 2523 |  |
| `chatgpt/windows-logon-notice-20261007` | `39aa707f` | 2026-10-08 | #523 | no | 2494 |  |
| `claude/autopilot-import-deploy-event` | `f7476d37` | 2026-10-08 | #549 | no | 2548 |  |
| `claude/nifty-newton-uk9g7t` | `58b2c637` | 2026-10-08 | #550 | no | 2556 |  |
| `claude/store-pdf-fixes` | `9c939174` | 2026-10-09 | #552 | no | 2556 |  |
| `claude/store-start-here-preview` | `9da96769` | 2026-10-09 | #551 | no | 2560 |  |
| `claude/exit-popup-navy-split` | `b89d2be7` | 2026-10-10 | #566 | no | 2592 |  |
| `claude/kie-approval-rule` | `9877bf95` | 2026-10-10 | #572 | no | 2590 |  |
| `claude/proactive-readability` | `98479874` | 2026-10-10 | #567 | no | 2597 |  |
| `claude/t7-contact-audit-team-config` | `8e5d7161` | 2026-10-10 | #561 | no | 2569 |  |
| `claude/t7-copy-overlays-pdfs` | `158c5f0d` | 2026-10-10 | #558 | no | 2566 |  |
| `claude/t7-desk-alamo-link` | `0ff4e237` | 2026-10-10 | #563 | no | 2577 |  |
| `claude/zoho-agent-rules` | `b4422de9` | 2026-10-10 | #568 | no | 2583 |  |
| `claude/zoho-oauth-manager` | `138ad9f3` | 2026-10-10 | #562 | no | 2581 |  |
| `codex/site-telemetry-mount-20261010` | `32659be4` | 2026-10-10 | #569 | no | 2584 |  |
| `chatgpt/tech-tool-storage-20261011` | `5e9a74fd` | 2026-10-11 | #580 | no | 2614 |  |
| `docs/store-cart-and-agent-coordination` | `30b32487` | 2026-10-11 | #576 | no | 2600 |  |
| `chatgpt/portal-black-theme-20261011` | `d82d37b8` | 2026-10-14 | #578 | no | 2648 |  |
| `claude/charming-faraday-rrlyzq` | `1be5046b` | 2026-10-14 | #608 | no | 2591 |  |
| `claude/keen-hawking-pnlyc7` | `a5c3e90f` | 2026-10-14 | #588 | no | 2603 |  |
| `claude/kie-key-and-agent-doc-encoding` | `a06d63f5` | 2026-10-14 | #589 | no | 2615 |  |
| `claude/t10-agent-governance-docs` | `f9bc3c97` | 2026-10-14 | #557 | no | 2605 |  |
| `claude/t2-npm-audit` | `51422980` | 2026-10-14 | #559 | no | 2606 |  |
| `claude/t2-ops-hardening` | `201f906f` | 2026-10-14 | #560 | no | 2653 |  |
| `claude/t7-outstanding` | `283e340c` | 2026-10-14 | #587 | no | 2606 |  |
| `claude/ai-background-check-b` | `f34c9938` | 2026-10-15 | #609 | no | 2737 |  |
| `claude/de-todo-list` | `0cadd0f6` | 2026-10-15 | #612 | no | 2762 |  |
| `claude/dreamy-einstein-mbqa0w` | `9d713c94` | 2026-10-15 | #553 | no | 2741 |  |
| `claude/org-representation-portal` | `cce8201d` | 2026-10-15 | #593 | no | 2770 |  |
| `claude/password-address-forms` | `e81ef5ce` | 2026-10-15 | #613 | no | 2762 |  |
| `claude/youthful-babbage-va5j5a` | `56d46444` | 2026-10-15 | #605 | no | 2735 |  |
| `claude/ai-background-check-conversion` | `5e8a09a1` | 2026-10-16 | #616 | no | 2780 |  |
| `ccr-3c8a5c8e-7wsj3j` | `2c3f09c8` | 2026-10-17 | #621 | no | 2793 |  |
| `codex/documentation-closeout-20261018` | `6c5918c0` | 2026-10-17 | #623 | no | 2788 |  |
| `codex/portal-closeout-20261018` | `0c2eb5fd` | 2026-10-17 | #619 | no | 2786 |  |
| `codex/ai-claim-closeout-20261018` | `bb3efaca` | 2026-10-18 | #627 | no | 4 |  |
| `codex/portal-context-closeout-20261018` | `7931f55a` | 2026-10-18 | #622 | no | 2802 |  |
| `codex/portal-durability-closeout-20261018` | `c8d853c4` | 2026-10-18 | #625 | no | 1 |  |
| `codex/visual-audit-closeout-20261018` | `37a6c250` | 2026-10-18 | #624 | no | 2791 |  |
| `claude/lucid-dijkstra-s3v2s3` | `236a79ab` | 2026-10-21 | #687 | no | 8 |  |
| `claude/exciting-cannon-ttx8m8` | `277efb8d` | 2026-10-25 | #838 | no | 1 |  |
| `chatgpt/ga4-privacy-20261028` | `a8debada` | 2026-10-28 | #860 | no | 1 |  |
| `chatgpt/fix-follow-redirects-20261031` | `a18721ad` | 2026-10-31 | #862 | no | 1 |  |
| `techtool/move59-job-contract` | `1d98889e` | 2026-11-01 | #922 | no | 1 |  |
| `techtool/move60-job-queue-design` | `7041083b` | 2026-11-01 | #924 | no | 1 |  |
| `techtool/move61-enrolment-design` | `2c716674` | 2026-11-01 | #925 | no | 1 |  |
| `techtool/move62-device-certificates-design` | `94cb5f26` | 2026-11-01 | #926 | no | 1 |  |
| `techtool/move63-mtls-design` | `ed5e1f3b` | 2026-11-01 | #927 | no | 1 |  |
| `techtool/move64-cert-rotation-design` | `d0628da2` | 2026-11-01 | #928 | no | 1 |  |
| `techtool/move65-job-signature-verify` | `b1e3786d` | 2026-11-01 | #929 | no | 2 |  |
| `techtool/move66-replay-store` | `f1ea95b5` | 2026-11-01 | #930 | no | 1 |  |
| `techtool/move67-catalog-gate` | `a06b2ce1` | 2026-11-01 | #932 | no | 1 |  |
| `techtool/move68-service-skeleton` | `93207a96` | 2026-11-01 | #933 | no | 1 |  |
| `techtool/move69-heartbeat` | `5538e9c1` | 2026-11-01 | #934 | no | 1 |  |
| `techtool/move70-evidence-upload` | `52110030` | 2026-11-01 | #935 | no | 1 |  |
| `techtool/move71-offline-queue` | `ce36b472` | 2026-11-01 | #936 | no | 1 |  |
| `techtool/move72-agent-install` | `9eddc54b` | 2026-11-01 | #937 | no | 1 |  |
| `techtool/move74-break-glass-deferred` | `52b2b28e` | 2026-11-01 | #938 | no | 1 |  |
| `techtool/move75-revocation` | `2cca78ec` | 2026-11-01 | #939 | no | 1 |  |
| `techtool/move76-hub-unreachable` | `31cff383` | 2026-11-01 | #940 | no | 1 |  |
| `techtool/move77-queue-loadtest` | `d403dec3` | 2026-11-01 | #941 | no | 1 |  |
| `techtool/move78-kill-switch` | `635f2b16` | 2026-11-01 | #942 | no | 1 |  |
| `techtool/download-timeouts` | `c94a11ee` | 2026-11-02 | #953 | no | 1 |  |
| `techtool/exportdrift-pascalcase` | `eee6cb79` | 2026-11-02 | #952 | no | 1 |  |
| `techtool/fix-diagnostic-bundle-name` | `53bf5e06` | 2026-11-02 | #944 | no | 1 |  |
| `techtool/sync-refusal-codes` | `6bdf51bb` | 2026-11-02 | #945 | no | 1 |  |
| `techtool/tracker-regen-section-e` | `eab32c6f` | 2026-11-02 | #946 | no | 1 |  |
| `ccr-d557afd7-8c8pl5` | `baaefcc4` | 2026-11-04 | #954 | no | 1 |  |

## 3. Not merged, older than 30 days (69)

| Branch | Head | Last commit | PR | PR state | Commits not on main | Note |
|---|---|---|---|---|---:|---|
| `preserve/internal-pages-pre-redact` | `49404c2f` | 2026-08-06 | none | no PR | 680 |  |
| `codex/personality-ui-repair` | `977d712a` | 2026-08-07 | none | no PR | 685 |  |
| `preserve/live-pink-sticky-nav` | `09b3a884` | 2026-08-07 | none | no PR | 697 |  |
| `fix/portal-live-authorization-20260810` | `90e6e3e1` | 2026-08-10 | none | no PR | 769 |  |
| `fix/zoho-payments-api-20260810` | `097aeeec` | 2026-08-10 | #9 | closed unmerged | 777 |  |
| `cursor/bc-4d2ec92c-ac90-4031-ab07-7868a138acd4-a3cb` | `267741cf` | 2026-08-13 | #18 | closed unmerged | 854 |  |
| `cursor/design-system-audit-a75a` | `f855568a` | 2026-08-13 | #17 | closed unmerged | 849 |  |
| `cursor/fix-nested-interactive-controls-3143` | `35357e60` | 2026-08-17 | none | no PR | 927 |  |
| `cursor/desk-tab-content-3080` | `4ae14534` | 2026-08-19 | #41 | closed unmerged | 982 |  |
| `chore/cursor-asset-workflow` | `7ed2ebe9` | 2026-08-20 | none | no PR | 990 |  |
| `cursor/code-only-leftovers` | `10d0659d` | 2026-08-22 | none | no PR | 1022 |  |
| `cursor/inner-page-conversion-bar` | `74cda1bb` | 2026-08-22 | none | no PR | 1020 |  |
| `site-recovery-upgrade` | `1fae3e40` | 2026-08-23 | #44 | closed unmerged | 808 |  |
| `stabilization/four-tier-store-20260824` | `532474f5` | 2026-08-24 | none | no PR | 1053 |  |
| `cursor/campaign-landing-pages-23d4` | `8b5118eb` | 2026-08-25 | #59 | closed unmerged | 1062 |  |
| `cursor/digerati-experts-or-de-23d4` | `108692fa` | 2026-08-25 | #57 | closed unmerged | 1060 |  |
| `docs/master-guardrails-status-20260825` | `8915ae78` | 2026-08-25 | none | no PR | 1047 |  |
| `fix/atmosphere-mesh-refresh-20260825` | `102a3e25` | 2026-08-25 | none | no PR | 1060 |  |
| `fix/atmosphere-mesh-refresh-main-20260825` | `a0ca3a19` | 2026-08-25 | #71 | closed unmerged | 1086 |  |
| `fix/portal-auth-fail-closed-20260825` | `04af768c` | 2026-08-25 | none | no PR | 1047 |  |
| `fix/store-orders-server-authoritative-20260825` | `6c4c74e4` | 2026-08-25 | #54 | closed unmerged | 1047 |  |
| `cursor/repository-authority-23d4` | `6495ebd0` | 2026-08-26 | #72 | closed unmerged | 1087 |  |
| `ops/verify-production-current-20260825` | `ffbec825` | 2026-08-26 | none | no PR | 1091 |  |
| `chatgpt/visual-system-v2-sitewide-20260827` | `99aee3f7` | 2026-08-27 | none | no PR | 1095 |  |
| `chatgpt/visual-system-v2-sitewide-current-20260827` | `7e8b7f42` | 2026-08-27 | none | no PR | 1101 |  |
| `cursor/de-desk-ask-support-style-c9ac` | `3aafc210` | 2026-08-27 | none | no PR | 1099 |  |
| `cursor/production-runner-pool-23d4` | `119bc7bc` | 2026-08-28 | #88 | closed unmerged | 1124 |  |
| `chatgpt/store-durable-solution-drafts` | `f6502a55` | 2026-08-30 | none | no PR | 1227 |  |
| `claude/overnight-store-site-ux-9f53da` | `46318936` | 2026-08-30 | none | no PR | 1220 |  |
| `handoff/claude-from-checkpoint-2026-08-30` | `d8932aa1` | 2026-08-30 | none | no PR | 1235 |  |
| `qa/homepage-support-116-visual` | `399a39f5` | 2026-08-30 | #136 | closed unmerged | 1233 |  |
| `chatgpt/kie-ai-asset-connector-20260831` | `fcd67bfc` | 2026-08-31 | #168 | closed unmerged | 1296 |  |
| `chatgpt/pronunciation-dictionary-refine-20260831` | `17ef2136` | 2026-08-31 | #156 | closed unmerged | 1310 |  |
| `chatgpt/scrollcraft-experience-plan-20260901` | `03f1e32c` | 2026-09-01 | #176 | closed unmerged | 1326 |  |
| `claude/kie-avail-default-2-7fkrfd` | `8cbc6275` | 2026-09-02 | none | no PR | 1336 |  |
| `claude/kie-avail-default-3-7fkrfd` | `30bb0cfe` | 2026-09-02 | none | no PR | 1337 |  |
| `claude/kie-avail-default-7fkrfd` | `5227ea2e` | 2026-09-02 | none | no PR | 1335 |  |
| `claude/kie-avail-restricted-2-7fkrfd` | `69e04613` | 2026-09-02 | none | no PR | 1336 |  |
| `claude/kie-avail-restricted-7fkrfd` | `bf57641d` | 2026-09-02 | none | no PR | 1335 |  |
| `claude/kie-first-still-7fkrfd` | `e99e133e` | 2026-09-02 | none | no PR | 1335 |  |
| `claude/kie-first-still-restricted-7fkrfd` | `c2125f6c` | 2026-09-02 | none | no PR | 1335 |  |
| `claude/kie-preflight-restricted-7fkrfd` | `47499ea1` | 2026-09-02 | none | no PR | 1335 |  |
| `claude/kie-probe-default-7fkrfd` | `0ed405cb` | 2026-09-02 | none | no PR | 1335 |  |
| `plugin/de-agent-skills-package` | `94bdcd85` | 2026-09-02 | none | no PR | 1 |  |
| `claude/eight-block-correction` | `d680c4c4` | 2026-09-03 | #189 | closed unmerged | 1350 |  |
| `chatgpt/finish-bug-hunt` | `dbcc79d4` | 2026-09-04 | #196 | closed unmerged | 1364 |  |
| `chatgpt/homepage-challenger-preview` | `a96fc50f` | 2026-09-05 | none | no PR | 1378 |  |
| `claude/experience-v1-complete` | `90e959d4` | 2026-09-07 | #200 | closed unmerged | 1366 |  |
| `chatgpt/map-crm-taxonomy-20260910` | `b286d48d` | 2026-09-09 | #209 | closed unmerged | 1379 |  |
| `chatgpt/cursor-agent-bus-20260912` | `09b76857` | 2026-09-12 | none | no PR | 1388 |  |
| `claude/c1-visual-a11y-repairs-20260912` | `ae473e5b` | 2026-09-12 | #219 | closed unmerged | 1408 |  |
| `cursor/c8-app-main-landmark` | `9ae33f82` | 2026-09-12 | #220 | closed unmerged | 1399 |  |
| `cursor/review/dev-portal-bootstrap-docs-20260913` | `33000b60` | 2026-09-13 | none | no PR | 1428 |  |
| `cursor/review/seeded-admin-p0-20260912` | `016508ec` | 2026-09-13 | none | no PR | 1420 |  |
| `cursor/review/website-integration-candidate-20260913` | `8a3196b5` | 2026-09-13 | none | no PR | 1427 |  |
| `cursor/homepage-v4-20260927` | `c57ac685` | 2026-09-29 | #276 | closed unmerged | 1480 |  |
| `claude/audit-brace-expansion` | `987dc2d6` | 2026-09-30 | #278 | closed unmerged | 1609 |  |
| `claude/deps-brace-expansion` | `8102862c` | 2026-09-30 | #279 | closed unmerged | 1609 |  |
| `cursor/c7-f1-visual-briefs-20260913` | `e2ceaef6` | 2026-09-30 | #221 | closed unmerged | 1670 |  |
| `cursor/money-access-20260930` | `eefdcac3` | 2026-09-30 | #300 | closed unmerged | 1750 |  |
| `claude/deck-phone-layout` | `93a5fc8f` | 2026-10-01 | #305 | closed unmerged | 1753 |  |
| `claude/sleepy-bardeen-81jlur` | `82cd7bd1` | 2026-10-01 | none | no PR | 1778 |  |
| `claude/store-pdf-renderer` | `7a336c58` | 2026-10-01 | #308 | closed unmerged | 1757 |  |
| `backup/2026-10-03-before-v7-restyle` | `c702a4fc` | 2026-10-02 | none | no PR | 1886 |  |
| `backup/2026-10-03-v7-restyle-merged` | `6ce035d6` | 2026-10-02 | none | no PR | 1899 |  |
| `cursor/invent-blogpost-main-id-20261002` | `547a1342` | 2026-10-02 | #363 | closed unmerged | 1902 |  |
| `cursor/invent-marketing-de-naming-20261002-v2` | `d18748eb` | 2026-10-02 | #357 | closed unmerged | 1902 |  |
| `backup/2026-10-03-v7-restyle-approved` | `13f2214c` | 2026-10-03 | none | no PR | 1892 |  |
| `claude/fix-259-tenant-files-durable` | `4fd94c36` | 2026-10-03 | none | no PR | 2105 |  |

## 4. Not merged, last 30 days (13)

| Branch | Head | Last commit | PR | PR state | Commits not on main | Note |
|---|---|---|---|---|---:|---|
| `chatgpt/portal-claude-takeover-20261002` | `6658e47f` | 2026-10-07 | none | no PR | 2195 |  |
| `claude/hero-ultrawide` | `2f8527a1` | 2026-10-07 | #503 | closed unmerged | 2393 |  |
| `chatgpt/jumpcloud-directory-sync-20261011` | `72cdd50e` | 2026-10-10 | none | no PR | 2598 |  |
| `concept/ai-background-check` | `d68a0632` | 2026-10-14 | #575 | closed unmerged | 2645 |  |
| `claude/ai-background-check-page` | `d3174851` | 2026-10-15 | #607 | closed unmerged | 2735 |  |
| `claude/health-probe-deadlines` | `522d44ea` | 2026-10-20 | #659 | closed unmerged | 1 |  |
| `claude/homepage-v2-reference` | `f741fb1b` | 2026-10-22 | none | no PR | 2 |  |
| `fix/blog-narration-static` | `42902308` | 2026-10-22 | none | no PR | 1 |  |
| `chatgpt/portal-browser-state-20261101` | `ae3398b9` | 2026-11-01 | none | no PR | 2 |  |
| `chatgpt/remote-assist-managed-model-20261102` | `6d8f3e8e` | 2026-11-02 | #950 | closed unmerged | 3 |  |
| `techtool/move-41-pin-first-download` | `8f5c00f1` | 2026-11-02 | #947 | closed unmerged | 1 |  |
| `techtool/pin-refresh-and-ack` | `2e5c4397` | 2026-11-02 | #948 | closed unmerged | 2 |  |
| `claude/tech-tool-extract` | `37f673ca` | 2026-11-05 | none | no PR | 347 |  |

## Open PRs (excluded)

Update, later on 2026-11-06: #955 merged into `main` (`627eea17`) after this scan, so `claude/hygiene-stripe-turnstile-20261104` now belongs in group 1.

| Branch | Head | Last commit | PR |
|---|---|---|---|
| `chatgpt/desk-consent-smoke-20261101` | `c368abe1` | 2026-11-02 | #877 |
| `chatgpt/restore-v2-before-scenes-20261101` | `312855fe` | 2026-11-01 | #882 |
| `claude/hygiene-stripe-turnstile-20261104` | `4a3d27e3` | 2026-11-06 | #955 |
| `claude/legacy-secret-remove` | `573b6a21` | 2026-11-05 | #959 |
| `claude/stripe-columns-unused-20261105` | `cd2d8edd` | 2026-11-06 | #968 |
| `claude/stripe-columns-drop-20261105` | `5864ef40` | 2026-11-06 | #969 |

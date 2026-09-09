# Open work audit — 2026-09-09

Deliverable for issue **#127** `[P0 RELEASE] Re-audit open PRs/branches and final production SHA after reconciliation`.

Scope: every open pull request and every active claim in `.ai/ACTIVE_WORK.yaml`, reconciled against
`origin/main` @ `611acfdb` ("Add hidden homepage challenger review page").

Method: `git merge-base` / `git rev-list` / `git merge-tree` against `origin/main` for each open PR head,
plus a read of every agent session that touched this repository between 2026-08-26 and 2026-09-08.

**Nothing in this document merges, closes or reopens anything.** Per `CLAUDE.md`, merge and close
decisions are Joe's. This is the audit those decisions need.

---

## 0. Actions taken 2026-09-09 (post-audit, on Joe's authorization)

Joe authorized four items after reading this audit. Three completed, one blocked, one refused by tooling:

| Action | Result |
|---|---|
| Merge #197 (vector logo system) | **Merged** — `7efc2001` |
| Merge #198 (favicon + social card) | **Merged** — `f7cdf395` |
| Merge #199 (eight blocks) | **Merged** — `667aa7d2` |
| Close #189 (superseded) | **Closed** with a pointer to #199 |
| Merge #196 (security) | **BLOCKED — must not merge.** See §10 |
| Branch protection on `main` | **Could not perform** — see §8 |

One regression was introduced and fixed in the same pass: **#199 carried a YAML syntax error into
`.ai/ACTIVE_WORK.yaml`**, which merging it put on `main`. In its new `de-eight-block-correction`
claim, the value

```yaml
    supersedes: PR #189 (branch claude/eight-block-correction, based on
      pre-restore main; closed in favour of this re-cut)
```

is not valid YAML: an unquoted ` #` opens a comment, so the value truncates to `PR` and the
continuation line raises `ParserError: expected <block end>`. The whole registry stopped parsing.
Converted to a `>-` folded scalar, matching every other multi-line value in the file; the sentence
is preserved verbatim.

**This got through because nothing validates this file.** CI runs typecheck, test, build, audit and
smoke — none of which parse `.ai/ACTIVE_WORK.yaml`. The register that every agent is required to
read before touching code can be syntactically broken by any merge without a single check going
red. Adding a YAML parse step to CI is a small, obvious follow-up; it is not done here because it
widens this change beyond documentation, but it should be its own PR.

`origin/main` is now `667aa7d2`. The §2 table below records the pre-merge state and is left
unedited as the audit of record; §0 and §10 are the corrections on top of it.

---

## 1. Headline findings

1. **No open PR conflicts with `main`.** All 17 open PR branches merge clean. The blocker on this
   backlog is decision latency, not merge debt.
2. **The "uncommitted work at risk" scare is resolved — nothing was lost.** See §4.
3. **The `restore-homepage-v1` claim is stale.** The work is fully contained in `main`; the register
   still lists it as active. Corrected in this change.
4. **Two genuine collisions remain**, both from parallel agents building the same feature: the
   pronunciation card (§5) and, functionally though not by file, the kie.ai connector (§6).
5. **Staleness is the real risk.** Five PRs are 46–89 commits behind `main`. They merge clean today
   but have not been exercised against current `main`.

---

## 2. Per-PR disposition

`ahead`/`behind` are commit counts against `origin/main` @ `611acfdb`. All merge clean.

| PR | Head | Ahead | Behind | Proposed disposition |
|---|---|---:|---:|---|
| #200 | `claude/experience-v1-complete` | 2 | 0 | **Hold** — gated on the creative-reset decision |
| #199 | `claude/eight-block-recut` | 1 | 1 | **Land** — ready, non-draft |
| #198 | `claude/favicon-og-brand-refresh` | 1 | 1 | **Land** — verified, only sitting in draft |
| #197 | `claude/digerati-logo-recreation-7s0443` | 2 | 1 | **Land** — verified, only sitting in draft |
| #196 | `chatgpt/finish-bug-hunt` | 1 | 1 | **Land** — only open `[SECURITY]` work |
| #190 | `claude/de-naming-canon` | 1 | 15 | **Land** — docs only |
| #189 | `claude/eight-block-correction` | 1 | 15 | **Close** — superseded by #199 |
| #188 | `claude/nano-banana-2-setup-itot5a` | 1 | 15 | **Supersede** — see §3 |
| #187 | `chatgpt/ask-de-shared-auth-20260902` | 6 | 15 | **Land** — ready, non-draft |
| #186 | `claude/de-why-passage-flagship` | 6 | 15 | **Hold** — Scrollcraft freeze |
| #185 | `claude/kie-skills-cloud-setup-13a8xh` | 7 | 16 | **Split** — governance vs kie.ai tooling |
| #184 | `claude/digerati-experts-v2-scrollcraft-7fkrfd` | 4 | 16 | **Hold** — blocked on kie.ai auth |
| #176 | `chatgpt/scrollcraft-experience-plan-20260901` | 8 | 46 | **Decide** — gates a repo-wide freeze |
| #168 | `chatgpt/kie-ai-asset-connector-20260831` | 2 | 70 | **Decide** — see §6 |
| #157 | `claude/pronunciation-dictionary-card-2026-08-31` | 5 | 76 | **Decide** — see §5 |
| #156 | `chatgpt/pronunciation-dictionary-refine-20260831` | 22 | 76 | **Decide** — see §5 |
| #149 | `claude/portal-access-admin-request-faa282` | 1 | 89 | **Rebase then land** — oldest open PR |

### Recommended landing order

Ready and low-risk first, so the stale set rebases onto a settled `main` once:

1. #197, #198 (brand; verified) → then re-scrape social cards
2. #199 (eight blocks; ready)
3. #196 (security; highest business priority, but touches auth — review properly)
4. #187 (Ask DE auth)
5. #190 (docs)
6. #149 (rebase onto current `main`, re-verify, land)
7. Everything else follows a decision, not a queue position.

---

## 3. Claim register reconciliation

`.ai/ACTIVE_WORK.yaml` claims, checked against `main` @ `611acfdb`:

| Claim | Recorded | Actual | Action |
|---|---|---|---|
| `restore-homepage-v1` | active | **0 commits ahead of `main`** — fully merged | **Retired in this change** |
| `de-experience-v1` | active | genuinely in flight (PR #200) | keep, note Act 4+ unbuilt |
| `de-site-v2-scrollcraft` | active | genuinely in flight (PR #184) | keep |
| `claude-code-skill-installs` | active | merged and verified live | retire via #188 |
| `pronunciation-flipbook-recovery` | active | issue #152 closed; branch present | keep pending §5 |

`restore-homepage-v1` is the important one. The register asserted an active claim over eight
homepage section files — a concurrency lock that would make any other agent stand off those
files — while the work was in fact already in `main`. That is the failure mode
`docs/ACTIVE-WORK-COORDINATION.md` warns about, in the opposite direction: not a claim that fails
to protect, but a claim that blocks work with nothing behind it.

---

## 4. The "uncommitted work at risk" item — resolved, nothing lost

Session `session_01QdVjKSy1Rppb3R32ZxnJgn` reported a dirty, never-pushed worktree on
`chore/remove-dead-store-route-handlers-20260825` @ `102a3e25`, and its container then died with
`computer_unreachable`. That looked like unrecoverable loss.

It was not:

- Commit `102a3e25` "chore(routes): remove dead duplicate checkout/order handlers" **exists** and is
  reachable on `origin/fix/atmosphere-mesh-refresh-20260825`.
- A sibling branch `origin/chore/remove-dead-store-route-handlers-main-20260825` carries two further
  cleanup commits (`35f8d56c`, `90f5d5e6`).
- **The cleanup is already reflected in `main`.** The duplicate write handlers those commits removed
  — `POST /api/store/checkout/zoho` and `POST /api/store/orders` — do not appear in
  `origin/main:server/routes.ts`. The store routes that remain are cart, quote-request and read
  endpoints.

So the branch name in the session record was simply never pushed under that name. No work was lost
and no re-do is required. The sibling branch is 20+ commits divergent on an old base and carries
unrelated stabilization history; it should be **deleted rather than merged**.

This downgrades the item from "urgent recovery" to "branch hygiene".

---

## 5. Collision: the pronunciation card (#156 vs #157)

Two agents built the same feature from the same base (`529a7da9`). Both PRs are open. Five files
overlap, including the component itself:

```
.ai/ACTIVE_WORK.yaml
client/public/audio/README.md
client/src/components/PronunciationCard.palette.test.ts
client/src/components/PronunciationCard.tsx
scripts/vendor-pdfjs.mjs
```

This is not a style preference — the two take a different architectural line on the audio asset:

- **#157 (Claude)** commits the recording itself (`client/public/audio/digerati-pronunciation.wav`)
  and ships visual-QA screenshots at 390/768/1440.
- **#156 (ChatGPT)** does not commit audio; it adds `scripts/vendor-pronunciation-audio.mjs` to
  fetch it at build time, plus `scripts/public-route-smoke.mjs`.

**The question for Joe:** does a binary audio asset belong in the repository, or should it be
vendored at build time like pdf.js already is (`scripts/vendor-pdfjs.mjs`, which both branches
touch)? Answer that and the winner follows; the loser closes with a pointer.

Both are 76 commits behind `main` and will need re-verification whichever wins.

---

## 6. Collision: kie.ai connectors (#168 vs #184)

`.ai/ACTIVE_WORK.yaml` asserts these are "disjoint". **Verified true at file level** — zero overlap:

- **#168** — `design/KIE-AI-ASSETS.md`, `scripts/kie-assets.mjs`
- **#184** — `.claude/skills/scrollcraft/scripts/kie.mjs`, `docs/kie/KIE-RULES.md`, asset-plan docs,
  a Windows installer script

But file-disjoint is not the same as non-duplicative: these are **two independent kie.ai client
implementations**, in two languages of invocation, with two key-resolution paths. Keeping both means
every future spend guard, model-registry change and provenance rule has to be written twice.

Recommend picking one canonical connector before either merges. Neither can be exercised today
regardless — see §7.

---

## 7. Blocked on environment, not on code: kie.ai

Six probe sessions ran on 2026-09-02 across two environments and none reached a working generation
path. Two distinct faults:

- **Default env** (`env_011CUSMh2u6F2mE33JpKJ8A3`) — kie.ai hosts blocked at the proxy; no route.
- **Restricted env** (`env_014pkTA5N84BA6wPcTjEHrYe`) — hosts reachable, 7 models enumerated and
  credits confirmed intact, but generation returns **401**.

The Restricted-environment result is the useful one: the account and credits are fine, so this is a
credential-plumbing fault, not a billing or provisioning problem. Per `CLAUDE.md` the key is read
from the environment or the gitignored `.env` (`KIE_AI_API_KEY`, or `KIE_API_KEY` per PR #168) —
never from a committed file.

Until one environment can authenticate, PRs #168, #184 and the image half of #185 cannot be
validated, and no image generation should be attempted.

---

## 8. The structural cause

Several items above are the same failure wearing different hats: two agents building one feature,
a claim register that cannot bind, verified work sitting unmerged for days, four open issues asking
for the same thing.

`CLAUDE.md` and `AGENTS.md` already forbid developing on `main`. That rule is **convention only** —
it is not enforced by the platform. Issues #100, #115 and #124 all ask for enforcement and none has
been actioned; #124 is the most complete statement and should be the survivor.

Enabling branch protection with required checks is the single change that prevents recurrence.

**Attempted 2026-09-09 on Joe's authorization, and refused by the platform.** The session's
GitHub credential is an App installation token without the `administration` permission:

```
GET /repos/digeratiexperts/digeratiexperts-site/branches/main/protection
403 "Resource not accessible by integration"
```

Branch protection needs repository-admin scope, which no agent in this setup holds. **This one
has to be done by a human in the GitHub UI** — Settings → Branches → Add branch protection rule
for `main`. The minimum that satisfies #124:

- Require a pull request before merging
- Require status checks to pass, with **`Typecheck, test, build, audit, and smoke`** as the
  required check (that is the exact check-run name this repo's CI publishes)

A note on required approvals: adding "require N approving reviews" would be stricter, but every
PR in this repo is authored by the `digeratiexperts` account, and GitHub does not let an account
approve its own pull request. Turning that on with one human would deadlock the queue. Require the
PR and the check first; add mandatory review only alongside a second reviewer account.

Had this been enforced already, §10 would not have been possible.

---

## 9. Production SHA

`origin/main` @ `611acfdb` is the current integration head. This audit does **not** assert that
`611acfdb` is what production is serving — that requires a deploy-log or live check, which is
tracked as its own step rather than assumed here.

---

## 10. PR #196 is corrupted and must not be merged

Found on 2026-09-09 while attempting to land it. This supersedes the "**Land**" disposition given
for #196 in §2, which was based on its stated scope before its CI failure was diagnosed.

### `server/routes.ts` is a binary blob on `chatgpt/finish-bug-hunt`

CI reports `error TS1490: File appears to be binary`. Confirmed at byte level — on that branch the
file is 150,060 bytes of high-entropy binary data beginning `Y 252 347 212 x - 256 351`, where on
`main` it begins `import express, {`. `git diff --numstat` classifies it as binary (`-  -`).

Merging would replace **6,274 lines of production routing** — the authenticated store, portal and
auth endpoints — with garbage.

### The branch also deletes ~1,200 lines of unrelated subsystems

The single commit `dbcc79d4` removes in full: `server/services/shipping.ts` (547 lines),
`agent-installer/` (6 files, 485 lines), and `electron/main.ts` + `electron/preload.ts` (178
lines). None of that is MFA storage, migrations or session preservation.

### What is salvageable

The additive security work looks sound and is worth re-cutting: `server/portalMfaCrypto.ts` and
its test, `migrations/0001_portal_auth_durable.sql`, `migrations/0002_portal_org_approvals.sql`,
`scripts/run-migrations.mjs`, and small edits to `portalAuthStore.ts`, `use-auth.tsx`,
`portalApi.ts`, `production.config.ts` and deploy config.

Whatever session-preservation changes lived inside `routes.ts` are **not recoverable** from the
binary blob and must be rewritten against `main`'s copy. That rewrite was not attempted here:
reconstructing an auth-path change from a corrupted diff means guessing at security intent.

Issue #195 stays open. Recorded on the PR thread as well.

---

## Cross-reference

Programs and per-thread tracking for everything above live in Zoho Projects under
`DE 01`–`DE 06` in the `digeratiexperts` portal.

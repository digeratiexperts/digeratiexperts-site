# DE marketing voice

Joe, 2026-10-22: "our marketing has to have both serious but also funny and in a wise-ass kind of way. We need visuals and text always, a way to generate it all properly and edit it all."

## The voice in one line

The senior tech who has seen it all: straight about the problem, dry about the absurdity around it.

## Rules

1. **Substance first.** Every joke sits on top of a true, useful point. If the line only works without the point, cut the line.
2. **One wisecrack per piece of copy, two at most.** Put it in the subject line, the opener or the sign-off. The middle stays plain.
3. **Punch at the situation, never at the reader.** Forms, jargon, holiday timing and the vendor who suddenly "updated" their bank account are fair game. The reader, a victim, a breach and a client never are.
4. **Plain words.** No "leverage", "synergy", "cyber-pandemic", "military-grade", "next-gen".
5. **Truth rule (Tier 0, `docs/CLAIMS-REGISTER.md`).** No statistic without a named source in the register. No promise of coverage, prevention or outcome. No "best", "leading" or "most businesses". The generator fails on these.
6. **Say the boundary out loud.** Each outward piece carries its honest limit: "we don't sell insurance", "no filter catches everything". Said plainly, it reads as confidence.
7. **The join link lives in exactly one place:** the day-before email. Never on a page, card or post.

| Instead of | Write |
|---|---|
| "Most businesses fail their cyber insurance questionnaire." | "Your renewal form reads like an IT audit, because it is one." |
| "Our solution stops phishing." | "No filter catches everything. The call-back rule still works on a Friday afternoon." |
| "Don't be the next victim!" | "Forward this to whoever pays your bills. They'll thank you in January." |

## Visuals

Joe picked direction (a), branded editorial, on 2026-10-22:

- **Colours:** night ground `#050312`, a violet glow `#5B45E0`, magenta fills `#D3126A`, and magenta ink `#F04C97` for text on dark.
- **Type:** Oxanium for kickers and dates, Space Grotesk for headlines, Inter for body text.
- **Logo and date tile:** the real wordmark, and the same magenta date tile the session page uses.
- **No imagery:** no stock photos and no generated images. Images come only after DE picks a direction, per CLAUDE.md "Image generation needs DE's go-ahead first".

Cards are rendered at 1200×627 for LinkedIn and 1080×1080 for square feeds. Emails use a light body for deliverability, under a night header band.

## How to generate and edit

1. Edit `docs/marketing/sessions/<slug>.yaml`. It holds every email, post, card line, run of show and call script for that session. Write tokens such as `{date_long}`, `{time}` and `{page}` instead of literal dates or links; the values come from `client/src/data/deEvents.ts`.
2. Run `npx tsx scripts/de-marketing/build.ts`, adding `--cards` when card text changed. It lints the copy first and refuses to write if a rule above is broken.
3. Review `docs/marketing/sessions/preview.html`. For a single-file copy with the cards embedded, run `npx tsx scripts/de-marketing/build.ts --standalone <file>`.
4. Commit the YAML and the outputs together. `npm test` fails if the outputs are stale.

To add a session, copy one of the YAML files, change `slug`, and rewrite the copy. The session has to exist in `deEvents.ts` first.

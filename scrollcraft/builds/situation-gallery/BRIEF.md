# BRIEF: The Situation Gallery

**Interviewed, by proposal.** Claude proposed answers to the eight interview
questions in this session; Joe approved them on 2026-10-05: "all approved, keep
going." The answers below are those approved answers as the session recorded
them (the original proposal message was compacted; this is the recorded
wording, not a paraphrase written for this file).

Content authority: `client/src/data/solutionScenarios.ts` (situation titles,
pressures and the per-family `why` lines are Joe-approved public claims) and
`client/src/data/curatedSolutions.ts` (family labels). Brand floor:
`design/BRAND.md`. Nothing on this page claims more than those files do.

---

## The eight answers

1. **Vibe:** "precise, premium, calm, technical". References: apple.com/iphone,
   the plan-card screenshot Joe sent, Dieter Rams.
2. **Journey:** recognise pain → named → DE pulls it together → how it works →
   talk to DE.
3. **Energy:** calm → build → one intense moment → calm.
4. **Feeling and the one moment:** scattered tiles snapping into one aligned
   system.
5. **What no other site does:** the visitor's own situation tiles assemble on
   scroll.
6. **Range:** near premium-minimal, leaning editorial.
7. **One world or scenes:** distinct scenes.
8. **Assets:** the generated tile images (approved), the logo, real team photos.
   The only real person photograph in the repo is Joe's founder portrait, so it
   is the one used. No AI images of people.

---

## Grammar: Gallery / catalog (uniqueness.md §2.6)

The Store's ten situations are already a collection with a fixed schema
(title, pressure, families, arrangement), and the three Store groups are three
rooms, which is the "distinct scenes" answer. The visitor's real question on
arrival is "which of these is us", a range question, not "should I believe you".

Why the other seven lost:
- Filmic one-shot: contradicts "distinct scenes"; one continuous carry.
- Chaptered editorial: taken twice (de-v2, proactive-ecosystem-amplify).
- Live surface: the Store itself is the live surface; a second one would compete.
- Continuous world: contradicts "distinct scenes"; taken in spirit by experience-v1.
- Typographic poster: wastes the approved tile photography (answer 8).
- Split stage: there is no two-sided argument here.
- Rhythmic cutlist: contradicts "calm".

## Signature move: the keeping tray

Every situation object has a **Keep** control. A kept object's tile flies into a
small tray docked in the fixed chrome, and the tray shows the visitor's kept
tiles as a loose pile. At the peak the tray's tiles leave the chrome, scatter at
full scale across the stage, and snap into one aligned grid. The families those
situations are made of line up under the grid, **merged**: a family three
situations share appears once, with "in 3 of yours" beside it. The page then
says, in one line, what that merge means. The close is a label built from the
visitor's own set.

It is driven by the visitor's choices, not by a fixed diagram. If they keep
nothing, the tray assembles the three most common situations and says so.

---

## The feeling curve (written before the acts)

| # | Act | Feeling | What causes it |
|---|---|---|---|
| 1 | Room one: Something just happened | **Recognition**, with a little unease | Object one already on screen at load, labelled in plain words they would use; the walk sideways starts under their hand (`pan`) |
| 2 | Between rooms | **Clarity** | A wipe across a full-width plate (`reveal`) and one label: every situation is made of two or three of the same thirteen families (`count`, real numbers from the data) |
| 3 | Room two: We're growing or changing | **Momentum** | Four objects, a faster walk; the tray fills (`pan`, `tilt` on objects) |
| 4 | Room three: We have to prove it | **Weight** | Three objects, slower, the obligations; `parallax` inside each image frame |
| 5 | Silence | **Stillness** (authored) | A near-empty screen, the tray alone, one line: "That's your set." (`flow`) |
| 6 | The assembly (peak) | **Relief** | The kept tiles leave the tray, scatter large, snap into one grid; the families merge (`pin`, the largest span) |
| 7 | How DE works | **Confidence** | Three steps typeset as labels, and the real person who answers (`flow` + `in`, `parallax` on the portrait) |
| 8 | Close | **Resolve** | The inquiry plate, typeset exactly like a label, built from their set; it holds (`pin`, short) |

No two adjacent rows share a feeling. Act 5 is quieter than act 6 by design.

**The peak:** "I picked the ones that were us, and they snapped together into
one thing, and it showed me most of them were the same few families."
It lives in the assembly act, which has the largest span on the page (2.8vh
against a next-largest of 2.0vh).

**Tell-someone sentence:** It's the site where you collect your own IT problems
as you walk past them, and at the end they click together into one plan.

**Authored silence:** act 5 (about 0.7vh with one line and the tray). The
verification pass must not read it as dead scroll.

---

## The score

| Beat | Act | Device | Span | Why this one |
|---|---|---|---|---|
| Recognise pain | Room one | `pan` | 2.0 | Lateral reads as "options"; the collection starts at the top |
| Named | Between rooms | `flow` + `reveal` + `count` | flow | A wipe is a change of state: from "my problem" to "a family of problems" |
| Recognise pain | Room two | `pan` + `tilt` | 2.0 | Objects the visitor would pick up tilt toward the pointer |
| (cut to paper) | Room three wall | `flow` + `in` | flow | A short wall on paper separates the two pans and lands the hard cut |
| Recognise pain | Room three | `pan` + `parallax` | 1.6 | Depth inside the frames slows the eye: weight |
| (silence) | Your set | `flow` | about 0.7 | Quiet before the peak |
| DE pulls it together | The assembly | `pin` + bespoke | 2.8 | The frame holds while the visitor's set assembles |
| How it works | How DE works | `flow` + `in` + `parallax` | flow | Plain labels; the only document-like act |
| Talk to DE | Close | `pin` | 1.25 | The plate lands and holds |

Families used: pan, flow, reveal, count, tilt, parallax, pin (seven). No family
twice in a row: pan, flow, pan, flow, pan, flow, pin, flow, pin.
Zero `scrub` (no video: the approved assets are stills). Nine acts; measured
page length 12.97vh at 1440x900, 13.25vh at 768x1024, 13.75vh at 390x844, so
outside the taken 6-to-7-act, 13.6-to-13.8vh band on act count at every width
and on length at desktop and tablet.

Gallery bans honoured: no kinetic headlines, no spotlight, no magnet, no scrub,
no scrim copy over media, no persuasion in labels.

---

## Fingerprint gate (against every row, dimensions 1 to 5)

| Row | Grammar | Nav | Hero | Act shape | Close | Clears |
|---|---|---|---|---|---|---|
| de-v2 | differs (gallery vs chaptered) | differs (object index + tray vs margin rail with map) | differs (labelled photographic object vs type title page) | differs (pan spine) | differs (label plate built from choices vs colophon) | 5/5 |
| proactive-ecosystem-amplify | differs | differs | differs | differs | differs (own plate, not an existing CTA section) | 5/5 |
| why-passage | differs | differs (no course line, no gauge) | differs (straight, photographic) | differs (pan spine, 8 acts) | differs (no refusals list) | 5/5 |
| experience-v1 | differs | differs (index is a jump list, not a readout) | differs (object, not a world) | differs | differs | 5/5 |
| experience-v1 rev 2 | differs | differs | differs (no thesis H1 over a world) | differs | differs | 5/5 |

**Shared, said plainly:** the peak is a scatter-to-assembly moment, the same
family of moment as de-v2's map snapping together ("the pinned scatter-to-
assembly diagram peak is taken"). Differences: the pieces are the visitor's own
choices carried in from fixed chrome, not a fixed diagram; the result is
computed from those choices (merged families); and it is photographic objects,
not a drawn figure. Joe's interview answer 4 named this moment, so it is kept
and the difference is carried by the mechanism.

---

## Verification (2026-10-05)

- `shoot.mjs` at 1440x900, 390x844 and reduced motion: no dead scroll; every
  cue clears 4.5:1 at its worst frame. Contact sheets and moment captures are
  in `artifacts/visual-qa/situation-gallery/`.
- Moment captures with a five-situation set at 1440 and 390: no horizontal
  overflow, no console errors; rail travel 671 / 1080 / 719px at 1440 (room one
  is just under half a viewport, accepted), and 1150 / 1478 / 1173px at 390.
- Interaction test, motion and reduced motion: Keep updates the tray and the
  live region; the index opens, jumps (object lands centred, its Keep button
  takes focus) and closes on Escape; Space toggles Keep; the tray jumps to the
  assembly, which lists the merged families and the summary.
- axe-core on the whole page after every reveal has fired: 0 violations at
  1440 and 390.
- Feel check, cold, one word per act: recognition, clarity, momentum, weight,
  stillness, relief, confidence, resolve. Matches the curve.
- **Not covered:** a real phone (iOS Safari touch scrolling and the
  fixed tray over the browser chrome). No video on the page, so the iOS clip
  issues in verify.md do not apply.

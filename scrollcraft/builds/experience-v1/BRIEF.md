# BRIEF — Experience v1, revision 4

**Not a fresh interview.** Joe has directed this build across the whole
project; the answers below are his words, quoted from those messages, not
paraphrased and not invented. Where an answer is assembled from more than one
message it is marked.

## The eight answers

**1 · Vibe, in his words.** "advanced, intelligent, premium, calm, highly
capable, dimensional, controlled, original, modern, slightly futuristic,
human." Not: "hacker-themed, cartoonish, sci-fi fantasy, generic SaaS,
gaming-oriented, stock-corporate, or like a network-diagram presentation."

**2 · The journey.** Joe's canonical ten-act spine, with his advisor:
disconnected → underneath → the heading is wrong → DE sees the whole
environment → eight blocks emerge (Risk & Exposure as the continuous layer)
→ business operating system → customer in command → assessment → three paths
→ refusals → the final frame returns.

**3 · The energy curve.** From the spine: quiet recognition, rising exposure,
a tightening at the drift, release at the correction, then a level, calm
evidence tail. His constraint on the tail: "not to over do it."

**4 · How it should feel, and the one moment.** The reaction he named:
*"I've never seen an IT company explain what it does like this. These guys
clearly operate differently."* The one moment is the correction — the world
straightening — which is the only beat he has never asked me to change.

**5 · The one thing no other site does.** "the scrollcraft makes the scroll go
different directions while all the before and after sections of the page
smoothly flow into the current one." (2026-09-06.) That is the seed of this
revision's signature move.

**6 · How far from premium-minimal.** Premium and restrained, but committed:
"not to over do it but do it fully and right if that makes sense." And the
bar: "these things either work or they absolutely don't."

**7 · One unbroken world, or distinct scenes.** One unbroken world, explicitly
and repeatedly: "does it feel like one world transformed by scroll, not
sections/slides/diagrams." Revision 4 extends that to the *whole page*: the
evidence sections were still hard-cutting to a flat ground, which broke it.

**8 · Assets.** Code-built only. "Keep the world code-built under the existing
imagery rule. This is not authorization to switch the flagship to photoreal."
Zero kie.ai spend. The real DE logo, never a typed substitute.

## The audience leads

Joe, 2026-09-03: "whatever we create has to not distract from their profile
types and why they are here… it takes precedence over everything else
including design, it leads design." Small businesses: healthcare practices,
law firms, accounting and finance firms, real estate brokerages, nonprofits,
professional services, animal hospitals. They arrive because of an insurance
form, a message that almost worked, a rule they now have to meet, a vendor
nobody owns, or a renewal.

**Consequence for this revision:** the world never competes with the copy. It
is the ground the words stand on. Where they conflict, the words win.

## The feeling curve

| Act | Feeling | What on screen causes it |
|---|---|---|
| 1 · Unmanaged complexity | Recognition, faint unease | Points of light scattered off a grid that is visibly there but unmet. Nothing is joined. The camera drifts right to left; the world will not sit still. |
| 2 · Visible relationships | "Oh. That's my company." | The threads draw themselves between the lights, then the dependencies cross, then four amber rings mark what nobody owns. The camera rises and keeps arcing left. |
| 3 · Digerati direction | **The peak.** Release. | Every point snaps onto the grid, the gaps close, the amber goes out, magenta runs the identity chains, one boundary completes around all of it. The camera reverses and arcs back right — the first direction change, on the beat where the world corrects. |
| 4–9 · The evidence tail | Calm, level, credible | The corrected world holds and keeps arcing slowly right behind the copy, dimming as the evidence takes over. It never cuts to a flat ground and it never freezes. |

**The peak** is Act 3, and it holds the most scroll room. The sentence a
visitor would say: *"the whole thing straightened out while I was scrolling."*

**The tell-someone sentence:** "It's the site where the mess you recognise
straightens itself out while you scroll, and then tells you what to do about
it."

## Authored silence

Between the last thread landing in Act 2 and the correction beginning in Act
3 there is a held beat with no new element — the world simply sits wrong.
That is intentional, not dead scroll. The verification pass must not read it
as a defect.

## What revision 4 changes, and why

Joe's verdict on the visual, 2026-09-06, looking at the rendered world:
*"do you think that graphic / animation is the right one or it is defined and
built up enough? Did you do enough passes… because these things either work
or they absolutely don't."*

Honest answer recorded here: no. Three passes, all defect-driven, no art
pass, no post-processing, placeholder people. The result sat between
"deliberately abstract" and "rendered environment" and read as neither.

Three changes follow:

1. **Fully abstract.** No desks, no monitors, no capsule people, no walls, no
   floor plane. The world is light, line and plane only: points of light for
   people, thin lit quads for devices, glass planes for cloud, a line grid for
   the ground. Nothing that can read as a greybox model, because there are no
   boxes. It is also far cheaper to draw, which is what lets phones have it.
2. **The scroll changes direction.** The camera arcs laterally, and it
   reverses on the correction. Vertical scroll, lateral world movement.
3. **Everything flows.** The world lives behind the entire page, not just the
   pinned story. The evidence sections lose their solid grounds and hard rules;
   they sit on gradients over the world, which keeps drifting and dimming
   beneath them. No section cuts to flat.

And the consequence Joe has been waiting on: **phones get the world too.**
The abstract scene is light enough to run there, and because the world is
driven by page scroll rather than by a pin, the phone keeps its document flow
— the layout that fixed the blank-screen failure — while still getting the
motion.

## The speed rule

Joe, 2026-09-06, after revision 4's first build passed every static check:

> "okay one major rule if we are going to do this, you must always scroll at
> different speeds and test if it has any type of thing that looks off. right
> now you would have a red fail."

He was right, and the reason is structural: the release gate walks to a scroll
position and waits ~320 ms for everything to settle before it looks. Anything
that only goes wrong *while* the page is moving — copy caught mid-fade, the
world frozen because a frame never scheduled, two pictures of the same world
on screen at once — was invisible to it by construction.

`tools/motion.mjs` is that rule as a gate: four speeds (crawl, read, brisk,
fling) with a real wheel, across desktop and phone, sampled after a single
animation frame with no settle, failing on BLANK, FROZEN, STALE and FLASH, and
writing every frame so they can actually be looked at.

**It is a standing requirement, not a one-off.** No Scrollcraft change here
ships on the static gate alone.

### What the first speed pass found

All four were invisible to the static gate, and three of the four were only
visible by looking at the frames rather than by any assertion:

1. A heading, a CTA and a paragraph collided with the fixed header's button at
   full brightness, because the bar's scrim faded to nothing across its own
   height.
2. On phones, a bordered box holding a frozen frame of the world sat directly
   on top of the live world running behind it — the same world at two
   different moments, one of them in a box. The worst of the four.
3. The world competed with the copy through the evidence tail, which breaks
   the audience-leads rule this brief opens with.
4. The floating labels landed on the copy on phones and clipped under the
   header on both.

All four are fixed, both gates are green, and the frames are in `lab/motion/`.

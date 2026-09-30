# FLAGSHIP-PROTOTYPE-REPORT — Experience v1, Acts 1–3 and the first frame of Act 4 (Phase 5)

Built 2026-09-03 on Joe's "Build it": one persistent, code-built visual world
behind the passage's own typography, under the existing imagery rule, with
zero generated assets. Build: `scrollcraft/builds/experience-v1/`. Review:
the lab copy at `/scrollcraft/experience-v1/` once merged, and the single-file
artifact published from this session.

## What was built

- **The world** (`scene.js`, 28 KB): a small business at first light, drawn in
  code with three.js. A floor with a slight sheen, two rows of three desks
  with lit screens (a gradient interface texture, no logos), keyboards,
  phones, chairs, a meeting table with four chairs, a window wall with dawn
  light, a network closet with a switch, a ceiling access point, four people
  as luminous presence (shoulders and a head, no faces), three glass cloud
  slabs overhead, a vault beneath the floor, a horizon beyond the far wall.
  A procedural room environment gives every surface something to reflect.
  Every object's position, material, colour and connection is a pure function
  of one timeline value t ∈ [0, 4), so the four acts are states of one world.
- **The states.** `disorder` (1 → 0 during the correction) places every desk,
  slab and the access point off the grid by seeded offsets and stops every
  thread short of its target; the camera rolls 2° (1.4° in portrait). `reveal`
  turns the room to dark glass and draws relationships in the storyboard's
  order (identity → device → email → data → network → applications →
  customers), then dashed dependencies, vendor tags, partial boundary loops,
  and four amber exception markers (backup untested, unpatched, shared
  mailbox, guest network open). The correction closes the gaps, completes the
  boundaries, dissolves the exceptions, thins the dependencies, runs magenta
  light along the identity chains (DE entering) and completes a magenta
  perimeter: the boundary DE is responsible for. The heading readout goes
  348° → 360°.
- **The glue** (`experience.js`, 8 KB): the Scrollcraft engine pins four acts
  and cues the type; the glue maps scroll to one continuous timeline (inside a
  pin, p → [i, i+0.85]; the seam between stages → [i+0.85, i+1]) so the world
  keeps moving while one stage slides out and the next slides in. DOM labels
  are projected from 3D anchors every frame. A frame counter feeds this
  report.
- **Fallbacks.** Five stills rendered *from the world* by the build's own
  script (`tools/render-stills.mjs`, WebP, 13–56 KB each) carry the first
  paint, the no-WebGL path, low-power devices, and reduced motion (stepped by
  t, no interpolation; the copy reads in full).
- **Copy.** Every line is from the canonical spine or #186: "Everything is
  here." / "It all works. Just not as one." / "Identity. Devices. Email. Data.
  Network. Applications. Customers." / "Nobody is steering the whole thing." /
  "This environment isn't broken. It's been drifting." / "We do not promise
  outcomes before we understand the environment." / "You lead the business. We
  lead the technology." / "DE sees the whole environment."

## Rendering strategy and why

| Option | Verdict |
| --- | --- |
| DOM + CSS layers | Cannot do a real camera, real depth or light; would have been parallax plates, which is the failure being replaced. |
| SVG | Fine for the evidence layer; a 2.5D isometric world in SVG would read as an illustration, and the correction needs true rotation and lighting. |
| Canvas 2D | Possible but every lighting and depth cue is hand-built. |
| **WebGL via three.js, hybrid with DOM type** | Chosen. A real camera, lights, materials and depth; the DOM keeps the type crisp and accessible; the engine keeps scroll native. |
| React Three Fiber | Not needed: the build is a static Scrollcraft page, no React. |

## Measurements (this environment)

| Item | Value |
| --- | --- |
| First paint payload (HTML, CSS, engine, glue, fonts) | 14 + 20 + 56 + 8 + 85 KB raw; ≈ 32 KB gzip + 85 KB fonts |
| WebGL library (vendored, lazy after first paint) | three.module 366 KB + three.core 385 KB raw; 87 + 101 KB gzip |
| World code | scene.js 28 KB raw, 9 KB gzip; no textures except a 128×80 canvas gradient |
| Stills (fallback / poster) | 13, 50, 49, 56, 52 KB WebP |
| Page load → world live (headless, local server, software GL) | 1440×900: 2.7 s · 768×1024: 0.8 s · 390×844: 1.0 s · 2560×1440: 5.2 s |
| Frame cost (update + render, SwiftShader software GL) | 5–13 ms per frame across the four viewports |
| Horizontal overflow | 0 px at all four viewports |
| Console errors | none (one deprecation warning fixed) |
| Reduced motion | stills path at 1440 and 390: poster index follows t (0, 1, 2, 3, 4), no canvas, no errors |
| Single-file artifact | 1.08 MB (bundled scene + three.js 580 KB, fonts and stills inline); renders live, fonts load, no failed requests |

**Frame-time caveat.** SwiftShader is a software rasterizer; the headless
numbers are an upper bound on CPU cost and say nothing about a real GPU. On a
laptop GPU this scene (about 120 draw calls, ~20 k triangles, one shadow map on
desktop, no post-processing) is comfortably a 60 fps scene; on a mid phone the
pixel ratio is capped at 1.25 and shadows are off. **Real hardware has not
been measured.** That, and a real phone's touch scrolling, are the two manual
gates.

## Mobile behaviour

Portrait framing is its own composition: the camera sits further back and
higher so the floor fits, the look-at rises so the copy owns the lower third,
the tilt is 1.4°, three labels and two exceptions are hidden, the primary
control reads "Start here". Verified at 390×844 and 768×1024 by emulation.

## Compromises and risks

1. **Craft is geometry-level, not surface-level.** Desks, chairs and screens
   are boxes with good materials and light. They read as a place at the
   elevated views (Acts 2–4) and as furniture at the eye-level opening. The
   opening is the least premium frame; it needs a better foreground (a
   plant, a bag, a coat: presence without people) and softer shadows.
2. **The seam mapping** keeps the world moving between pinned stages, but the
   type still changes by stage. The type is the only thing that "cuts".
3. **Labels** are DOM projected from 3D; at some scroll positions a label
   sits under the copy. They are hidden when they would leave the frame,
   not when they collide with type.
4. **No real-device measurement** (frame rate, thermal, iOS toolbar).
5. **The library is 190 KB gzip after first paint.** Acceptable for a
   flagship; not for every page.
6. **Static-site only.** This is a Scrollcraft build, not a React route;
   mounting it on `/` is Phase 7 work and a different engineering job.

## Quality Gate A

Joe's primary question: *does it feel like I entered one world, and my
scrolling caused that same world to reveal complexity, expose that it was
off-course, correct itself, and begin becoming an intelligible managed
system? If it feels like sections, slides, diagrams or successive
compositions, even attractive ones, it fails.*

**Honest answer: yes on the mechanism, with one weak act.** The same desks,
slabs, people and threads are on screen from the first frame to the last;
the reveal draws relationships onto objects the visitor already saw; the
drift is the same objects off the grid; the correction moves those objects,
nothing is swapped; DE arrives as light on existing threads. Nothing in the
sequence is a card, a plate, or a diagram introduced for a beat. The weak
act is the opening: at eye level the world is furniture in a dark room and
the "disconnected" state reads mostly through the copy and a few stopped
threads; the sense of wrongness only becomes visceral once the camera rises.

The seven questions:

| Question | Answer |
| --- | --- |
| Materially different from a modern SaaS template? | Yes. A lit place with a camera, not a grid. |
| Communicates DE without paragraphs? | Acts 2–4 yes: the reveal, the drift, the correction and the magenta boundary carry it. Act 1 leans on its two lines. |
| Is the motion teaching something? | Yes: every move is a state change of an existing object with a meaning (revealed, off, corrected, held). |
| Depth in the composition? | Yes: real perspective, foreground figures, slabs above, vault below, horizon beyond. |
| Premium? | Partly. Materials and light yes; the furniture geometry is simple and the opening frame is not yet rich enough. |
| Original? | Yes for the category. |
| Old design obviously inferior beside it? | Yes for Acts 2–4 beside any diagram section; the opening frame does not yet win on its own. |

Two partials out of seven, both in Act 1's opening frame, both fixable inside
the same world without any new asset: a richer foreground, softer shadows, a
slower first dolly, and a visible "almost meets" moment (two threads reaching
and stopping) in the first viewport. Recommendation: **fix the opening frame
before expanding**, then extend to Acts 4–10 as further states of this world.

## What this proves and what it does not

Proved: one code-built world can carry the storyboard's grammar (states, not
scenes) in real time on a static page with native scroll, with stills as an
honest fallback and zero generated material. Not proved: real-device
performance; the opening frame's premium quality; the later acts (the eight
blocks emerging, the capabilities, the route, the assessment door) which are
designed but not built.

## Stop conditions checked

None hit. Scrollcraft achieves the effect cleanly; the concept is not
expensive (no post-processing, no textures); the asset plan is defined (all
code); the build did not regress into template sections; no kie.ai use was
proposed; performance did not collapse in the software renderer; and the
improvement over the current direction is real for Acts 2–4.

Money gate closed, PR #184 draft, Version 4 parked, 14 domains unresolved,
`HTTPS_PROXY` parked: all unchanged.

---

## Revision 2 · 2026-09-03 · Joe's verdict and the surgery

Joe reviewed the published page (`/experience-v1`) in live Chrome and scored
it: concept and storytelling 7/10, copy and positioning 8/10, visual finish
4/10, usability and conversion 3/10, production readiness 2/10. "Do not
promote this as a finished customer experience yet." His instruction: fix
usability before adding any scene, cut the journey by 35–50 %, lead with the
positioning, make the assessment the unmistakable conclusion, finish the
artwork or lean deliberately abstract, and do not build the rest of Act 4
until a buyer can answer three questions in fifteen seconds. "The right next
move is conversion and accessibility surgery, not more cinematic polish."
This revision is that surgery, nothing else.

### What he found, what caused it, what changed

| Joe's finding | Cause in revision 1 | Revision 2 |
| --- | --- | --- |
| Blank dark screens at normal scroll positions, on desktop and mobile | Four pinned stages; copy faded in and out inside cue windows, and the seam where one stage slid out and the next slid in had no copy at all; on phones the copy was also under the scene | **One pinned act, three movements.** Movement windows are hard-edged (cue ramps of 0 at the boundaries), so every scroll position shows exactly one movement at full strength; lines inside a movement accumulate and hold to its end. The gate below stops every 10 % of a viewport from the first pixel to the last and fails on any stop without readable copy. |
| Mobile substantially worse, "an unfinished animation timeline" | Desktop pinning squeezed into a phone | **Flow mode** at ≤ 767 px, under reduced motion, and without JavaScript: the same markup reads as a document, copy then a still rendered from the world (portrait stills for phones), no pinning, nothing hidden. The world and its library are never loaded there. |
| Keyboard focus lands on controls far outside the viewport | Hidden copy stayed focusable | Movements that are not on screen are **inert**; if focus reaches one anyway, its movement is brought on screen. A skip link goes straight to the assessment. The gate tabs through the page and fails on any focus outside the viewport. |
| The opening is vague; the strongest line arrives too late | "Everything is here" led; the drift line was in Act 3 | **Screen one is the thesis:** "Your environment isn't broken. It's been drifting." with the mapping dek Joe wrote and one primary control, "Start with a Cyber Risk Assessment". The credible triggers he liked follow within a quarter of a viewport of scroll. |
| Artwork reads as greybox previs; telemetry adds atmosphere, not understanding | Furniture-level geometry in low light; a heading readout, a time stamp, decorative labels | **Leaned deliberately abstract:** chairs, keyboards, phones and the door frame removed; a desk is a plinth with a lit screen; exposure, materials and light raised (floor and desks now read as surfaces, not holes). The heading readout, the time stamp and "the heading is wrong" are gone. The remaining labels name what DE maps (identity, devices, email, data and backups, network, applications, customers, vendors) and what it finds (backup untested, unpatched, shared mailbox, guest network open), on plates, never under the copy. |
| Eight viewport-heights before the decision point | Four pins, ≈ 7.4 vh, plus the close | One pin of 4 vh; the page is ≈ 5.0–5.4 vh; the decision section starts at ≈ 4.1–4.7 vh; the first assessment control is at 0 vh. |
| The ending contradicts its own advice | Three equal doors plus a header action plus a lab link | "Start by understanding what you have." with **one dominant assessment button**; three quiet secondary paths beneath it; the header control is a small outline; the lab link is gone. |
| Publicly admits it is unfinished | "This is where the prototype stops" in the story | The story no longer narrates its own edge. A one-line footer states the page is a review prototype, because it still is and it stays `noindex`. |

Not done, by Joe's instruction: no scene after the first frame of Act 4.

### The fifteen-second test (screen one, before any scroll)

| Question | Where it is answered |
| --- | --- |
| What does Digerati Experts do? | The dek: maps the people, devices, cloud services, vendors and risks behind the business, then gives every part an owner, a boundary and a direction. |
| Why might I need it? | The H1 (drift, not breakage) and, a quarter-viewport later, the reasons people come: an insurance form, a message that almost worked, a rule, a vendor nobody owns, a renewal. |
| What should I do next? | "Start with a Cyber Risk Assessment", the one filled control on the screen, repeated as the page's only conclusion. |

Whether a practice manager, a firm partner or a broker actually answers all
three in fifteen seconds is Joe's call to make with real people; the page now
puts the answers on the first screen instead of at the end.

### The release gate

`tools/gate.mjs` runs the build at 1440×900, 768×1024, 390×844 and 360×800,
plus 1440×900 and 390×844 under reduced motion, and fails on: any scroll stop
(every 10 % of a viewport, first to last pixel) without readable copy; any
keyboard focus outside the viewport or on an inert control; horizontal
overflow; a first screen without the thesis H1 and a visible, tappable
assessment control; flow mode that still pins, hides copy or lacks its
stills; missing landmarks or more than one h1; console errors; and a
contrast proxy under 4.5:1 for copy over the world (the text colour against
the darker fifth of the pixels behind the line). It writes screenshots and
`report.json` under `lab/gate/` (gitignored).

Run of 2026-09-03 (headless Chromium, software GL):

| Run | Mode | Page | Decision point | Stops | Focus stops | Contrast proxy | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1440×900 | pin, world live 3.1 s | 5.03 vh | 4.37 vh | 42 | 9 | ≥ 9.2 | pass |
| 768×1024 | pin, world live 1.0 s | 4.92 vh | 4.30 vh | 41 | 9 | ≥ 9.1 | pass |
| 390×844 | flow | 5.12 vh | 4.05 vh | 43 | 9 | n/a | pass |
| 360×800 | flow | 5.36 vh | 4.24 vh | 45 | 9 | n/a | pass |
| 1440×900 reduced motion | flow | 5.36 vh | 4.69 vh | 45 | 9 | n/a | pass |
| 390×844 reduced motion | flow | 5.12 vh | 4.05 vh | 43 | 9 | n/a | pass |

The gate earned its keep during the surgery itself: its first run caught a
cascade bug of mine (a flow-mode rule un-pinned the stage on wide screens)
as 24 blank stops per pinned run, and a skip link that stayed off screen
under keyboard focus. Both are fixed and re-run.

**Still manual, still open:** Safari and WebKit (not installed here), a real
GPU's frame rate, a real phone's touch scrolling, and the booking flow beyond
the link. The assessment control targets `/book`, the site's Cyber Risk
Assessment booking page; that page is the site's, not this build's.

### Status after revision 2

Quality Gate A stands as answered above for the mechanism. Joe's scores are
the current record; this revision is the response to the two lowest
(usability 3, readiness 2) and to the artwork verdict, and it asks him to
re-score the published page rather than claiming numbers of its own. The
page stays `noindex, nofollow`.

### Revision 3 · 2026-09-03 · the rest of the plan, shown with the site

Joe: "finish the rest of the plan and show it all together with the entire
upgraded site … show me it with the site is what I meant, not all by itself."

- **Acts 5–10 and the final frame** now follow the three-movement story on
  the page, as the evidence layer under the story: the eight blocks (seven
  parts of the environment and Risk & Exposure as the continuous eighth),
  the operating cadence (assess → understand → design → stabilize → secure →
  operate → improve), the customer in command, the assessment (what is
  inspected, what you receive, what happens next, one dominant control),
  the three ways in with the canonical service names, the refusals, and the
  final frame: the same world, level, held behind the last screen (a still
  in flow mode).
- **Shown with the site.** `/experience` is a React route that wraps the
  same static build in the site's own MegaMenu and footer: it fetches the
  build's HTML, keeps the story, drops the build's bar and footer, rewrites
  asset paths and loads the engine and the glue exactly as the standalone
  page does. `/experience-v1` now forwards there; the standalone page stays
  at `/scrollcraft/experience-v1/`. Both are `noindex`; the homepage is
  untouched.
- **Not upgraded:** every other page of the site is as it was. This revision
  adds one review route and changes one redirect.

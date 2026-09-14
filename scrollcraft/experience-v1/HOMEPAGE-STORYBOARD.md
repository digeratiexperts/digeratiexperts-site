# HOMEPAGE-STORYBOARD — the DE flagship, one world in ten states (Phase 3, v2)

Version 2, 2026-09-03. The spine is canonical and was written by Joe with his
advisor ("I write the canonical storyboard. Claude/Scrollcraft implements
it."). Everything in the left column of each act is theirs; the technical
attributes are the implementation plan. Version 1 (a living-business →
threat → response arc from the Sept 2 plan) is superseded; its event beat
survives as an optional moment inside Act 5.

Governing principle before all others (Joe, 2026-09-03): **the audience leads
design.** DE's visitors are small businesses (healthcare practices, law
firms, accounting and finance firms, real estate brokerages, nonprofits,
professional services firms, animal hospitals) who came for a reason (an
insurance form, a message that almost worked, a rule to meet, a vendor
nobody owns, a renewal, a package to compare). Nothing in any act may
distract from who they are and why they are here. Act 1 names both before
anything else; the close names the businesses DE serves; the real DE logo is
the mark.

Second principle: **prefer transformation over replacement.** Acts 1–10 are
states of the same visual system. The opening fragments become the
architecture; the architecture becomes the security model; the security model
becomes the operating environment; the environment becomes the assessment; the
assessment opens into the three customer paths. This storyboard needs fewer
generated assets than the current build, not more: it needs none.

## The world, once

One environment, built in code, that every act reuses (asset bible W01–W14):
a small business at first light. An open floor, two rows of three desks with
screens and phones, a meeting table, a front door at the near end, a window
wall, a network closet, a ceiling access point. Four people as soft luminous
presence. Three glass slabs above the floor (email and collaboration, files
and applications, the line-of-business system). A translucent vault beneath
it. A dim horizon beyond the far wall: the outside. Hair-thin threads for
every relationship. The camera is a real camera. Light carries the state.

Persistent instrument (from #186, reworked): a heading readout, 348° until
the correction, 360° after, and a course line. Persistent control: **Understand
your environment →** (the assessment).

## Scroll and technical foundation

| Concern | Decision |
| --- | --- |
| Engine | The Scrollcraft engine, copied verbatim. Story acts are `pin` acts that publish `--sc-p`; a global timeline is derived from the live act, so the world is one continuous animation. |
| Stage | One fixed full-viewport WebGL canvas (three.js, vendored, lazy-loaded after first paint) behind the DOM, rendered only while a story act is live. The DOM never renders the world; the world never renders text. |
| Fallbacks | Stills rendered from the world by the build's own script stand in before the library loads, without WebGL, and under reduced motion (no interpolation; the copy reads in full). |
| Evidence layer | DOM, the diagram system, sanitized product captures; a quiet footnote for any illustration disclosure. |
| Budget | First paint under 150 KB; the library ≈ 190 KB gzip after paint; no textures over 200 KB; stills ≤ 60 KB; 60 fps desktop, 30+ on a mid phone with pixel ratio capped at 1.5; no layout shift; no scroll capture. |
| Accessibility | Semantic headings per act; the copy carries the meaning; the stage is `aria-hidden`; stills carry alt text. |

**Flagship prototype boundary (Phase 5): Acts 1, 2, 3 and the first frame of
Act 4.** Nothing beyond is built until Quality Gate A passes.

---

## ACT 1 — IT isn't broken. It's disconnected.

| Attribute | |
| --- | --- |
| **Purpose** | Open inside the customer's business, not with DE. Everything exists: people, computers, cloud, email, phones, files, security, network, vendors, applications. They behave like separate pieces. |
| **Main message** | Your business doesn't have an IT problem because it lacks technology. It has one when the pieces stop working as one. |
| **Visual composition** | Eye height just inside the door, dawn light raking across the desks. One persistent environment, subtly wrong: desks and slabs each slightly off the grid, connections that almost meet and stop short, the access point off-centre, the whole world 1.2° off true from the first frame. Screens on; people present; one walks in and sits. Copy in the quiet ground on the right. |
| **Scroll behavior** | Pinned, span 1.6 vh. The visitor scrolls *deeper into the problem*: a slow dolly down the aisle, not a cut to another section. |
| **Motion behavior** | Screens flicker on; the walker crosses and sits; phones glow briefly; the disorder is static (nothing jitters), only the camera moves. |
| **Required assets** | W01–W05, W09 (slabs present from the first frame, misaligned). Code. |
| **Text required** | "7:40 · Tuesday · a practice, a firm, an office like yours" · "Everything is here." · "People, computers, email, cloud, phones, files, network, vendors." · "It all works. Just not as one." · "Which is usually why you're here: an insurance form with hard questions, a message that almost worked, a rule you now have to meet, a vendor nobody owns, or a renewal you're not sure about." |
| **Technical approach** | Per-object disorder offsets (deterministic, seeded) applied at `disorder = 1`; camera roll of −1.2° via the camera up-vector; threads pre-built with gap fractions. |
| **Mobile adaptation** | Camera further back and higher so the floor fits portrait; copy in the lower third; the dolly becomes a gentle rise. |
| **Exit transition** | The camera begins to rise; the floor starts to turn to glass. |

## ACT 2 — Complexity becomes visible

| Attribute | |
| --- | --- |
| **Purpose** | Don't replace the environment: reveal what's already underneath it. |
| **Main message** | The problem isn't another product. Nobody is deliberately steering the whole technology environment. "Oh. That's my company." |
| **Visual composition** | Elevated three-quarter view; floor and walls become dark glass. Relationships draw in order: identity → device → email → data → network → application → customer. Then dependencies (dashed crossings), vendors (dim tags at the slabs and the closet), security boundaries (partial outlines around clusters), exceptions (hollow amber markers: backup untested, unpatched, shared mailbox, guest network open). Denser without chaos. |
| **Scroll behavior** | Pinned, span 2.0 vh. Five sub-stages at p 0.02–0.42, 0.38–0.56, 0.5–0.62, 0.58–0.82, 0.74–0.96. |
| **Motion behavior** | Threads draw with a travelling head and stop short (the gaps are the point); labels fade at the moment their layer completes; nothing slides. |
| **Required assets** | W06–W11, W12 (misalignment and exceptions). Code. |
| **Text required** | "Identity. Devices. Email. Data. Network. Applications. Customers." (words landing with the layers) · "Then dependencies. Vendors. Boundaries. Exceptions." · "Oh. That's my company." · "Nobody is steering the whole thing." |
| **Technical approach** | Tube threads with draw ranges; dashed lines for dependencies; line loops with draw ranges for boundaries; fresnel torus markers; DOM labels projected from 3D anchors. |
| **Mobile adaptation** | Four labels instead of seven; two exceptions instead of four; slabs closer to the floor. |
| **Exit transition** | The camera settles; the heading readout becomes legible: 348°. |

## ACT 3 — The heading is wrong

| Attribute | |
| --- | --- |
| **Purpose** | The strongest concept from #186: the environment has been slightly off-course. Not broken. Drifting. Then the operating principle, and the same world straightens. DE enters as the navigator, not as a hero replacing the customer. |
| **Main message** | We do not promise outcomes before we understand the environment. → You lead the business. We lead the technology. |
| **Visual composition** | The misalignment made perceptible: the readout, the off-grid objects, the gaps. The principle lands in clean light (the paper chapter of #186 becomes a light state, not a plate). The world rolls level over 900 ms; desks, slabs and the access point ease onto the grid; gaps close; boundaries complete; exceptions recede; dependencies thin to hierarchy; the identity spine brightens. DE enters as magenta light running the identity chains, then settles; a magenta hairline completes around the perimeter: the boundary DE is responsible for. |
| **Scroll behavior** | Pinned, span 2.4 vh (the peak). p 0–0.35 the drift is named; 0.35–0.45 the principle; 0.45–0.9 the correction; 0.9–1 the payoff line. |
| **Motion behavior** | Exactly #186's move, applied to the world: tilt → level, 348° → 360°. Everything that moves is an object that already existed, moving to where it belongs. |
| **Required assets** | W13 (the correction and DE light). Code. |
| **Text required** | "This environment isn't broken. It's been drifting." · blockquote: "We do not promise outcomes before we understand the environment." · "You lead the business. We lead the technology." · readout 348° → 360°. |
| **Technical approach** | `disorder` 1 → 0 over the correction window drives placement, gaps, boundaries, exceptions and the camera roll together; DE light as emissive colour and travelling heads on the identity threads; the perimeter loop draws last. |
| **Mobile adaptation** | Tilt 0.8°; the same window; the blockquote in the upper third. |
| **Exit transition** | Calm. The camera eases slightly closer: DE is looking. |

## ACT 4 — DE sees the whole environment

| Attribute | |
| --- | --- |
| **Purpose** | The relationships reorganize into something intelligible: a managed system. People remain people, devices devices, cloud cloud, network network; now the visitor understands how they relate. |
| **Main message** | Assessment → understand → design → stabilize → secure → operate → improve. The environment itself passes through those states. |
| **Visual composition** | The aligned world, held. Assessment illuminates it (a scan of light across the floor). Discovery maps it (every relationship briefly labelled, then the labels collapse into hierarchy). Stabilization removes the last jitter. Security establishes boundaries (the cluster outlines firm). Operations create rhythm (the access point breathes, the switch pulses). Improvement adds forward movement (the horizon brightens). Captions, not a list. |
| **Scroll behavior** | Pinned, span 2.2 vh; seven states at even intervals. |
| **Motion behavior** | Light and line states only. |
| **Required assets** | W01–W14 states; stills S07–S13 rendered from them. |
| **Text required** | The seven words as captions; "Your environment becoming manageable." |
| **Technical approach** | A `stage` dial in the world: scan plane, label collapse, breathing rates, boundary weights. |
| **Mobile adaptation** | Same states; captions at the bottom. |
| **Exit transition** | The boundaries begin to thicken into structures. |

## ACT 5 — Security emerges from the environment

| Attribute | |
| --- | --- |
| **Purpose** | The eight-block architecture emerges from the system already built; never a sudden eight-item diagram. |
| **Main message** | Eight blocks. One of them never stops. |
| **Visual composition** | Identity relationships gather into **Identity & Access**; endpoints into **Endpoint**; communication surfaces into **Email & Collaboration**; browsing exposes **Browser & Web**; infrastructure becomes **Network**; signals across everything converge into **Detection & Response**; people and behaviour expose **Human Risk**. **Risk & Exposure** does not become a box: it materializes under and through the whole floor as the continuous intelligence layer. Seven structures, one layer that never stops looking. *Optional event (from the Sept 2 plan, brief, Joe's call): as Detection & Response converges, one signal on one endpoint is caught and contained, so the block is seen working before it is named.* |
| **Scroll behavior** | Pinned, span 2.6 vh; eight beats. |
| **Motion behavior** | Gathering: each block's structure forms from its own parts of the environment (threads bundle, outlines firm, a name lands); the layer beneath rises as light through the glass floor. |
| **Required assets** | W14 (structures and the continuous layer). Code. Names from `docs/DE-SERVICE-MODEL-2026.md`. |
| **Text required** | The eight names; "Eight blocks. One of them never stops." |
| **Technical approach** | Bundling by lerping thread endpoints toward block anchors; the layer as a floor-wide fresnel plane. |
| **Mobile adaptation** | The names land one per viewport-third; the layer reads as a band under the floor. |
| **Exit transition** | The protected foundation lifts the slabs: capabilities. |

## ACT 6 — Technology becomes a business operating system

| Attribute | |
| --- | --- |
| **Purpose** | DE is bigger than a cybersecurity company; the protected foundation unlocks what the business needs. |
| **Main message** | One technology environment. Designed around the business it serves. |
| **Visual composition** | The protected environment expands: workplace, communications, network, data, cloud, business systems, automation, support, security, governance, continuity appear as the same slabs and threads carrying work: people actually doing things. Platforms (Microsoft, Google, Zoho) appear only as the customer's choices, as plain words at the slabs; DE's internal vendor stack stays invisible. Not the twelve lanes on screen. |
| **Scroll behavior** | Pinned, span 1.8 vh. |
| **Motion behavior** | Growth and flow: threads carry light in both directions; the world is busy and calm. |
| **Required assets** | Code. |
| **Text required** | "One technology environment. Designed around the business it serves." plus the platform words. |
| **Technical approach** | Flow animation on existing threads; slab labels as DOM. |
| **Mobile adaptation** | Fewer flows; the line alone. |
| **Exit transition** | The threads gather into a route. |

## ACT 7 — The customer remains in command

| Attribute | |
| --- | --- |
| **Purpose** | The DE relationship, explicit: destination from the customer, route from DE, decisions together. |
| **Main message** | Customer chooses destination. DE determines the safe, effective route. Major decisions happen together. |
| **Visual composition** | Navigation without a ship, wheel or compass: a destination point placed by the customer beyond the environment; possible paths appear; constraints and risk appear on them; a bad route is rejected (it dims and closes), a dangerous shortcut closes, a prerequisite appears before another path opens. DE's job is not to say yes. |
| **Scroll behavior** | Pinned, span 2.0 vh. |
| **Motion behavior** | Path drawing, closing and opening; the heading readout stays 360°. |
| **Required assets** | Code. |
| **Text required** | "You set the destination." · "We map the route." · "A bad route closes. A prerequisite opens the next one." · "We take responsibility for the work entrusted to us." |
| **Technical approach** | Route threads with state; DOM captions. |
| **Mobile adaptation** | Three routes instead of five. |
| **Exit transition** | Everything contracts toward one point. |

## ACT 8 — So where do we start?

| Attribute | |
| --- | --- |
| **Purpose** | Everything converges on Assessment; behind it the three paths. Not four buttons, not pricing, not products. |
| **Main message** | Start by understanding what you have. Assess → then choose the relationship. |
| **Visual composition** | The environment resolves into a single point of light: the assessment doorway opens; behind it the three paths emerge in hierarchy: Handle Our IT (ProActive + Co-Managed) · Solve a Business Need (Standalone) · Client Marketplace (existing-client expansion). |
| **Scroll behavior** | Pinned, span 1.6 vh. |
| **Motion behavior** | Contraction, then a single opening. |
| **Required assets** | Code. |
| **Text required** | "Start by understanding what you have." · the three path names with one line each; the assessment terms per pathway from `docs/DE-SERVICE-MODEL-2026.md` in the evidence layer. |
| **Technical approach** | World contraction; DOM door and paths (real links). |
| **Mobile adaptation** | Door, then the three paths stacked. |
| **Exit transition** | The environment forks. |

## ACT 9 — Three paths. Same DE standard.

| Attribute | |
| --- | --- |
| **Purpose** | The same environment forks into three operating arrangements; why standalone costs differently and does not inherit managed coverage. |
| **Main message** | Same DE expertise. Different responsibility boundary. |
| **Visual composition** | Three copies of the world, side by side or in sequence: DE responsible for the broader ecosystem (the whole boundary lit); a bounded portion (one cluster lit, the rest plain); an already-understood environment adding capabilities (the boundary lit, a slab added). |
| **Scroll behavior** | Pinned on desktop (span 1.8 vh), three beats; flow on mobile. |
| **Motion behavior** | Boundary lighting only. |
| **Required assets** | Code; stills S14–S16. |
| **Text required** | Three arrangement names and one boundary sentence each. |
| **Technical approach** | The world rendered three times at small scale, or three stills. |
| **Mobile adaptation** | Three stills, swipeable. |
| **Exit transition** | The visual system strips back. |

## ACT 10 — The proof is what we'll refuse to do

| Attribute | |
| --- | --- |
| **Purpose** | After all that transformation, an extraordinarily simple ending: DE publishes its boundaries as evidence of responsibility. |
| **Main message** | That isn't fine print. That's evidence that DE intends to take responsibility for its work. |
| **Visual composition** | The aligned environment, held still and quiet; the refusals in the same type as the promises (from #186, unchanged): we may tell you no · we may require prerequisites · one covered employee is not unlimited devices · a standalone project doesn't secretly include an MSP · we aren't your HR or finance department · we won't claim responsibility for an outcome while prevented from implementing what it requires. |
| **Scroll behavior** | Pinned, span 1.6 vh, the closing column travelling under the pin exactly as fixed in `9439416`. |
| **Motion behavior** | None but the copy. |
| **Required assets** | None. |
| **Text required** | The refusals as published. |
| **Technical approach** | #186's closing act, on the world. |
| **Mobile adaptation** | As `9439416`. |
| **Exit transition** | The camera returns to the door. |

## FINAL FRAME

| Attribute | |
| --- | --- |
| **Purpose** | Return to the opening world. Same people, same devices, same business. Nothing magical appeared: now everything has a place, a relationship, a boundary and a direction. |
| **Main message** | You lead the business. We lead the technology. → Understand your environment. |
| **Visual composition** | Act 1's camera, Act 3's alignment, dawn light; the course reads 360°. |
| **Scroll behavior** | Hold; the page ends here with the primary control. |
| **Required assets** | None. |
| **Text required** | "You lead the business." / "We lead the technology." · "Understand your environment →". |
| **Mobile adaptation** | Same. |

## STOP GATE 3

The storyboard exists for all ten acts and the final frame with every required
attribute, and every act is a state of one world. Implementation of anything
beyond the flagship boundary (Acts 1–3 and the first frame of Act 4) waits for
Quality Gate A.

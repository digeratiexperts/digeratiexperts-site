# Version 4 homepage: source of truth

Written 2026-09-29. One design. Preview only at `/version-4`. Production `/` stays the live homepage until Joe approves a replacement.

This file is the design record. The page in `client/src/pages/versions/v4/` has to match it. A later review that contradicts this file is a bug in the page or a revision of this file, not a second design.

## 1. What worked in every previous attempt

- **Live homepage and version 1.** A real company speaking in plain language. The assessment is the next step. Sourced industry facts stay labeled as industry facts. The phone number, the bill of rights, the guarantee, and the trust center are real pages. Arizona is the place the company serves.
- **Version 2 and `scrollcraft/builds/de-v2`.** Motion can mean a change of state. The visitor can feel an environment wake up. A long film can carry a story. It cannot be the front door.
- **Version 3.** One diagram language is stronger than a new illustration per section. The correction from "six layers" to the eight cybersecurity blocks belongs in the public story.
- **Homepage challenger and the three doors.** The ways in are Handle Our IT, Solve a Business Need, and Client Marketplace. The marketplace is for an existing client, not a fourth product beside the others. Assessment sits above those doors.
- **Why DE (PR #186).** The strongest lesson: the environment begins subtly misaligned and becomes aligned. A heading can move from 348° to 360° as a restrained instrument.
- **Experience v1 (PR #200).** Prefer transformation over replacement. The same environment should evolve. Risk & Exposure is the continuous layer under the other seven blocks, not an eighth identical card. The assessment is the door.
- **Directions (PR #230).** Three layers of one system, not three competing looks. Calm engineered confidence is the visual base. Precision product company is the information layer. Bright cinematic story is the motion layer. Magenta is the accent this preview uses.
- **Approved visual rhythm (August 2026).** Type and a small icon carry the homepage. Clip-art sculptures and decorative blobs do not. Industries and proof must be readable without a hover.

## 2. What failed in every previous attempt

- **Live homepage and version 1.** Sections stack. Each one introduces another card grid. The page explains many things and does not show one environment changing. The old "six domains" wording drifted from the 2026 eight-block model.
- **Version 2.** Too long for the front door. Chaptered editorial, a margin map, and a film length made a story page, not a homepage.
- **Version 3.** Diagrams helped, then the page became a diagram system. Joe retired it from `/` the next day.
- **Challenger.** The three doors were right and were still bolted onto the stacked homepage.
- **Why DE.** The alignment idea was right. A sideways card rail and a passage length were not a homepage.
- **Experience v1.** The world was right. Heavy WebGL, a film runtime, and a page that asks the visitor to fly through a room were not the lightest way to deliver it, and it was not approved as `/`.
- **Directions.** Useful as a system. Copying any one of the three frames as a whole page, or showing all three as competing layouts, splits the company into three brands.
- **The seam preview on this branch (`scrollcraft/builds/homepage-v4`).** A comparison can be a product. It is not this Version 4. It does not carry the alignment story, the eight blocks, or the three doors. It stays a lab page. It is not `/version-4`.
- **The first React draft in `versions/v4` (uncommitted, replaced by this page).** It restyled the stacked homepage and reused old sections. That is the box this redesign leaves.

## 3. What V4 intentionally keeps

- The sentence: "You lead the business. We lead the technology."
- Cybersecurity-first managed technology, with the customer in command.
- Assessment before any pathway. The primary action is Understand Your Environment, and it opens the existing booking route `/book`.
- The three pathways, with assessment above them: Handle Our IT (ProActive and Co-Managed), Solve a Business Need (standalone), Client Marketplace (existing-client expansion at `/portal/marketplace`).
- The eight blocks, in canonical order, with Risk & Exposure as the continuous layer.
- A vendor-neutral operating system on the public page.
- Outcomes as capabilities: protect, work better, communicate, automate, comply, recover, grow.
- One proof chapter: Client Bill of Rights, the published guarantee, Trust Center, the team page, and the refusals below.
- Package names only (IT, Office, Business, Enterprise) plus a link to the pricing page. No prices on this page.
- The phone from `PRIMARY_PHONE`.
- Graphite `#050312`, paper `#F7F5F2`, magenta `#D3126A`.
- The real logo from `brand/`.
- Native document scroll. `noindex`. Absent from normal navigation. `/` untouched.

## 4. What V4 intentionally rejects

- Replacing `/`.
- Assembling `DigeratiStatsSection`, `DigeratiPricingSection`, `DigeratiTestimonialsSection`, `DigeratiHowWeProtectSection`, or the other live homepage sections.
- Full-page scroll snapping, scroll-jacking, dead scroll, and blank pinned ranges.
- WebGL. The signature is SVG and CSS.
- Rotating the document, or any motion that creates horizontal overflow.
- A second visual world per section.
- Invented testimonials, client logos, counters, SOC screens, telemetry, certifications, staffing hours, or availability.
- Vendor names on this page.
- Prices.
- Pine as the accent. This preview uses magenta. Pine remains a separate decision and is not rendered here.
- Gradient text, neon, and a different card style in every section.
- `!important` as a patch over the page's own rules.

## 5. V4 section and story map

The same environment figure appears in the hero (slightly off), in the disconnected chapter (named parts, still off), in the alignment chapter (it settles), and in the final frame (settled). Other chapters are the argument. They do not introduce a new picture.

1. **Hero.** "You lead the business. We lead the technology." Who DE serves, cybersecurity-first managed technology, the customer remains in command. Primary action: Understand Your Environment. A text link to the alignment chapter is the only secondary path.
2. **Disconnected environment.** People, identity, endpoints, email, cloud, network, applications, data, and vendors exist and are not one system.
3. **Alignment.** "We do not promise outcomes before we understand the environment." The figure moves from 12° off to aligned. The instrument reads 348° toward 360°. Illustrative. Not a measured customer result.
4. **Assess first, then three doors.** The assessment is not a fourth product.
5. **Security foundation.** Seven blocks, then Risk & Exposure underneath as the continuous intelligence layer.
6. **Business operating system.** Workplace, communications, network, cloud and data, business systems, automation, support, governance, continuity. Security is the foundation under them.
7. **Outcomes.** Protect, work better, communicate, automate, comply, recover, grow.
8. **Proof and responsibility.** One chapter. Real links only. Refusals are part of the proof.
9. **Fit and operating models.** Who it is for. ProActive names without a pricing dump. Co-managed for a team that stays. Marketplace for a client that is already here.
10. **Final frame.** The opening environment, now aligned. The same two sentences. The same primary action.

## 6. V4 visual system

One product, one company.

- Foundation: graphite `#050312`. Raised surface `#141026`. Hairline `rgba(247,245,242,0.16)`.
- Paper `#F7F5F2` with ink `#1A1228` is used in one place: the proof chapter, so responsibility reads as a written page inside the dark product.
- Magenta `#D3126A` is the primary action, the focus ring, and the heading instrument. It is not a section background and not a gradient.
- Type: Inter, already loaded by the site. Display is the same face at a larger size and tighter tracking. No second webfont.
- Tokens live on `.v4` only. The page does not redeclare the site theme and does not fight it.
- Logo: `DE_LOGO_REVERSE` on graphite. Do not recolor it.
- Whitespace is the separator. Sections share one measure (`min(72rem, calc(100% - 2.5rem))`) and one vertical rhythm.

## 7. Motion rules

- Native scrolling is the baseline. No scroll snap. No scroll hijack.
- The only scroll-driven motion is the alignment figure in chapter 3, plus the same figure held still at the start (off) and at the end (aligned).
- Progress is read from the section's position in the viewport on a passive scroll listener and one animation frame. Crawl, reading, brisk, and fling all sample the latest position. Nothing depends on a scroll speed.
- Motion uses `transform` and `opacity`.
- The figure rotates inside its own frame, at most 12°. The document does not rotate.
- `prefers-reduced-motion: reduce` shows the aligned figure immediately, sets the instrument to 360°, and does not run the scroll listener.
- No autoplaying media. No WebGL.

## 8. Responsive and mobile rules

- Designed for 390, 768, and 1440. The page column is fluid between them.
- At 390, chapters stack. The figure is `width: 100%` inside a frame with `overflow: hidden`.
- No horizontal overflow. `overflow-x: clip` on `.v4` is the backstop, not the layout.
- Touch targets for actions are at least 44px tall.
- Body text stays at least 16px.
- Fixed site chrome (bottom bar, sticky assessment bar, exit intent, scroll progress) is not shown on `/version-4`. The version ribbon remains. The final action sits clear of it.

## 9. Accessibility rules

- One `h1`. Each chapter is an `h2`. No skipped levels inside a chapter.
- The primary action is a real link to `/book`.
- Focus is visible: 2px magenta outline, 3px offset.
- The heading instrument is `aria-hidden`. A visually hidden sentence says the figure is illustrative.
- The figure has an accessible name: an illustrative map of a business environment, not a live operations view.
- Color is not the only carrier. The continuous layer is named in text.
- Reduced motion keeps every sentence readable.
- The site skip link targets the first `main`.

## 10. Factual and truth requirements

- Unknown stays unknown. Unavailable stays unavailable. Illustrative is labeled illustrative.
- The 348° to 360° reading is an illustration of alignment. It is not a measurement of a customer's environment.
- The eight blocks are the structural model in `ProtectionCommandDeck` / the 2026 service model. They are not a client's posture and not a promise of specific tools.
- The guarantee statement on this page is only what `/about/guarantee` already publishes: a 30-day refund of service fees if the client is not satisfied, plus release from the agreement without penalties. The page links there. It does not add a comparison with other firms.
- Trust Center language: framework names describe customer requirements. They are not Digerati Experts certifications.
- No customer quote, logo, star rating, uptime, headcount, or response-time number appears here.
- Monitoring hours are not stated. The assessment and the pricing page name the fit.
- "Your technology. Your data. Your keys." is the ownership line already used in public copy.
- Phone: `PRIMARY_PHONE` (`325-480-9870`).

## 11. Conversion architecture

- One primary action, used in the hero and the final frame: Understand Your Environment → `/book`.
- The live site's canonical button label remains "Get My Cyber Risk Assessment" everywhere else. Version 4 uses the label in this brief, on this preview only, and it enters the same booking route.
- Secondary path in the hero is a text link down the page, not a second button.
- Assessment is repeated above the three doors and is not styled as a peer of those doors.
- Pricing is a quiet link in the fit chapter: See Plans & Pricing → `/proactive-ecosystem-pricing`.
- Phone is available in the header and the final frame.
- No exit-intent and no second sticky bar on this route.

## 12. Acceptance tests

A build of Version 4 is acceptable when all of these are true:

- `/` still renders the production homepage.
- `/version-4` renders this page, is `noindex`, is not in the mega menu, and is absent from the sitemap.
- The ten chapters are present, in order, with the sentences named in section 5.
- The environment figure is the same component in the hero, the disconnected chapter, the alignment chapter, and the final frame.
- At rest the figure is off-axis. After the alignment chapter it is aligned. Reduced motion shows it aligned.
- Resizing to 390, 768, and 1440 produces no horizontal overflow and no clipped primary action.
- Scrolling at a crawl, a reading pace, a brisk pace, and a fling never produces a blank pinned range, a collision, or a stuck frame. There is no pinned range.
- Keyboard tab reaches the primary action, the door links, and the proof links, with a visible focus ring.
- Headings are one `h1` and chapter `h2`s.
- No testimonial, fake logo, fake counter, fake SOC, price, or vendor name is in the page source.
- The primary links resolve to `/book`, `/solutions/proactive-ecosystem`, `/solutions/co-managed-it`, `/solutions/business-needs`, `/portal/marketplace`, `/about/client-bill-of-rights`, `/about/guarantee`, `/trust/trust-center`, `/about/team`, and `/proactive-ecosystem-pricing`.
- `client/src/pages/versions/registry.test.ts` passes.
- Joe has not been asked to merge this over `/`.

# Home mesh: the live homepage and the chapter concept, joined

Route: `/concepts/home-mesh` (review only, noindex, not in navigation).
Component: `client/src/pages/concepts/HomeMesh.tsx`. Joins: `client/src/pages/concepts/home-mesh.css`.
Shared chrome: `client/src/pages/concepts/chapterChrome.ts` (also used by `/concepts/home-chapters`).
Joe, 2026-10-21: "do one more page and really do a hardcore mesh of the current / and
/concepts/home-chapters because I want both very much ... be very detailed in how you mesh them".

The live `/` (HomepageV8) and `/concepts/home-chapters` stay as they are. This is a third page.

---

## 1. What each page brings

Read section by section from both pages at 1440 and 390 (screenshots compared side by side,
2026-10-21) before anything was built.

| | Live `/` (V8) | Concept (`home-chapters`) |
|---|---|---|
| Strongest | The hero (accent headline, two CTAs, reassurance, pronunciation, the assessment preview over the Phoenix plate); the day/night rhythm of light and dark bands; magenta dash eyebrows and violet accent words; compact grids (problems 3 x 2, industries five across) | The founder portrait; white cards carrying 3D objects; Apple-scale headlines; one glass chapter pill; the light/dark toggle; the Scrollcraft hand-off and the pill that becomes the principal |
| Weakest | Dark cards on dark bands read flat; headlines small next to the content | One monotone black page; the live hero replaced; the trust pillars squeezed to one word a line; problems bento leaving card 06 alone; industries turned into a carousel that cuts the fifth card at 1440; the warm contact plate washing out the heading; 40% longer page from 160px section padding |

## 2. The rule that decides every section

**Content, order and words are the live page's.** The same 16 section components render, in the
same order, with the same ids, so every link, form and fact is the live one.

**The live page's day/night rhythm decides the skin.** Each band is either:

- **v8**: the live page's own styling, untouched, used for its light chapters and the hero;
- **hc**: the concept's skin (charcoal ground, white object cards, large type), used for its dark
  chapters; by Day the toggle turns these to the concept's light theme;
- **hc-dark**: the concept's skin, dark in both modes (the contact footer).

So a visitor gets the rhythm they know from `/`, and every dark chapter is the concept's premium
version of itself. Nothing is styled twice: a band is one skin or the other, never both layered.

## 3. Section by section

| # | Section | Skin | From live `/` | From the concept | Joins (home-mesh.css) |
|---|---|---|---|---|---|
| 01 | Hero + trust strip | v8 | Whole hero: accent headline, CTAs, ticks, positioning, pronunciation, Phoenix plate with parallax, the trust strip | Founder portrait | `V8Hero` takes an optional `aside`; the portrait sits top right, the assessment preview laid over its lower corner, clear of the face; name chip top left |
| 02 | Why we exist | v8 | Light band, claim cards, CTA row | Objects (shield, people, chart) | Object takes the claim grid's text column, first row (the 12px column had shrunk it to an icon) |
| 03 | The threats are real | hc | Accent word "Real", magenta eyebrow | White stat cards | Accent gradient and eyebrow restored on the concept skin |
| 04 | What we tackle | v8 | 3 x 2 grid (no orphan card), ask row | Objects (lock, backup, clipboard, email, bell, eye) | Objects 60-84px above the number |
| 05 | Services | hc | Accent "Managed IT", ecosystem list | White path cards with objects | Day: ecosystem copy re-inked (it was hard-coded white) |
| 06 | Eight blocks + how it works | v8 | Light band, interactive model, dark "how" band | (none) | The concept's dark-stage rules are now scoped to `.hc`, so they no longer reach this band |
| 07 | Client proof | hc | Accent "Outcomes", Bill of Rights, Trust Center | White outcome cards with objects | Three across at desktop, no rail |
| 08 | Why Arizona | v8 | Icon pillar rows, photo, findings sheet | (none) | The concept's squeezed pillar objects are left out on purpose |
| 09 | Team | hc | Accent "your technology", operating rows | White portrait card | (none) |
| 10 | Industries | hc | Five across at 1440, the photo hover | Charcoal ground | No carousel; the live grid stays |
| 11 | Packages | hc | Four models, flagship flag | White pricing cards with objects | Four across at desktop |
| 12 | Insights + monitoring | hc | Feed, monitoring copy | **Scrollcraft peak: the hand-off** | Line draws Signal → Human triage → Named owner; owner lights |
| 13 | Lead form | v8 | Light form band | (none) | (none) |
| 14 | FAQ + compliance | v8 | Light FAQ, dark compliance band | (none) | (none) |
| 15 | Next step | v8 | Light close | **Scrollcraft signature trigger** | The pill folds into the principal button here |
| 16 | Contact + footer | hc-dark | Contact grid, form, footer | Charcoal skin | No photographic plate (it washed the heading out) |

## 4. One system across the two skins

- **Headlines:** one scale in every band, `clamp(2.1rem, 3.6vw, 3.25rem)`, between the live
  2.5rem and the concept's 4.2rem, tracking -0.03em, balanced.
- **Accent words:** the live violet-to-magenta gradient everywhere; by Day the deep end
  (`#5b45e0 → #b50f5a`) so large type keeps at least 3:1 on `#fafafa`.
- **Eyebrows:** the live uppercase magenta with the 24px dash, on both skins.
- **Objects:** one family size in both skins (60-96px), one drop shadow per ground.
- **Section rhythm:** the concept's padding tightened from up to 160px to up to 112px so its bands
  sit beside the live ones without gaps.
- **Seams:** where two bands of the same family meet, a 6% hairline marks the turn.

## 5. Navigation and chrome

- One chapter pill (the concept's), docked under the site menu wherever the menu's bottom edge
  is (`--hc-nav-top` on `<html>`). Its glass is 86% opaque so its links hold 5:1 over white and
  dark bands alike.
- The live page's scroll-snap and spy row are not mounted: two section navs would compete.
- The sticky "Independent Risk Assessment" bar stays off, as on `/` (homepage previews carry
  their own close; `stickyCtaVisibility.ts`).

## 6. Day and Night

- **Night (default when the OS is dark):** the live rhythm, concept bands dark.
- **Day:** every concept band turns light; the hero and the contact footer stay dark, so the page
  opens and closes on the same note. The choice is remembered per browser (`hc-theme`), shared
  with `/concepts/home-chapters`.

## 7. Scrollcraft

Brief and fingerprint: `BRIEF.md` in this folder. On this page:

- **Peak, the hand-off:** the magenta line runs behind the step numbers and lands on Named owner,
  which lights.
- **Signature, the pill becomes the principal:** from the Next step section on, the chapter links
  close in and one "Get a Cyber Risk Assessment · Principal-led · Joseph Petro" button with the
  portrait takes their place; scroll back and the links return. Read from position on every
  frame, so a jump (Home key, a chapter link) can never leave it stuck.
- Both settle to their end state under reduced motion.

## 8. Fixed on the way (both concept pages)

- 43 unscoped `#protection`, `#hero`, `#stats` and `#contact` rules in `home-chapters.css` now
  start with `.hc`. Unscoped, they stayed loaded after an in-app visit to the concept and could
  restyle the same ids on the live `/`.
- The pill could stay folded after a fast scroll back to the top; now read from position.
- The named owner stopped lighting after a later legibility pass set `-webkit-text-fill-color`;
  the lit state now sets both.
- The theme hook wrote the theme onto the first `.hc` it found; the mesh opts out
  (`useTheme({ applyToRoot: false })`), and storage access is guarded.

## 9. Verification (local production build, 2026-10-21)

- Contrast audit (composited background per text node) at 390 and 1440, Night and Day: no
  failures outside the shared cookie banner and text over the industry photographs.
- axe (WCAG 2.2 AA, after scrolling the page): 0 serious or critical at 390 and 1440, both modes.
- Hand-off 0 → 0.33 → 0.75 as the list crosses the screen; owner lit at the end; static under
  reduced motion.
- Pill: folds at the close, unfolds on the way back, correct after End, Home and a chapter link.
- In-app navigation from either concept page to `/`: headings and section grounds identical to a
  fresh load of `/`.
- Not covered: a real phone, and the live insights feed (it loads from a service the local
  build does not reach).

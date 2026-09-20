# Editorial assets

Layer 7 publishing templates for Visual System v2. Parent: `VISUAL_SYSTEM_V2.md`. Journal color lock: `.cursor/rules/blog-store-color-lock.mdc`. Threat feed: `docs/THREAT-INTEL-FEED.md`.

Purpose: one publication universe for threat stories, guides, datasheets, and report covers — without turning the Journal into a magenta marketing microsite or a SOC blog skin.

**Docs only this sprint.** Threat-story template is VIS-014. Publication system is VIS-015. Do not restyle `/resources/blog` colors here.

---

## Two Joe-decided palettes in Layer 7 (Tier 2 — `DESIGN-AUTHORITY.md`)

| Surface | Accent | Rule |
|---------|--------|------|
| Journal / resources / case-studies | Amber (`data-accent="amber"`) | Masthead stays charcoal ladder. “Journal” uses amber ink, not magenta. Do not flatten to paper-only or repaint electric. |
| Marketing datasheets / report covers | Graphite / paper / magenta | Layer 0. HUD only if the cover is an evidence-like artifact and uses HUDFrame. |
| Store | Electric + 14 pill hues | `PRODUCT_MEDIA.md` — do not reuse Journal amber on Store covers |

Primary CTA fill remains `#D3126A` sitewide, including Journal chrome that is not the page accent.

---

## Threat storytelling

Homepage insights and `/resources/security-updates` are a **live feed**, not a manually dated blog. VIS-014 templates must not make old items look recent (`.cursorrules` §34).

Each public threat card already needs:

- date
- source
- title
- context

Classification: **LIVE** when the item comes from the feed. Editorial wrapping (illustration, HUD) around a LIVE item must not imply DE originated the incident or responded in N minutes.

**Do not** attach EXAMPLE copy such as “M365 Phishing Vector Neutralized in 8m” to a LIVE CISA/MSRC item.

### Template jobs (VIS-014)

| Slot | Content |
|------|---------|
| Kicker | Category from the feed (`Active Exploitation`, `Microsoft Security`, …) — not a fake DE severity invention |
| Title | Feed title or DE advisory title that DE actually published |
| Meta | Date, source, Oxanium `LAST VERIFIED` only if true |
| Body | Inter. What an Arizona operator should do. No hype (`UX_PRINCIPLES` / `.cursorrules` §32) |
| Aside | Optional EvidenceFrame EXAMPLE of *how DE would walk an assessment* — labeled EXAMPLE, not mixed into the LIVE header |

HUD on threat stories: allowed on the optional evidence aside, not on every paragraph.

---

## Guides and datasheets (VIS-015)

Publication covers should look like **the same firm** as the site:

- Space Grotesk title
- Graphite or paper field
- Magenta punctuation, not a rainbow cover system
- Optional technical ID (`DS-PROACTIVE-BUSINESS`)
- No Huntress clone, no stock shield wall

Interior pages: Inter, real package names, canonical pricing references — never a second pricing table that drifts.

If a cover shows a dashboard crop, classify it (`VISUAL_EVIDENCE.md`).

---

## Report covers

Assessment and roadmap covers (Sprint 2 frames, Sprint 8 system) are evidence artifacts:

- `paper` EvidenceFrame for something that looks printable
- SANITIZED REAL if derived from a real report
- EXAMPLE if it is a blank of the format
- Never a filled score that looks like a named customer

---

## Do

- Keep Journal amber
- Keep threat dates honest
- Prefer real DE-authored advisories over generated “thought leadership”
- Share Layer 7 grid/margins once VIS-015 defines them — then reuse

## Do not

- Invent a Huntress-like magazine as the new brand
- Recolor Journal to magenta or Store electric “for consistency”
- Use cyberpunk cover treatments
- Publish datasheets that claim certifications, headcount, or SLAs DE has not approved

---

## Related

- `client/src/data/resourceRegistry.ts`
- `docs/SUBJECT-PAGE-CONTENT-BRIEF.md`
- Tasks: VIS-014, VIS-015 in `docs/SITE-VISUAL-TASKS.md`

# BRIEF — Digerati flagship, three directions (Exploration Mode)

**Mode: Exploration.** Triggered by Joe's own words, 2026-09-09: *"I don't like
almost any of it, at least 90 percent is really half baked or not the direction
we need to go … Maybe we need to play this out and get style examples before we
design a lot."* Followed, 2026-09-10, by his instruction to *"cluster the
approved references into exactly three Digerati directions."*

Live page: `/scrollcraft/directions/`. Standalone, `noindex`, no client, server
or shared file touched.

## How we got here

1. **Phase R** — a reference board of 22 real sites across seven deliberately
   wide directions. Joe opened them and returned marks: 10 yes, 9 maybe, 3 no.
2. **Joe's correction**, which governs everything below:
   > "Don't choose a whole website as 'the DE look.' The strongest answer is a
   > deliberate combination of visual base + motion language + product/technical
   > posture."
3. **Phase D** — this build.

## The system

Not three competing looks. Three layers of one system.

| Layer | Name | Governs |
|---|---|---|
| 01 · base | Calm Engineered Confidence | The default register: flagship, story, positioning, refusals, close |
| 02 · product | Precision Product Company | ProActive, the three ways in, the eight blocks, assessments, marketplace |
| 03 · motion | Bright Cinematic Story | How the page moves — a layer *over* 01 and 02, never its own visual universe |

Joe's sentence for it: *"DE should look like an elite advisory/engineering firm,
behave like a beautifully designed product company, and move like a cinematic
story."*

## Divergence before convergence

`design/DESIGN-AUTHORITY.md` §2 requires at least three materially distinct
concepts for a scope of one page or larger, each with a hypothesis and an
account of which Tier 2 defaults it keeps and changes. These are not three
variations of one composition — they differ in field model, hierarchy strategy
and evidence strategy.

### 01 · Calm Engineered Confidence

- **Hypothesis.** In a category that is uniformly dark, calm on paper is both
  the most differentiated and the most appropriate signal for a buyer arriving
  frightened — from an insurance form, a breach scare, a renewal.
- **Keeps from Tier 2.** `--de-paper #f7f5f2` as ground (already a locked
  token), magenta as the accent under the magenta option, the eight-block model,
  the naming canon, the refusals.
- **Changes from Tier 2.** The field ladder inverts: paper is the default
  ground rather than a chapter treatment, so "dark field, accent pop"
  (`.cursor/rules/dark-field-accent-pop.mdc`) does not apply. Type stack moves
  off Space Grotesk / Inter / Oxanium. Containers are nearly eliminated in
  favour of hairlines and space.
- **For Tier 1.** Premium, mature, precise, trustworthy — carried by restraint
  instead of by atmosphere. Reads as advisory, never as generic SaaS or
  cyberpunk.
- **Drawn from.** FGS Global, Aman, Studio MK27, Snøhetta, Kümmerlein.

### 02 · Precision Product Company

- **Hypothesis.** The eight blocks and the cadence are a *model*, and a visible
  hard grid communicates a model better than eight decorated cards do.
- **Keeps from Tier 2.** Magenta for state, the eight-block model with Risk &
  Exposure continuous, the canonical service names, reuse-before-invent.
- **Changes from Tier 2.** Ground goes white and cooler than the base register;
  hairlines become structural rather than ornamental; mono carries every label,
  number and unit; the card vocabulary (`IconWell`, `EvidenceFrame`) is replaced
  by grid cells.
- **For Tier 1.** Technically sophisticated and precise without a single
  hacker-theme cue. No fake dashboard, which is also a Tier 0 truth rule.
- **Drawn from.** Teenage Engineering, Tailscale, Stripe, Pentagram.

### 03 · Bright Cinematic Story

- **Hypothesis.** The scroll experience failed not because scroll is wrong but
  because the motion was atmosphere. Tie every movement to a state change and
  the same ambition works — on paper, over the registers above.
- **Keeps from Tier 2.** Nothing of its own; it inherits 01 and 02 entirely.
- **Changes from Tier 2.** Replaces the retired dark abstract world. One
  movement, one meaning: problem → exposure → clarity → plan → protected
  operating state.
- **For Tier 1.** The differentiator Joe named — *"I've never seen an IT company
  explain what it does like this."*
- **Drawn from.** Lando Norris (OFF+BRAND), Scout Motors.

## Tier 0 held throughout

Truth (no invented numbers, telemetry or certifications — the labels name
categories and conditions, never quantities), accessibility (contrast measured,
focus visible, reduced motion respected), responsive operability (verified at
390 / 768 / 1440, zero horizontal overflow), and the naming canon. Zero kie.ai
spend; all imagery is code-built.

## Joe-decided items this proposes against

None. The reset departs from Tier 2 *defaults*, which Exploration Mode permits.
It touches no item in the Joe-decided table of `design/DESIGN-AUTHORITY.md` §1.

## Open decisions

1. **Pine or magenta** as the page accent. The frames switch between them. Note
   for the record: `brand/README.md` says the gold belongs to the logo only and
   "does not replace brand magenta `#D3126A` anywhere in the interface", so pine
   would be *introducing* a new accent rather than swapping one. Recommendation:
   magenta on paper, held to almost nothing.
2. **Development site, or the eventual live site.** Recommendation: build it as
   the development site, specify it as if it will win.

## Corrections recorded

An earlier draft of this page claimed the Digerati mark had no light-ground
lockup and that one needed drawing. Wrong. `brand/digerati-logo.svg` is the
light-ground lockup (gold mark, graphite wordmark), and `brand/README.md`
records that the gold was corrected `#F5E48A → #E3B23C` precisely because the
old value failed contrast on warm paper. That draft also recoloured the mark,
which `brand/README.md` forbids. This build uses the real asset.

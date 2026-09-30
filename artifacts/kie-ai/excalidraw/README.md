# kie.ai excalidraw-visuals output

**Classification: ILLUSTRATIVE.** Per `design/IMAGERY.md` these are candidates
only. Nothing here goes near `client/public/images/` without passing imagery
review and the DE diagram system (`design/DIAGRAM_SYSTEM.md`) first, and only an
optimized derivative would be placed there.

## 2026-09-02 — light/dark A-B of the revised style prefixes

Evidence for PR #185, which back-ported a newer `excalidraw-visuals` revision
including a rewritten light-mode prefix and a new dark-mode prefix. Both images
use the same concept, layout, element list and reference image; only the locked
style prefix and the palette hexes differ.

| File | Prefix | kie.ai task |
|---|---|---|
| `2026-09-02-ab-light.png` | Light Mode (revised) | `07e28b2162e4652fbbb953db853c01f4` |
| `2026-09-02-ab-dark.png` | Dark Mode (new) | `5bd8276aa69a79021e252889613dae2d` |

Model `google/nano-banana`, 16:9, 1344x768, generated with
`brand-assets/excalidraw-style-reference.png` as the sole `--input`.
12 credits total (the light half was generated twice: the first download was
lost to the egress issue described in `UPSTREAM.md`, then recovered by URL).

### What the A-B showed

**Landed.** Each shape's border is drawn from its own fill colour family --
blue fill with blue border, yellow with amber, green with green -- instead of
the uniform dark gray (`#495057`) the previous prefix produced. Fills are solid
and flat, with no hatching or texture. This was the main reason to back-port.

**Did not land.** The prefix asks for text and outlines that are "VERY wobbly
and imperfect -- visibly shaky", with corners that "don't quite meet". Both
renders came back tidy and controlled, with clean line-art icons. The model
regresses toward polish regardless of how emphatically the prompt asks for
roughness.

**Contradicted.** The dark prefix states in capitals that the background must be
exactly `#121212` and "not black (`#000000`)... non-negotiable". Measured
result: `#000000` across all four corners and 57% of pixels. The most heavily
emphasised instruction in either prefix had no effect. The dark render also
carries a chalk texture the prefix explicitly forbids.

Treat the dark-mode background hex as aspirational, not as a guarantee, and do
not rely on "make it rougher" phrasing to change the output.

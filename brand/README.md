# Digerati Experts — logo system

Master vector artwork for the Digerati Experts identity. Every asset exists as
SVG (the source of truth) and as PNG (for anywhere SVG isn't accepted). The
PNGs under `png/` are exports — never edit one, re-export it.

## Provenance

Rebuilt from the legacy raster logo (`client/public/logo.png`, 500×500) into
clean vector outlines. Two things were regularized in the process:

- **The mark** was redrawn as exact geometry — four bars on a fixed pitch,
  fully rounded ends, long/short/short/long, optically centred on one axis.
  The original was hand-placed and drifted by a pixel or two per bar.
- **The gold** was corrected from `#F5E48A` to `#E3B23C`. The original pale
  yellow fails contrast on warm paper (`#F7F5F2`) and disappears in CMYK
  print. The new value holds at 16px and survives four-colour process.

Letterforms are unchanged — the wordmark is the existing one, outlined.

## Colour

| Role | Hex | Use |
|---|---|---|
| Signal Gold | `#E3B23C` | the mark, on dark grounds |
| Graphite | `#050312` | wordmark on light grounds; the mark on light grounds (locked brand token) |
| Paper | `#F7F5F2` | the light ground the primary lockup is drawn for (locked) |
| White | `#FFFFFF` | wordmark and mark on dark grounds |

Graphite and paper are the locked foundation tokens from `design/BRAND.md`.
The gold belongs to the logo only — it is not a UI accent, and it does not
replace brand magenta `#D3126A` anywhere in the interface.

Measured contrast for the gold: **10.4:1** on graphite, **1.80:1** on paper,
**1.96:1** on white. That is why gold is a dark-ground colour only, and why
the light app tile uses a graphite mark instead of a gold one.

## What to reach for

| You need | Use |
|---|---|
| The logo on a light page | `digerati-logo.svg` |
| The logo on a dark page or over photography | `digerati-logo-reverse.svg` |
| A square-ish space (social header, poster, signage) | `digerati-logo-stacked*.svg` |
| One-colour print, embroidery, engraving, fax | any `*-mono-black` / `*-mono-white` |
| Favicon, app icon, profile picture | `digerati-mark-tile.svg`, or `favicon.ico` |
| A profile picture on a light-themed platform | `digerati-mark-tile-light.svg` |
| A link preview / share card | `digerati-social-card.svg` |
| An email signature or document header | `png/digerati-logo-600.png` |

## Files

**Horizontal lockup** — the primary form. PNG at 2400 / 1200 / 600px wide.

| File | Ground |
|---|---|
| `digerati-logo.svg` | light. Gold mark, graphite wordmark. |
| `digerati-logo-reverse.svg` | dark. Gold mark, white wordmark. The sharpest of the set — prefer it. |
| `digerati-logo-mono-black.svg` | light, one colour. |
| `digerati-logo-mono-white.svg` | dark, one colour. |

**Stacked lockup** — mark set 1.5× above the wordmark. PNG at 1600 / 800px wide.

`digerati-logo-stacked.svg` · `-stacked-reverse.svg` · `-stacked-mono-black.svg` · `-stacked-mono-white.svg`

**Mark alone** — transparent, square artboard. PNG at 1024 / 512 / 256px.

`digerati-mark.svg` (gold, dark grounds only) · `digerati-mark-mono-black.svg` · `digerati-mark-mono-white.svg`

**App tiles** — the mark on a rounded ground. PNG at 1024 / 512 / 256 / 180 / 64 / 32 / 16px.

| File | Use |
|---|---|
| `digerati-mark-tile.svg` | gold on graphite. The default icon everywhere. |
| `digerati-mark-tile-light.svg` | graphite on paper, for platforms that force a light tile. |
| `favicon.ico` | 16 / 32 / 48px in one file, for anything that still demands `.ico`. |

**Social card** — `digerati-social-card.svg`, 1200×630, the aspect every
platform renders. PNG at exactly 1200×630.

## Rules

**Clear space** — leave the height of one bar (⅛ of the mark's height) on
every side of the lockup. Nothing enters it.

**Minimum size** — horizontal lockup 110px wide on screen, 30mm in print.
Below that use the stacked lockup or the mark alone. The mark is legible to
16px.

**Ground** — the reverse lockup on graphite is the sharpest of the set. On
photography, place it over a settled dark area, never over detail.

**Don't** — recolour the mark; put gold on a light ground; set the wordmark in
a live font (these are outlines, and the original typeface is not licensed
here); stretch, rotate, add effects, or box the primary lockup; separate the
mark from the wordmark to reposition it.

## Regenerating

The build is deterministic and recovers the wordmark outlines from
`digerati-logo.svg` itself, so every other asset can be rebuilt from this
folder alone: compose against the geometry above, then export each SVG at the
sizes listed. Re-run it only if the source artwork changes — otherwise edit
the SVGs directly and re-export.

The wordmark outlines themselves came from a two-zone trace of the legacy
raster (sharp corner detection for `DIGERATI`, smoothing for `Experts`), then
near-straight curves flattened to lines and near-axis edges snapped. If the
original vector or the wordmark's typeface ever surfaces, re-cut from it.

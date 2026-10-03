# Document fonts

Static TrueType instances, all SIL Open Font License 1.1 (licence files alongside).

| File | Family | From |
|---|---|---|
| `inter-{400,500,600,700}.ttf`, `inter-italic-400.ttf` | Inter (opsz 14) | `@fontsource-variable/inter` 5.3.0 |
| `space-grotesk-{500,600}.ttf` | Space Grotesk | `@fontsource-variable/space-grotesk` 5.3.0 |
| `newsreader-400-o72.ttf` (display), `newsreader-400-o16.ttf`, `newsreader-500-o24.ttf`, `newsreader-italic-400-o16.ttf` | Newsreader | `@fontsource-variable/newsreader` 5.3.0 |
| `plex-mono-{400,500}.ttf` | IBM Plex Mono | `@fontsource/ibm-plex-mono` 5.3.0 |

**Why static, not variable:** Chromium's PDF backend embeds variable fonts as Type 3 glyph procedures. Type 3 text renders soft in some viewers, prints poorly and is flagged by accessibility checkers. Static instances embed as CID TrueType subsets with ToUnicode maps, so text stays selectable and searchable.

**Regenerate:** `npm pack` the packages above, then for each variable `.woff2`:

```python
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
f = instancer.instantiateVariableFont(TTFont(src), {"wght": 500, "opsz": 14})
f.flavor = None
f.save("inter-500.ttf")
```

Only the latin subset is included. Characters outside it fall back to a system font, which `lib/verify.py` catches when the fallback is Type 3.

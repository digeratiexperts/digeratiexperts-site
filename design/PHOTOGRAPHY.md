# Photography

Photography set plan for Visual System v2. Parent: `VISUAL_SYSTEM_V2.md`. Art direction: `IMAGERY.md`. Proof: `PROOF_SYSTEM.md`. Skill: `.cursor/skills/image-art-direction/SKILL.md`.

Purpose: plan a coherent **human and place** set so Layer 6 is real people and real rooms — not stock cybersecurity clichés and not generated faces.

**Docs only this sprint.** Capture and production are VIS-012 (human/content). Do not generate founder headshots or fake client portraits.

---

## Why photography exists in v2

Upper layers (HUD, diagrams, evidence) can look technical. Without human proof, the site drifts toward a product demo. Photography is how DE stays a **principal-led Arizona firm**.

Photography is not a substitute for evidence. In the master evidence order it sits below real artifacts, data, people-as-themselves, and diagrams:

editorial photography → atmospheric environment → icon.

---

## Sets to plan

| Set | Job | Notes |
|-----|-----|-------|
| Principal / founder | Recognizable human, not a silhouette | Present: studio-blazer still at `/images/founder/joe-petro-studio-blazer-white.webp` (derived 2026-09). Do not invent a face. |
| Working sessions | Assessment, review, whiteboard — process, not pose-with-laptop cliché | Graphite/paper wardrobe and rooms; magenta is not a lighting gel |
| Place / Arizona | Chandler / Valley context without postcard kitsch | Supports “Arizona-based · principal-led” without fake civic telemetry |
| Client-safe operations | Hands, rooms, documentation — **no client screens with secrets** | If a screen is readable, it is SANITIZED REAL or it is not shown |
| Environment plates (related, not portraits) | Sprint 4 / VIS-010 | Four plates; atmospheric Layer 1. See below |

Do not build a fifth set of hoodie / server-aisle / handshake stock.

---

## Art direction (locked to DE, not Huntress)

Match the sculpture/environment language where photos sit on dark chapters:

- Dark or quiet interiors, graphite, gunmetal, warm practicals
- Controlled studio or available light; **restrained violet as light, not paint**
- Generous negative space for type
- Same camera height and color grade across the set
- Paper-chapter portraits may be lighter but must still feel like the same firm

Avoid: generic stock, blown-out windows, cyberpunk gels, rainbow, fake “command center” with unreadable fake SOC walls.

Concept-not-noun still applies. “Monitoring” is not a person pointing at a lock icon.

---

## Environment plates (Sprint 4 / VIS-010)

Four plates are a later flagship, not photography portraits. They are Layer 1 atmosphere:

- continuous field, grain, restrained matrix optional
- no neon city
- no live Arizona threat overlay unless LIVE data exists

Plates must not be mistaken for the proof chapter. Classify ILLUSTRATIVE if they could be read as a real facility tour.

---

## Rights and honesty

- Real people only with permission
- No generated likeness of staff or clients
- No fabricating a “team of 40” via extras
- Alt text describes the actual scene, not a capability claim
- Do not caption a stock-like image as a named customer

---

## Placement

| Surface | Photography | Not |
|---------|-------------|-----|
| Proof / about / meet | Principal and approved people | HUD ticks on faces |
| Hero | Existing atmosphere may stay; do not force a new portrait into the hero without DE | Huntress-style operator close-up as brand |
| Small cards | Still `IconWell` | Tiny cropped heads |
| Store | Vendor marks and product media (`PRODUCT_MEDIA.md`) | Staff photos as SKUs |

---

## Inventory pointers

- `docs/VISUAL-ASSET-INVENTORY.md` — founder present, derived from studio-blazer photo (2026-09)
- `client/src/lib/visualAssets.ts` — public stills registry; Meshy retired from public marketing
- `design/approved/engage-sculpture-set-2026-08.md` — quality bar for 3D; photos should be at least that intentional

When assets land, register them and set availability flags honestly. Do not mark `available = true` without the file.

---

## Task

VIS-012 in `docs/SITE-VISUAL-TASKS.md` (BACKLOG — human/content). Agents do not fill this with generated people.

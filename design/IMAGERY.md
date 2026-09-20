# Imagery

Layer 0–1 stills and concept-not-noun. v2 photography / plates / product media: `PHOTOGRAPHY.md`, `PRODUCT_MEDIA.md`, `VISUAL_SYSTEM_V2.md` (do not replace this file). Authority tiers: `DESIGN-AUTHORITY.md`.

**Tiers in this file.** *Concept-not-noun*, the cliché list under "Avoid", the truth rules (no invented faces, no fake founder, licensed sources stay private) and the evaluation questions are **Tier 1/0** and hold in every mode. The **rendering language** ("dark technical sculpture"), the material/lighting list and the consistency list are the **Tier 2 current art direction** — mandatory in Maintenance Mode, a challengeable starting point in Exploration Mode. Sculpture/Meshy retirement from public marketing is Joe-decided.

Images are part of the brand identity. Never treat website imagery as isolated assets.

Create a coherent visual family across the entire site. Coherence comes from a stated art direction — one director's intent — not from every image sharing every parameter. A controlled family may contain more than one rendering language (for example editorial photography, explanatory diagrams and product plates) when the art direction defines how they relate.

Registry: `client/src/lib/visualAssets.ts`. Quality bar: `design/approved/` (especially `engage-sculpture-set-2026-08.md`). Skill: `.cursor/skills/image-art-direction/SKILL.md`.

## Current system (Tier 2) — dark technical sculpture

Current visual direction: PREMIUM ENTERPRISE TECHNOLOGY.

Characteristics:

- dark environments
- graphite
- gunmetal
- smoked glass
- subtle metallic materials
- deep violet illumination (violet as **lighting, not paint**)
- controlled studio lighting
- subtle rim lighting
- sophisticated shadows
- realistic/stylized 3D
- architectural/product visualization
- restrained composition
- generous negative space

Generate as a **set**. Bleed the still into an editorial stage (`VisualStage`) —
same dark field as the chapter, not an inner rounded purple square. Homepage
engage-path cards use Lucide `IconWell`, not sculpture bleeds.

## Concept, not noun

Represent the underlying idea rather than the literal noun.

| Concept | Represent as | Not |
|---------|----------------|-----|
| Fully Managed IT & Cybersecurity | Central core connected to endpoints and nodes | Laptop |
| Co-Managed IT | Two systems interlocking on one spine | Two people / handshake |
| Cyber Risk Assessment | Lattice scanned by a lavender arc | Shield + padlock |
| Monitoring | Technical telemetry and system state | Generic dashboard screenshot |
| Identity | Controlled access architecture | ID badge cliché as the whole image |
| Backup | Redundancy and layered infrastructure | Cloud + padlock |

Current engage-path files: `client/public/images/visual-system/engage-paths/`.

## Avoid

Do not default to: generic shields, padlocks, laptops, robots, hacker hoodies, generic server racks, binary code, cyberpunk, neon grids, rainbow gradients, excessive glow, toy-like 3D, cartoon illustrations, random AI objects.

Meshy Batch 01 stills remain in the asset inventory only. Do not place laptop / robot / lock / envelope stills on Stats, Tackle, Protect, Pricing, `/solutions`, or other public marketing cards.

Portal / mega-menu chrome stays Lucide.

Public marketing placement:

- **Sculptures / Meshy / sci-fi hardware** — retired from public marketing (DE: high quality or not at all). Do not remount `VisualStage` stills. Chapters stand on type + `IconWell`.
- **Offer + small cards** — Lucide in a muted violet `IconWell`. Not 40px 3D toys.

## Consistency (Tier 2 default — within one rendering language)

Within one rendering language of the family (for example the sculpture set), keep these consistent so the set reads as one shoot:

- camera perspective
- lighting direction
- materials
- environment
- color palette
- contrast
- visual density
- scale
- negative space

Only the conceptual subject should significantly change **within that set**. Across the site, the art direction — not identical parameters — is what makes photography, diagrams, plates and stills belong together. Cohesion pushed into sameness is a failure mode too: if every image on the site shares one camera, one light and one material, the site reads as monotone. In Exploration Mode a concept may define a different art direction and a different set of rendering languages.

## Composition

Images must work within the actual website component. Consider card dimensions, available negative space, text placement, crop, focal point, and responsive behavior. Do not create beautiful images that become unusable when cropped.

## Evaluation

Before approving an image ask:

1. Does it look like generic AI art?
2. Does it belong to the brand?
3. Does it communicate the concept?
4. Does it work at the actual rendered size?
5. Does it match neighboring imagery?
6. Does it complement rather than compete with typography?
7. Would this image still look intentional in six months?

If not, regenerate/rethink the concept.

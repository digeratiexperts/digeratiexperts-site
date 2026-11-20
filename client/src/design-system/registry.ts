/**
 * Design-system registry: the one hand-written source for the layers the
 * styleguide (/design-system), the agent manifest (design/design-system.json)
 * and the adoption report are built from.
 *
 * What is NOT here: token values. Those live in client/src/index.css and the
 * generator reads them from there, so a value can never drift from the CSS.
 * What is NOT claimed: nothing here states a metric, a client or a result.
 * Authority tiers follow design/DESIGN-AUTHORITY.md.
 */

export type ComponentStatus = "stable" | "experimental" | "deprecated";
export type AuthorityTier = 0 | 1 | 2;

export interface ComponentGuidance {
  /** Registry key, also the manifest id. */
  id: string;
  name: string;
  /** Path under the repo root; the generator checks it exists. */
  file: string;
  /** Import specifiers the adoption scan counts (without quotes). */
  importPaths: string[];
  status: ComponentStatus;
  tier: AuthorityTier;
  purpose: string;
  dos: string[];
  donts: string[];
  accessibility: string[];
  /** Where a live preview is rendered on the styleguide, if any. */
  preview?: "button" | "badge" | "status-token" | "icon-well";
}

export const COMPONENTS: ComponentGuidance[] = [
  {
    id: "button",
    name: "Button",
    file: "client/src/components/ui/button.tsx",
    importPaths: ["@/components/ui/button"],
    status: "stable",
    tier: 2,
    purpose: "Every clickable action. The brand variant carries the single magenta call to action on a page.",
    dos: [
      "Use variant=\"brand\" for the one primary action in a section.",
      "Use variant=\"outline\" for secondary actions on dark fields.",
      "Keep the visible label the same as the accessible name.",
    ],
    donts: [
      "Do not style a link as a button by hand; use asChild with the router Link.",
      "Do not put two brand buttons in the same viewport.",
    ],
    accessibility: [
      "Sizes today are default 36px, sm 32px, lg 40px, icon 36px: below the ~44px touch target in design/DESIGN-AUTHORITY.md Tier 0. Add min-h-11 on touch-critical buttons until the sizes are reviewed.",
      "Visible focus ring is part of the variant; do not remove it.",
    ],
    preview: "button",
  },
  {
    id: "badge",
    name: "Badge",
    file: "client/src/components/ui/badge.tsx",
    importPaths: ["@/components/ui/badge"],
    status: "stable",
    tier: 2,
    purpose: "Short non-interactive labels: category, state, tier name.",
    dos: ["Keep labels to one or two words.", "Use canonical ProActive tier names only."],
    donts: ["Do not make a badge clickable; use a Button or link.", "Do not use a badge to state a metric you cannot source."],
    accessibility: ["Do not rely on colour alone to carry meaning; the text must say it."],
    preview: "badge",
  },
  {
    id: "card",
    name: "Card",
    file: "client/src/components/ui/card.tsx",
    importPaths: ["@/components/ui/card"],
    status: "stable",
    tier: 2,
    purpose: "Grouped content on a surface. Pair with the field ladder in design/UI-STYLE-RULES.md.",
    dos: ["Use one card to hold one idea.", "Give every card a real heading."],
    donts: ["Do not build equal-weight grids of text-only cards; vary the lead item."],
    accessibility: ["Make the whole card one link target, not several adjacent ones."],
  },
  {
    id: "icon-well",
    name: "IconWell",
    file: "client/src/components/visual/IconWell.tsx",
    importPaths: ["@/components/visual/IconWell"],
    status: "stable",
    tier: 2,
    purpose: "Quiet holder for a Lucide icon so the magenta accent still pops.",
    dos: ["Use Lucide icons. Generate a custom SVG only through the recraft-icons skill, with Joe's go-ahead."],
    donts: ["Do not tint the well purple.", "Do not replace the mega-menu icons."],
    accessibility: ["Decorative by default; give the adjacent text the meaning."],
    preview: "icon-well",
  },
  {
    id: "status-token",
    name: "StatusToken",
    file: "client/src/components/evidence/StatusToken.tsx",
    importPaths: ["@/components/evidence/StatusToken"],
    status: "stable",
    tier: 0,
    purpose: "A state label. Tier 0 because it signals truth: emerald and pulsing mean live.",
    dos: ["Use \"active\" and pulsing only for something that is live right now."],
    donts: ["Never animate a pulse for a system you cannot observe.", "Never invent a status."],
    accessibility: ["The label text carries the state; the dot is decoration."],
    preview: "status-token",
  },
  {
    id: "proof-chip",
    name: "ProofChip",
    file: "client/src/components/evidence/ProofChip.tsx",
    importPaths: ["@/components/evidence/ProofChip"],
    status: "stable",
    tier: 0,
    purpose: "A small evidence label tied to design/PROOF_SYSTEM.md.",
    dos: ["Source every metric in the chip in docs/CLAIMS-REGISTER.md."],
    donts: ["No fabricated numbers, clients, certifications or response times."],
    accessibility: ["Keep contrast on both dark and paper variants."],
  },
  {
    id: "evidence-frame",
    name: "EvidenceFrame",
    file: "client/src/components/evidence/EvidenceFrame.tsx",
    importPaths: ["@/components/evidence/EvidenceFrame"],
    status: "stable",
    tier: 0,
    purpose: "Frames a screenshot or artefact with its classification (LIVE, SANITIZED REAL, EXAMPLE, ILLUSTRATIVE).",
    dos: ["Always show the classification."],
    donts: ["Do not frame an illustrative image as real."],
    accessibility: ["Provide alt text that says what the artefact is and its classification."],
  },
  {
    id: "hud-frame",
    name: "HUDFrame",
    file: "client/src/components/evidence/HUDFrame.tsx",
    importPaths: ["@/components/evidence/HUDFrame"],
    status: "experimental",
    tier: 2,
    purpose: "HUD grammar for product visuals. Aesthetic is Tier 2; the truth rules inside it are Tier 0.",
    dos: ["Read design/HUD_CHROME.md first."],
    donts: ["Do not use it to imply live telemetry that is not live."],
    accessibility: ["Keep decorative lines aria-hidden."],
  },
];

export interface ChangelogEntry {
  date: string;
  /** Homepage version numbers this touches, if any. */
  versions?: number[];
  title: string;
  detail: string;
  /** Joe-decided entries are marked; agents propose against them, never silently change them. */
  joeDecided?: boolean;
}

/** Newest first. Entries are never deleted, only marked superseded in `detail`. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-11-18",
    title: "Design-system layers added",
    detail:
      "Living styleguide at /design-system, generated agent manifest (design/design-system.json), component status and guidance, version diff and an adoption report. Additive: no existing token, component or page changed.",
  },
  {
    date: "2026-10-22",
    title: "Homepage v2 (homepage-v2) approved as the live homepage",
    detail:
      "Per the note in client/src/App.tsx. The previous homepage is kept at /concepts/home-classic (noindex). homepage-v2 is not one of the numbered /version-N snapshots.",
    joeDecided: true,
  },
  {
    date: "2026-10-19",
    title: "Premium web design pass",
    detail: "Masterclass rules approved 2026-10-18/19; encoded in the premium-web-design skill.",
    joeDecided: true,
  },
  {
    date: "2026-10-03",
    versions: [8],
    title: "Version 8 approved as the homepage at /",
    detail:
      "Version 7 with Joe's section-by-section notes. Joe: \"its approved. do it.\" /version-8 now redirects to /; the previous homepage stays at /version-0 and Version 7 at /version-7 (versions/registry.ts).",
    joeDecided: true,
  },
  {
    date: "2026-09-03",
    versions: [1],
    title: "Homepage v1 restored at /",
    detail: "The homepage before the Scrollcraft-era sections, on Joe's direction.",
    joeDecided: true,
  },
];

/** Keys: CSS custom property names read from client/src/index.css by the generator. */
export const TOKEN_GROUPS: { id: string; label: string; names: string[] }[] = [
  { id: "field", label: "Fields", names: ["--de-bg", "--de-surface", "--de-raised", "--de-paper", "--de-paper-raised"] },
  { id: "text", label: "Text", names: ["--de-fg", "--de-muted", "--de-muted-soft"] },
  {
    id: "accent",
    label: "Accent",
    names: ["--de-magenta", "--de-magenta-ink", "--de-magenta-paper-ink", "--de-magenta-hover", "--de-violet"],
  },
  { id: "line", label: "Lines", names: ["--de-hairline", "--de-paper-hairline"] },
  {
    id: "layout",
    label: "Layout chrome",
    names: ["--de-canvas", "--de-nav-h", "--de-utility-h", "--de-chrome-inset", "--de-fab-h"],
  },
];

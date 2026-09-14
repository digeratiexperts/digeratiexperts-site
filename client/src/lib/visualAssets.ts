/**
 * Public visual-system registry for Digerati website stills.
 *
 * Rules:
 * - Only optimized derivatives under `/images/...` (never licensed ORIGINAL paths)
 * - Public marketing: Lucide IconWell + type. No Meshy / sculpture / sci-fi hardware.
 * - Meshy Batch 01 and engage-path sculptures are retired from public marketing
 *   (DE: high quality or not at all — current stills read as cheap cyber toys)
 * - Portal / mega-menu chrome stays Lucide
 */

export type VisualStill = {
  /** Concept slug */
  id: string;
  /** Human label */
  label: string;
  /** Primary public path (WebP preferred) */
  src: string;
  /** Fallback PNG */
  srcPng: string;
  /** Smaller card thumb */
  srcThumb: string;
  alt: string;
  /** Placement readiness */
  status: "approved" | "awaiting-approval" | "missing";
  source: "meshy-batch-01" | "photography" | "envato" | "engage-sculpture-set" | "meshy-site-accent";
};

const meshy01 = (slug: string, label: string, alt: string, status: VisualStill["status"]): VisualStill => ({
  id: slug,
  label,
  src: `/images/visual-system/meshy-batch-01/${slug}.webp`,
  srcPng: `/images/visual-system/meshy-batch-01/${slug}.png`,
  srcThumb: `/images/visual-system/meshy-batch-01/${slug}-256.webp`,
  alt,
  status,
  source: "meshy-batch-01",
});

/** Retired Batch 01 shapes — inventory only. Do not mount on public marketing. */
export const meshyBatch01 = {
  endpoint: meshy01(
    "endpoint",
    "Endpoint security",
    "3D icon of a laptop with a shield emblem representing endpoint protection",
    "awaiting-approval",
  ),
  email: meshy01(
    "email",
    "Email security",
    "3D icon of a locked envelope representing email security",
    "awaiting-approval",
  ),
  network: meshy01(
    "network",
    "Network security",
    "3D icon of connected network nodes representing network protection",
    "awaiting-approval",
  ),
  backup: meshy01(
    "backup",
    "Backup and recovery",
    "3D icon of a cloud over storage drives representing backup and recovery",
    "awaiting-approval",
  ),
  /** v4 ID badge — retired with the rest of Batch 01 */
  identity: meshy01(
    "identity",
    "Identity and access",
    "3D icon of an ID badge with shield and keyhole representing identity and access",
    "awaiting-approval",
  ),
} as const;

/**
 * Real photography — principal portrait is the Meet-the-Experts studio-blazer
 * photo already public at `/images/founder/` (Joe/ChatGPT F1 approval 2026-09-13).
 */
export const photography = {
  founderHeadshot: {
    id: "founder-joseph-petro",
    label: "Joseph Petro — Founder",
    src: "/images/founder/joe-petro-studio-blazer-white.jpg",
    srcPng: "/images/founder/joe-petro-studio-blazer-white.jpg",
    alt: "Joseph Petro, Founder of Digerati Experts",
    available: true as boolean,
    dropOriginalsAt: "assets/photography/de-headshots/ORIGINAL/",
    publicDerivativesAt: "client/public/images/founder/",
  },
} as const;

/** Envato 4THD2PH — ZIP not yet received */
export const envatoStock = {
  packId: "4THD2PH",
  available: false as boolean,
  dropZipAt: "assets/licensed/envato-4THD2PH/ORIGINAL/",
} as const;

export function isApprovedStill(still: VisualStill | undefined): still is VisualStill {
  return !!still && still.status === "approved";
}

/** Homepage outcomes — Lucide on cards; no 3D on every tile */
export const outcomeVisualByTitle: Record<string, VisualStill | undefined> = {};

/** Tackle cards use Lucide wells — no per-card 3D */
export const tackleVisualByTitle: Record<string, VisualStill | undefined> = {};

const engageSculpture = (
  slug: string,
  label: string,
  alt: string,
  opts?: { alpha?: boolean },
): VisualStill => ({
  id: slug,
  label,
  src: `/images/visual-system/engage-paths/${slug}.webp`,
  // Photographic stills compress better as JPEG; knockout stills need PNG alpha.
  srcPng: `/images/visual-system/engage-paths/${slug}.${opts?.alpha ? "png" : "jpg"}`,
  srcThumb: `/images/visual-system/engage-paths/${slug}-640.webp`,
  alt,
  status: "awaiting-approval",
  source: "engage-sculpture-set",
});

/**
 * Retired engage-path sculptures — kept for inventory only.
 * Do not mount on public marketing. Status is not approved.
 */
export const engageSculptureSet = {
  fullyManaged: engageSculpture(
    "fully-managed",
    "Fully managed IT",
    "Dark graphite sculpture of a central security core connected to endpoint and network nodes",
  ),
  coManaged: engageSculpture(
    "co-managed",
    "Co-managed IT",
    "Two interlocking technical systems sharing one infrastructure spine",
  ),
  cyberRisk: engageSculpture(
    "cyber-risk",
    "Cyber risk assessment",
    "Network lattice illuminated by a scanning arc highlighting selected nodes",
  ),
  /** Homepage Threats chapter — one knockout still, not Meshy laptop/shield */
  threatTelemetry: engageSculpture(
    "threat-telemetry",
    "Threat telemetry",
    "Graphite telemetry core with smoked-glass plates and violet-lit nodes representing detected events",
    { alpha: true },
  ),
} as const;

/** Engage path cards use Lucide wells — sculptures are not public marketing */
export const engagePathVisualByTitle: Record<string, VisualStill | undefined> = {};

/**
 * Homepage section editorials — sculptures retired (high quality or not at all).
 * Chapters stand on type + IconWell. Do not re-wire cheap 3D here.
 */
export const homepageSectionAccents = {
  statsThreats: undefined as VisualStill | undefined,
  engagementAssessment: undefined as VisualStill | undefined,
  howItWorks: undefined as VisualStill | undefined,
  protectProcess: undefined as VisualStill | undefined,
  pricingEcosystem: undefined as VisualStill | undefined,
};

/** Security stack / solutions cards — Lucide wells, not Meshy */
export const stackVisualByTitle: Record<string, VisualStill | undefined> = {};

export const solutionVisualByTitle: Record<string, VisualStill | undefined> = {};

export const TIER_ORDER = ["it", "office", "business", "enterprise"] as const;
export type CoverageTier = (typeof TIER_ORDER)[number];

export function tierIndex(tier: CoverageTier): number {
  return TIER_ORDER.indexOf(tier);
}

export function isTierLit(selected: CoverageTier, candidate: CoverageTier): boolean {
  return tierIndex(candidate) <= tierIndex(selected);
}

export function coverageRowIsUniform(cells: readonly unknown[]): boolean {
  if (cells.length === 0) return true;
  return cells.every((cell) => String(cell) === String(cells[0]));
}

export function categoryLayer(categoryId: string): CoverageTier | "always" {
  switch (categoryId) {
    case "core-it":
      return "it";
    case "workplace-network":
    case "backup":
      return "office";
    case "security-ops":
      // Security is foundational in every ProActive tier; higher tiers add depth.
      return "it";
    case "compliance-strategy":
      return "enterprise";
    default:
      return "always";
  }
}

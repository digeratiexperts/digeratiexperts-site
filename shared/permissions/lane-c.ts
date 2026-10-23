/**
 * Lane C permissions (IT Roadmap, Business Reviews, Questionnaires;
 * docs/plans/opencode/lane-c-planning.md). Registered in index.ts per
 * docs/lanes/registry.md.
 */
import type { AccessRule } from "./types";

export const laneCPermissions: Record<string, AccessRule> = {
  /** Write and edit a company's roadmap: DE staff + break-glass. */
  "roadmap.manage": { deOnly: true },
  /** Read the roadmap, comment, approve or decline: the company's owners (IT contacts hold every hat). */
  "roadmap.read": { roles: ["owner"] },
  "roadmap.decide": { roles: ["owner"] },
};

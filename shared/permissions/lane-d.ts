/**
 * Lane D permissions (System Status; docs/plans/opencode/lane-d-status-shipping.md).
 * Registered in index.ts per docs/lanes/registry.md.
 */
import type { AccessRule } from "./types";

export const laneDPermissions: Record<string, AccessRule> = {
  /** Post, edit, resolve and delete System Status notices: DE staff + break-glass. */
  "status.manage": { deOnly: true },
};

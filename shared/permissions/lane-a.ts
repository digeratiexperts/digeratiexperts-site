/**
 * Lane A permissions (Wave 1: roles, navigation, company switching).
 * Other lanes add their own `lane-*.ts` next to this file (docs/lanes/registry.md).
 *
 * `roles: []` = no client hat holds this permission (DE-only capability).
 * Undefined `roles` = every client hat holds it (with its own tenant scope).
 */
import type { AccessRule } from "./types";

export const laneAPermissions: Record<string, AccessRule> = {
  // --- Break-glass only (today's requireAdmin surface; behaviour unchanged) ---
  "portal.admin": { superAdminOnly: true },
  "company.delete": { superAdminOnly: true },
  "admin.settings": { superAdminOnly: true },
  "admin.authConfig": { superAdminOnly: true },
  "admin.staffRoles": { superAdminOnly: true },
  "admin.billingConfig": { superAdminOnly: true },
  "admin.integrationConfig": { superAdminOnly: true },
  "audit.read": { superAdminOnly: true },

  // --- DE staff + break-glass: client-manager duties (plan Phase 1) ---
  "company.switch": { roles: [] },
  "company.manage": { roles: [] },
  "clientRoles.manage": { roles: [] },
  "entitlements.manage": { roles: [] },
  /** Lane B wires this into the Files & Downloads routes (plan Phase 3). */
  "files.share": { roles: [] },

  // --- Client surface (tenant-scoped by default) ---
  "entitlements.read": {},
  "files.read": {},
  "nav.context": {},
};

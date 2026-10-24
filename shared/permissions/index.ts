/**
 * Permissions registry index (lane A). `can()` is the one server-side permission
 * helper the plan asks for: `can(user, permission, companyId?)`.
 *
 * Wave 2 lanes extend this by adding `shared/permissions/lane-<lane>.ts` and one
 * import/merge line below — see docs/lanes/registry.md. Never edit another lane's file.
 */
import { laneAPermissions } from "./lane-a";
import { laneCPermissions } from "./lane-c";
import { laneDPermissions } from "./lane-d";
import { laneStaffPermissions } from "./lane-staff";
import { ruleAllows, type AccessContext, type AccessPrincipal, type AccessRule } from "./types";

export * from "./types";

export const PERMISSIONS: Record<string, AccessRule> = {
  ...laneAPermissions,
  ...laneCPermissions,
  ...laneDPermissions,
  ...laneStaffPermissions,
};

export type PermissionKey =
  | keyof typeof laneAPermissions
  | keyof typeof laneCPermissions
  | keyof typeof laneDPermissions
  | keyof typeof laneStaffPermissions
  | (string & {});

/**
 * The single permission helper. Denies unknown permissions (except for the
 * break-glass account, whose access is never reduced). Pass the target
 * `companyId` so a client principal can never act on another company.
 */
export function can(
  principal: AccessPrincipal | null | undefined,
  permission: PermissionKey,
  companyId?: string | null,
  ctx?: Omit<AccessContext, "principal" | "companyId">,
): boolean {
  return ruleAllows(PERMISSIONS[permission], {
    principal,
    companyId: companyId ?? null,
    entitlements: ctx?.entitlements,
    data: ctx?.data,
  });
}

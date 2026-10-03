/**
 * Authorization decision for serving private object-storage entities.
 *
 * Authenticated ≠ authorized. Default deny when ownership cannot be proven.
 */

export type ObjectReadSubject = {
  userId?: string | null;
  role?: string | null;
  /** Portal tenant / company id for the signed-in user, when known. */
  clientId?: string | null;
};

export type ObjectReadEvidence = {
  /** True when GCS object ACL metadata grants this user read access. */
  aclAllowsUser: boolean;
  /** Tenant (client) that owns this object path in portal_tenant_files, if any. */
  tenantOwnerClientId?: string | null;
};

export type ObjectReadDecision =
  | { allow: true; reason: "admin" | "acl_owner" | "tenant_owner" }
  | { allow: false; reason: "denied" };

/**
 * Decide whether the subject may read the object.
 *
 * Order: DE admin → object ACL owner/rules → tenant file ownership → deny.
 */
export function authorizeObjectRead(
  subject: ObjectReadSubject,
  evidence: ObjectReadEvidence,
): ObjectReadDecision {
  if (subject.role === "admin") {
    return { allow: true, reason: "admin" };
  }

  if (evidence.aclAllowsUser) {
    return { allow: true, reason: "acl_owner" };
  }

  const clientId =
    typeof subject.clientId === "string" && subject.clientId.trim().length > 0
      ? subject.clientId.trim()
      : null;
  const ownerClientId =
    typeof evidence.tenantOwnerClientId === "string" &&
    evidence.tenantOwnerClientId.trim().length > 0
      ? evidence.tenantOwnerClientId.trim()
      : null;

  if (clientId && ownerClientId && clientId === ownerClientId) {
    return { allow: true, reason: "tenant_owner" };
  }

  return { allow: false, reason: "denied" };
}

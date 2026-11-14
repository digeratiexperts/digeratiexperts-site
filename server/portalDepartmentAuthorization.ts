export type DepartmentActor = {
  role: string;
  clientId?: string | null;
};

export type DepartmentUser = {
  id: string;
  clientId?: string | null;
  isActive?: boolean | null;
};

export type DepartmentScopeResult =
  | { ok: true; clientId: string }
  | { ok: false; status: 400 | 404; error: string };

export function resolveDepartmentMutationScope(
  actor: DepartmentActor,
  requestedClientId: unknown,
): DepartmentScopeResult {
  const actorClientId = actor.clientId || null;
  if (!actorClientId && actor.role !== "admin") {
    return { ok: false, status: 400, error: "No client associated" };
  }

  const requested =
    typeof requestedClientId === "string" && requestedClientId.trim()
      ? requestedClientId.trim()
      : null;
  const targetClientId = requested || actorClientId;
  if (!targetClientId) {
    return { ok: false, status: 400, error: "clientId required" };
  }

  if (actor.role !== "admin" && targetClientId !== actorClientId) {
    return { ok: false, status: 404, error: "Department not found" };
  }

  return { ok: true, clientId: targetClientId };
}

export function isEligibleDepartmentItContact(
  user: DepartmentUser | null | undefined,
  targetClientId: string,
): boolean {
  return Boolean(user && user.clientId === targetClientId && user.isActive !== false);
}

import { z } from "zod";

/**
 * Hub-defined representation, consumed by the Client Portal.
 *
 * The Intelligence Hub is the system of record for a client's organization
 * (sites, departments, representatives, approval authority). The Portal reads
 * a client-safe projection (contract `client-org-representation/v1`, Hub
 * route GET /api/webhooks/portal/representation, signed portal_to_hub) and
 * authorizes its own users against it on the server.
 *
 * Representation is not approval. Nothing here changes who approves Portal
 * service requests (shared/orgDirectory.ts keeps that) or who owns a ticket.
 * Contract: docs/PORTAL-REPRESENTATION-CONTRACT.md
 */

export const REPRESENTATION_CONTRACT = "client-org-representation/v1" as const;

const representativeSchema = z.object({
  role: z.enum(["primary", "backup"]),
  displayName: z.string().min(1).max(200),
  email: z.string().max(320).nullable(),
  portalUserId: z.string().max(120).nullable(),
  communicationScopes: z.array(z.string().max(60)).max(20),
  responsibilities: z.array(z.string().max(60)).max(20),
  effectiveUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

const groupSchema = z.object({
  scopeKey: z.string().regex(/^(account|site:\d+|unit:\d+)$/),
  kind: z.enum(["company", "site", "department", "team", "division", "operational_group"]),
  name: z.string().min(1).max(200),
  portalRefs: z.array(z.string().max(100)).max(20),
  representatives: z.array(representativeSchema).max(10),
});

export const representationProjectionSchema = z.object({
  contract: z.literal(REPRESENTATION_CONTRACT),
  accountId: z.number().int().positive(),
  model: z.enum(["site", "department", "hybrid"]).nullable(),
  active: z.boolean(),
  generatedAt: z.string(),
  groups: z.array(groupSchema).max(1000),
});
export type RepresentationProjection = z.infer<typeof representationProjectionSchema>;
export type RepresentationGroup = z.infer<typeof groupSchema>;

/** Group-level request kinds a representative may file, and the communication scope each needs. */
export const GROUP_REQUEST_KINDS = [
  { key: "group_request", label: "Request for my group", scope: "group_requests", hint: "Something the whole group needs." },
  { key: "equipment_collection", label: "Equipment collection", scope: "equipment_collection", hint: "Coordinate pickup or return of devices." },
  { key: "technology_assessment", label: "Technology needs", scope: "technology_assessments", hint: "Tell DE what your group needs next." },
  { key: "group_concern", label: "Group concern", scope: "group_concerns", hint: "Raise an issue affecting your group." },
] as const;
export type GroupRequestKind = (typeof GROUP_REQUEST_KINDS)[number]["key"];

export const GROUP_REQUEST_STATUSES = ["submitted", "in_progress", "resolved", "closed"] as const;
export type GroupRequestStatus = (typeof GROUP_REQUEST_STATUSES)[number];

export const groupRequestInputSchema = z
  .object({
    scopeKey: z.string().regex(/^(account|site:\d+|unit:\d+)$/),
    kind: z.enum(GROUP_REQUEST_KINDS.map((k) => k.key) as [GroupRequestKind, ...GroupRequestKind[]]),
    subject: z.string().trim().min(3).max(160),
    description: z.string().trim().min(3).max(4000),
  })
  .strict();
export type GroupRequestInput = z.infer<typeof groupRequestInputSchema>;

export function scopeForKind(kind: GroupRequestKind): string {
  return GROUP_REQUEST_KINDS.find((k) => k.key === kind)!.scope;
}

function isLive(rep: { effectiveUntil: string | null }, today: string): boolean {
  return rep.effectiveUntil == null || rep.effectiveUntil >= today;
}

/**
 * The groups this Portal user represents. Matches the Hub's Portal user id
 * first; otherwise the user's email, case-insensitively. The Hub only sends
 * live assignments; the end date is re-checked here so a stale cache cannot
 * extend a delegation.
 */
export function groupsRepresentedBy(
  projection: RepresentationProjection | null,
  user: { id: string; email: string | null | undefined },
  today: string,
): Array<RepresentationGroup & { myRole: "primary" | "backup"; myScopes: string[]; myResponsibilities: string[]; myEffectiveUntil: string | null }> {
  if (!projection?.active) return [];
  const email = (user.email || "").trim().toLowerCase();
  const out = [];
  for (const group of projection.groups) {
    const mine = group.representatives.find(
      (r) =>
        isLive(r, today) &&
        ((r.portalUserId != null && r.portalUserId === user.id) ||
          (r.portalUserId == null && email !== "" && (r.email || "").trim().toLowerCase() === email)),
    );
    if (!mine) continue;
    out.push({
      ...group,
      myRole: mine.role,
      myScopes: mine.communicationScopes,
      myResponsibilities: mine.responsibilities,
      myEffectiveUntil: mine.effectiveUntil,
    });
  }
  return out;
}

/** Co-representatives are shown by name and role only: no contact details of other people. */
export function publicGroupView(group: ReturnType<typeof groupsRepresentedBy>[number]) {
  return {
    scopeKey: group.scopeKey,
    kind: group.kind,
    name: group.name,
    myRole: group.myRole,
    myScopes: group.myScopes,
    myResponsibilities: group.myResponsibilities,
    myEffectiveUntil: group.myEffectiveUntil,
    representatives: group.representatives.map((r) => ({ role: r.role, displayName: r.displayName })),
    allowedKinds: GROUP_REQUEST_KINDS.filter((k) => group.myScopes.includes(k.scope)).map((k) => k.key),
  };
}

import { portalFetch } from "@/lib/portalApi";
import type { ImportRowPlan, OrgProfile, RoutingPerson, RoutingUnit, SupportTier, UnitKind } from "@shared/orgDirectory";
import type { ServiceRequestRecord } from "@shared/serviceRequests";

/** Company structure, people directory and service request approvals (server/orgDirectoryRoutes.ts, serviceRequestRoutes.ts). */

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await portalFetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`) as Error & { fieldErrors?: Record<string, string> };
    err.fieldErrors = body.fieldErrors;
    throw err;
  }
  return body as T;
}

const put = (body: unknown): RequestInit => ({ method: "PUT", body: JSON.stringify(body) });
const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

type Who = RoutingPerson & { awayUntil: string | null };

export type MyDirectoryCard = {
  structure: "site" | "department";
  companyIdLabel: string;
  /** Null for a DE admin viewing a company they are not part of. */
  me: null | { userId: string; name: string; personId: string; dePersonId: string; companyPersonId: string | null; supportTier: SupportTier; awayUntil: string | null };
  unit: RoutingUnit | null;
  leader: Who | null;
  backup: Who | null;
  leads: Array<{ unitKind: UnitKind; unitId: string; name: string; role: "leader" | "backup" }>;
  canManage: boolean;
};

export type DirectoryUnit = { kind: UnitKind; id: string; name: string; code?: string; leaderUserId: string | null; backupUserId: string | null; ccLeader: boolean };

export type DirectoryPerson = {
  userId: string;
  name: string;
  email: string;
  personId: string;
  dePersonId: string;
  companyPersonId: string | null;
  siteId: string | null;
  departmentId: string | null;
  supportTier: SupportTier;
  awayUntil: string | null;
  isItContact: boolean;
};

export type Directory = {
  profile: OrgProfile;
  units: DirectoryUnit[];
  sites: Array<{ kind: "site"; id: string; name: string; code?: string }>;
  departments: Array<{ kind: "department"; id: string; name: string }>;
  people: DirectoryPerson[];
};

export type ImportResult = {
  applied: number;
  columns: Record<string, number>;
  rows: ImportRowPlan[];
  errors: string[];
  rowErrors: number;
  canApply: boolean;
};

export const directoryApi = {
  me: () => request<MyDirectoryCard>("/api/portal/directory/me"),
  setMyAvailability: (awayUntil: string | null) => request<{ awayUntil: string | null }>("/api/portal/directory/me/availability", put({ awayUntil })),
  directory: () => request<Directory>("/api/portal/directory"),
  saveProfile: (profile: OrgProfile) => request<{ profile: OrgProfile }>("/api/portal/directory/profile", put({ profile })),
  saveLeader: (l: { unitKind: UnitKind; unitId: string; leaderUserId: string | null; backupUserId: string | null; ccLeader: boolean }) =>
    request("/api/portal/directory/leaders", put(l)),
  savePerson: (userId: string, patch: Partial<Pick<DirectoryPerson, "companyPersonId" | "siteId" | "supportTier" | "awayUntil">>) =>
    request(`/api/portal/directory/people/${encodeURIComponent(userId)}`, put(patch)),
  importCsv: (csv: string, apply: boolean) => request<ImportResult>("/api/portal/directory/import", post({ csv, apply })),

  approvals: () => request<{ pending: ServiceRequestRecord[]; decided: ServiceRequestRecord[] }>("/api/portal/service-requests/approvals"),
  decide: (id: string, decision: "approve" | "reject", note: string) =>
    request<{ request: ServiceRequestRecord }>(`/api/portal/service-requests/${encodeURIComponent(id)}/approval`, post({ decision, note })),
};

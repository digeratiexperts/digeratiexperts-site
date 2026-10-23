import { portalFetch } from "@/lib/portalApi";
import type { RoadmapItem, RoadmapItemInput, RoadmapSummary } from "@shared/roadmap";

/** Client calls for the IT Roadmap (server/roadmapRoutes.ts). */

export type RoadmapView = { company: { id: string; name: string }; items: RoadmapItem[]; summary: RoadmapSummary };

export class RoadmapApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await portalFetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new RoadmapApiError(body.error || `Request failed (${res.status})`, res.status, body.code, body.fieldErrors || {});
  return body as T;
}
const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });
const admin = (companyId: string) => `/api/portal/admin/companies/${encodeURIComponent(companyId)}/roadmap`;

export const ROADMAP_QUERY_KEY = ["/api/portal/roadmap"] as const;
export const adminRoadmapKey = (companyId: string) => ["/api/portal/admin/companies", companyId, "roadmap"] as const;

export const roadmapApi = {
  view: () => request<RoadmapView & { canDecide: boolean }>("/api/portal/roadmap"),
  decide: (id: string, decision: "approved" | "declined", note: string) =>
    request<{ item: RoadmapItem }>(`/api/portal/roadmap/${encodeURIComponent(id)}/decision`, json("POST", { decision, note })),
  comment: (id: string, body: string) => request<{ item: RoadmapItem }>(`/api/portal/roadmap/${encodeURIComponent(id)}/comments`, json("POST", { body })),
  adminView: (companyId: string) => request<RoadmapView>(admin(companyId)),
  create: (companyId: string, input: RoadmapItemInput) => request<{ item: RoadmapItem }>(admin(companyId), json("POST", input)),
  edit: (companyId: string, id: string, patch: Partial<RoadmapItemInput>) =>
    request<{ item: RoadmapItem }>(`${admin(companyId)}/${encodeURIComponent(id)}`, json("PATCH", patch)),
  remove: (companyId: string, id: string) => request<{ success: true }>(`${admin(companyId)}/${encodeURIComponent(id)}`, json("DELETE")),
  adminComment: (companyId: string, id: string, body: string) =>
    request<{ item: RoadmapItem }>(`${admin(companyId)}/${encodeURIComponent(id)}/comments`, json("POST", { body })),
};

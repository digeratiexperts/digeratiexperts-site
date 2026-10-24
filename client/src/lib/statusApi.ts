import { portalFetch } from "@/lib/portalApi";
import type { NoticeInput, StatusNotice, StatusView } from "@shared/statusNotices";

/** Client calls for System Status (server/statusNoticeRoutes.ts). */

export type ClientNotice = Omit<StatusNotice, "clientId"> & { forAllClients: boolean };
export type ClientStatusView = Omit<StatusView, "active" | "inProgress" | "upcoming" | "history"> & {
  active: ClientNotice[];
  inProgress: ClientNotice[];
  upcoming: ClientNotice[];
  history: ClientNotice[];
};
export type AdminNotice = StatusNotice & { companyName: string | null };

export class StatusApiError extends Error {
  constructor(message: string, public status: number, public fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await portalFetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new StatusApiError(body.error || `Request failed (${res.status})`, res.status, body.fieldErrors || {});
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });

export const STATUS_QUERY_KEY = ["/api/portal/status"] as const;
export const ADMIN_NOTICES_QUERY_KEY = ["/api/portal/admin/status-notices"] as const;

export const statusApi = {
  view: () => request<ClientStatusView & { success: true }>("/api/portal/status"),
  adminList: () => request<{ notices: AdminNotice[] }>("/api/portal/admin/status-notices"),
  create: (input: NoticeInput) => request<{ notice: AdminNotice }>("/api/portal/admin/status-notices", json("POST", input)),
  edit: (id: string, patch: Partial<NoticeInput> & { reopen?: boolean }) =>
    request<{ notice: AdminNotice }>(`/api/portal/admin/status-notices/${encodeURIComponent(id)}`, json("PATCH", patch)),
  postUpdate: (id: string, body: string, resolve: boolean) =>
    request<{ notice: AdminNotice }>(`/api/portal/admin/status-notices/${encodeURIComponent(id)}/updates`, json("POST", { body, resolve })),
  remove: (id: string) => request<{ success: true }>(`/api/portal/admin/status-notices/${encodeURIComponent(id)}`, json("DELETE")),
};

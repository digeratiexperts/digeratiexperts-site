import { portalFetch } from "@/lib/portalApi";
import type {
  FieldErrors,
  ServiceRequestAsset,
  ServiceRequestRecord,
  ServiceRequestSite,
  ServiceRequestType,
} from "@shared/serviceRequests";

/** Portal service request API client (server/serviceRequestRoutes.ts). */

export const SR_BASE = "/api/portal/service-requests";

export class ServiceRequestApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: FieldErrors = {},
    public body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await portalFetch(url, init);
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text };
  }
  if (!res.ok) {
    throw new ServiceRequestApiError(body.error || body.message || `Request failed (${res.status})`, res.status, body.fieldErrors || {}, body);
  }
  return body as T;
}

export type ServiceRequestContext = {
  company: { id: string; name: string };
  me: { userId: string; name: string; email: string } | null;
  sites: ServiceRequestSite[];
  defaultSiteId: string | null;
};

export type PersonOption = { userId: string; name: string; email: string };

export const srApi = {
  context: () => request<ServiceRequestContext & { success: true }>(`${SR_BASE}/context`),
  people: (q: string) => request<{ people: PersonOption[] }>(`${SR_BASE}/people?q=${encodeURIComponent(q)}`),
  assets: (userId: string) =>
    request<{ assets: ServiceRequestAsset[] }>(`${SR_BASE}/assets?userId=${encodeURIComponent(userId)}`),
  list: () => request<{ requests: ServiceRequestRecord[] }>(SR_BASE),
  basket: () => request<{ requests: ServiceRequestRecord[] }>(`${SR_BASE}/basket`),
  get: (id: string) => request<{ request: ServiceRequestRecord }>(`${SR_BASE}/${encodeURIComponent(id)}`),
  create: (type: ServiceRequestType, fields: Record<string, unknown>, mode: "submit" | "basket") =>
    request<{ request: ServiceRequestRecord }>(SR_BASE, { method: "POST", body: JSON.stringify({ type, fields, mode }) }),
  submitBasket: () =>
    request<{ requests: ServiceRequestRecord[] }>(`${SR_BASE}/basket/submit`, { method: "POST", body: "{}" }),
  cancel: (id: string, note?: string) =>
    request<{ request: ServiceRequestRecord }>(`${SR_BASE}/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  team: () => request<{ requests: ServiceRequestRecord[] }>(`${SR_BASE}/team`),
  hold: (id: string, until: string, reason: string) =>
    request<{ request: ServiceRequestRecord }>(`${SR_BASE}/${encodeURIComponent(id)}/hold`, { method: "POST", body: JSON.stringify({ until, reason }) }),
  resume: (id: string, note?: string) =>
    request<{ request: ServiceRequestRecord }>(`${SR_BASE}/${encodeURIComponent(id)}/resume`, { method: "POST", body: JSON.stringify({ note }) }),
  amend: (id: string, fields: Record<string, unknown>, revision: number, note?: string) =>
    request<{ request: ServiceRequestRecord; unchanged?: boolean }>(`${SR_BASE}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ fields, revision, note }),
    }),
  attach: (id: string, file: File) =>
    request<{ attachment: { id: string; fileName: string } }>(`${SR_BASE}/${encodeURIComponent(id)}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-Filename": encodeURIComponent(file.name) },
      body: file,
    }),
  attachmentUrl: (id: string, attachmentId: string) =>
    `${SR_BASE}/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
};

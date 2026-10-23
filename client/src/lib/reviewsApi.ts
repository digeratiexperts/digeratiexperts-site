import { portalFetch } from "@/lib/portalApi";
import type { BusinessReview, ClientBusinessReview, ReviewInput } from "@shared/businessReviews";

/** Client calls for business reviews (server/businessReviewRoutes.ts). */

export class ReviewsApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await portalFetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ReviewsApiError(body.error || `Request failed (${res.status})`, res.status, body.code, body.fieldErrors || {});
  return body as T;
}
const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });
const admin = (companyId: string) => `/api/portal/admin/companies/${encodeURIComponent(companyId)}/business-reviews`;

export const REVIEWS_QUERY_KEY = ["/api/portal/business-reviews"] as const;
export const adminReviewsKey = (companyId: string) => ["/api/portal/admin/companies", companyId, "business-reviews"] as const;

export const reviewsApi = {
  list: () => request<{ company: { id: string; name: string }; reviews: ClientBusinessReview[] }>("/api/portal/business-reviews"),
  adminList: (companyId: string) => request<{ company: { id: string; name: string }; reviews: BusinessReview[] }>(admin(companyId)),
  create: (companyId: string, input: ReviewInput) => request<{ review: BusinessReview }>(admin(companyId), json("POST", input)),
  edit: (companyId: string, id: string, patch: Partial<ReviewInput>) =>
    request<{ review: BusinessReview }>(`${admin(companyId)}/${encodeURIComponent(id)}`, json("PATCH", patch)),
  remove: (companyId: string, id: string) => request<{ success: true }>(`${admin(companyId)}/${encodeURIComponent(id)}`, json("DELETE")),
};

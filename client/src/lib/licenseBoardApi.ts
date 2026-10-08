import { portalFetch } from "@/lib/portalApi";
import type { CompanySeatSummary, PoolItemSummary } from "@shared/licenseBoard";
import type { CatalogLicense } from "@shared/licensing";
import type { SHELF_CATEGORIES, ShelfEntry } from "@shared/licenseShelf";

/** License patch bay API client (server/licenseBoardRoutes.ts). DE admin only. */

const BASE = "/api/portal/admin/license-board";

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await portalFetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

const send = <T>(url: string, method: string, data?: unknown) =>
  request<T>(url, { method, body: data === undefined ? undefined : JSON.stringify(data) });

export type BoardCompany = { id: string; name: string; seats: CompanySeatSummary[] };
export type Board = { items: PoolItemSummary[]; clients: BoardCompany[]; catalog: CatalogLicense[] };

export type HeldLicense = { assignmentId: string; itemId: string; viaDepartmentId: string | null };
export type Shelf = {
  categories: Array<(typeof SHELF_CATEGORIES)[number]>;
  hubConnected: boolean;
  entries: ShelfEntry[];
};

export type NewPoolItem = {
  kind?: "license" | "app";
  vendor?: string;
  product?: string;
  category?: string;
  catalogKey?: string | null;
  sku?: string | null;
  chocoPackage?: string | null;
  quantity: number;
};

export type CompanyBoard = {
  company: { id: string; name: string };
  pool: Array<
    CompanySeatSummary & { kind: "license" | "app"; vendor: string; product: string; category: string; chocoPackage: string | null }
  >;
  departments: Array<{ id: string; name: string; seats: Array<{ itemId: string; count: number }> }>;
  people: Array<{ id: string; name: string; email: string; departmentId: string | null; licenses: HeldLicense[] }>;
  devices: Array<{ id: string; label: string; licenses: HeldLicense[] }>;
};

export const licenseBoardApi = {
  board: () => request<Board>(BASE),
  shelf: () => request<Shelf>(`${BASE}/shelf`),
  addItem: (input: NewPoolItem) => send<{ item: PoolItemSummary }>(`${BASE}/items`, "POST", input),
  setQuantity: (id: string, quantity: number) => send(`${BASE}/items/${encodeURIComponent(id)}`, "PUT", { quantity }),
  removeItem: (id: string) => send(`${BASE}/items/${encodeURIComponent(id)}`, "DELETE"),
  allocate: (itemId: string, clientId: string, quantity = 1) =>
    send<{ fromPool: number; toOrder: number; app?: boolean; company: string; product: string }>(`${BASE}/allocate`, "POST", {
      itemId,
      clientId,
      quantity,
    }),
  release: (itemId: string, clientId: string) =>
    send<{ released: "pool" | "order" }>(`${BASE}/release`, "POST", { itemId, clientId }),
  company: (clientId: string) => request<CompanyBoard>(`${BASE}/clients/${encodeURIComponent(clientId)}`),
  assign: (
    clientId: string,
    input: { itemId: string; targetType: "department" | "user" | "device"; targetId?: string; label?: string; fromDepartmentId?: string },
  ) => send(`${BASE}/clients/${encodeURIComponent(clientId)}/assign`, "POST", input),
  unassign: (clientId: string, assignmentId: string) =>
    send<{ returnedTo: "department" | "company" }>(
      `${BASE}/clients/${encodeURIComponent(clientId)}/assignments/${encodeURIComponent(assignmentId)}`,
      "DELETE",
    ),
};

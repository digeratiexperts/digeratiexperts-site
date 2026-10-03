import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage/routes";

/**
 * Regression guards for #250 (raw Zoho proxy routes) and #237 (object storage).
 * A new `/api/zoho/*` route is admin-only unless it is explicitly listed here
 * as public or self-scoped, so a collection-vs-object mismatch cannot reappear.
 */

const PUBLIC = new Set(["GET /api/zoho/status", "GET /api/zoho/oauth/callback"]);

// Self-scoped: each handler resolves the caller's own Desk contact / Billing customer from the session email.
const SELF_SCOPED = new Set([
  "GET /api/zoho/desk/tickets/:id", // non-admins must own the ticket (contactId check in the handler)
  "POST /api/zoho/desk/tickets",
  "GET /api/zoho/desk/my-tickets",
  "GET /api/zoho/desk/departments",
  "GET /api/zoho/billing/my-subscription",
  "GET /api/zoho/billing/my-invoices",
  "GET /api/zoho/billing/plans",
]);

function zohoRoutes() {
  const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const routes: Array<{ key: string; guards: string }> = [];
  const re = /app\.(get|post|put|patch|delete)\(\s*("\/api\/zoho\/[^"]*"|[A-Za-z_]+),\s*(\[[^\]]*\]|[A-Za-z_]+)?/g;
  for (const m of src.matchAll(re)) {
    if (!m[2].startsWith('"')) continue;
    routes.push({ key: `${m[1].toUpperCase()} ${m[2].slice(1, -1)}`, guards: m[3] ?? "" });
  }
  return routes;
}

describe("raw Zoho routes are admin-gated unless explicitly allowlisted (#250)", () => {
  const routes = zohoRoutes();

  it("finds the Zoho routes", () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it("every non-allowlisted /api/zoho route requires requireAdmin", () => {
    const open = routes.filter((r) => !PUBLIC.has(r.key) && !SELF_SCOPED.has(r.key) && !r.guards.includes("requireAdmin"));
    expect(open.map((r) => r.key)).toEqual([]);
  });

  it("self-scoped and public routes still require authentication, except the listed public ones", () => {
    const unauth = routes.filter((r) => SELF_SCOPED.has(r.key) && !r.guards.includes("authMiddleware"));
    expect(unauth.map((r) => r.key)).toEqual([]);
  });

  it("collection and object-by-id routes agree: CRM accounts/:id and the list are both admin-only", () => {
    const byKey = new Map(routes.map((r) => [r.key, r.guards]));
    expect(byKey.get("GET /api/zoho/crm/accounts")).toContain("requireAdmin");
    expect(byKey.get("GET /api/zoho/crm/accounts/:id")).toContain("requireAdmin");
    expect(byKey.get("GET /api/zoho/desk/tickets")).toContain("requireAdmin");
  });

  it("the allowlist has no stale entries", () => {
    const keys = new Set(routes.map((r) => r.key));
    for (const k of [...PUBLIC, ...SELF_SCOPED]) expect(keys.has(k), k).toBe(true);
  });

  it("Desk ticket-by-id refuses a non-admin whose Desk contact does not own the ticket", () => {
    const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    const start = src.indexOf('app.get("/api/zoho/desk/tickets/:id"');
    const handler = src.slice(start, src.indexOf("\n  });", start));
    expect(handler).toContain('req.user?.role !== "admin"');
    expect(handler).toContain("ticket.contactId !== contact.id");
    expect(handler).toContain("403");
  });
});

describe("object storage routes are guarded (#237)", () => {
  it("upload is auth + admin, and object reads are auth + admin", () => {
    const routes = new Map<string, unknown[]>();
    const app: any = {
      get: (path: string, ...h: unknown[]) => routes.set(`GET ${path}`, h),
      post: (path: string, ...h: unknown[]) => routes.set(`POST ${path}`, h),
    };
    const auth = vi.fn();
    const admin = vi.fn();
    registerObjectStorageRoutes(app, { auth, admin });
    expect([...routes.keys()].sort()).toEqual(["GET /objects/:objectPath(*)", "POST /api/uploads/request-url"]);
    for (const handlers of routes.values()) {
      expect(handlers[0]).toBe(auth);
      expect(handlers[1]).toBe(admin);
    }
  });

  it("the server mounts object storage with the portal guards, never bare", () => {
    const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    expect(src).toContain("registerObjectStorageRoutes(app, { auth: authMiddleware, admin: requireAdmin })");
    expect(src).not.toMatch(/registerObjectStorageRoutes\(app\)/);
  });
});

import type { Express, Request, RequestHandler, Response } from "express";
import { createDepartment, findUserById, updateDepartment } from "./portalOrg";

/**
 * Department writes from the client portal's People page.
 *
 * Lifted out of routes.ts so the tenant boundary can be tested over real HTTP
 * (issue #254). A Company IT Contact manages departments, but only their own
 * company's. Before this module the update route followed whatever clientId
 * the request body named, so an IT Contact could rename another company's
 * department; and both routes would attach a user from another company as a
 * department's IT contact.
 */

export const DEPARTMENTS_PATH = "/api/portal/org/departments";

type Caller = { role?: string | null; clientId?: string | null } | undefined;
type PortalRequest = Request & { user?: Caller };

export type DepartmentWrite =
  | { ok: true; clientId: string; itContactUserId?: string | null }
  | { ok: false; status: number; error: string };

/**
 * Which company a department write may touch, and the IT contact it may name.
 *
 * A non-admin is pinned to their own company: a body clientId naming any other
 * company is refused, never followed. A DE admin may name the company. The IT
 * contact, when given, must be a user of that same company; null or "" clears
 * it, and leaving it out leaves it unchanged.
 */
export function decideDepartmentWrite(
  caller: Caller,
  body: { clientId?: unknown; itContactUserId?: unknown } | undefined,
  lookupUser: (id: string) => { clientId?: string | null } | null = findUserById,
): DepartmentWrite {
  const isAdmin = caller?.role === "admin";
  const own = typeof caller?.clientId === "string" && caller.clientId ? caller.clientId : null;
  if (!own && !isAdmin) return { ok: false, status: 400, error: "No client associated" };

  const named = typeof body?.clientId === "string" && body.clientId.trim() ? body.clientId.trim() : null;
  if (!isAdmin && named && named !== own) return { ok: false, status: 403, error: "Forbidden" };
  const clientId = isAdmin ? named || own : own;
  if (!clientId) return { ok: false, status: 400, error: "clientId required" };

  const contactId = body?.itContactUserId;
  if (contactId === undefined) return { ok: true, clientId };
  if (contactId === null || contactId === "") return { ok: true, clientId, itContactUserId: null };
  if (typeof contactId !== "string") {
    return { ok: false, status: 400, error: "itContactUserId must be a user id" };
  }
  const contact = lookupUser(contactId);
  if (!contact || contact.clientId !== clientId) {
    return { ok: false, status: 400, error: "The IT contact must be a user in the same company" };
  }
  return { ok: true, clientId, itContactUserId: contactId };
}

export interface DepartmentRouteOptions {
  /** authMiddleware, requireOrgManage and validateInput in production; tests pass stand-ins. */
  guards: RequestHandler[];
}

export function registerPortalDepartmentRoutes(app: Express, { guards }: DepartmentRouteOptions): void {
  app.post(DEPARTMENTS_PATH, guards, async (req: PortalRequest, res: Response) => {
    try {
      const write = decideDepartmentWrite(req.user, req.body);
      if (!write.ok) return res.status(write.status).json({ error: write.error });
      const name = String(req.body?.name || "").trim();
      if (!name) return res.status(400).json({ error: "Department name required" });
      const dept = await createDepartment(write.clientId, name, write.itContactUserId ?? null);
      res.status(201).json({ success: true, department: dept });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch(`${DEPARTMENTS_PATH}/:id`, guards, async (req: PortalRequest, res: Response) => {
    try {
      const write = decideDepartmentWrite(req.user, req.body);
      if (!write.ok) return res.status(write.status).json({ error: write.error });
      // updateDepartment matches id AND clientId, so another company's department is "not found".
      const dept = await updateDepartment(req.params.id, write.clientId, {
        name: req.body?.name,
        itContactUserId: write.itContactUserId,
      });
      if (!dept) return res.status(404).json({ error: "Department not found" });
      res.json({ success: true, department: dept });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

import type { Express, Request, Response } from "express";
import {
  CLIENT_ROLES,
  ENTITLEMENT_KEYS,
  effectiveClientRoles,
  type ClientRole,
  type EntitlementKey,
} from "@shared/permissions";
import { requirePermission } from "./portalAccess";
import { getEntitlements, listEntitlementRecords, setEntitlement } from "./portalAccessStore";

/**
 * Lane A (Wave 1): DE staff manage a company's purchased-service entitlements and
 * its users' client hats. Both are OFF/empty by default — no entitlement exists
 * until it is granted here (lane-a-update-2.md §3), and no hat is granted without
 * an explicit row (the legacy org-role derivation in shared/permissions still
 * applies so nobody loses access).
 */

type AnyReq = Request & { user?: any; userId?: string };

export type PortalAccessRouteDeps = {
  auth: (req: any, res: any, next: any) => void;
  validateInput: (req: any, res: any, next: any) => void;
  findUserById: (id: string) => any;
  listClientUsers: (clientId: string) => any[];
  commitUser: (user: any) => Promise<void>;
};

function isEntitlementKey(value: unknown): value is EntitlementKey {
  return typeof value === "string" && (ENTITLEMENT_KEYS as readonly string[]).includes(value);
}

function isClientRole(value: unknown): value is ClientRole {
  return typeof value === "string" && (CLIENT_ROLES as readonly string[]).includes(value);
}

function fail(res: Response, error: any): void {
  if (error?.name === "PortalPersistenceError") {
    res.status(503).json({
      code: error.code || "PERSISTENCE_FAILED",
      error: "We could not save that change just now. Nothing was changed; please try again in a moment.",
    });
    return;
  }
  res.status(500).json({ error: error?.message || "Unexpected error" });
}

function publicUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    orgRole: user.orgRole || "staff",
    isCompanyItContact: !!user.isCompanyItContact,
    clientRoles: Array.isArray(user.clientRoles) ? user.clientRoles.filter(isClientRole) : [],
    effectiveClientRoles: effectiveClientRoles({
      role: user.role,
      orgRole: user.orgRole,
      isCompanyItContact: user.isCompanyItContact,
      clientId: user.clientId,
      clientRoles: Array.isArray(user.clientRoles) ? user.clientRoles.filter(isClientRole) : [],
    }),
  };
}

export function registerPortalAccessRoutes(app: Express, deps: PortalAccessRouteDeps) {
  const targetCompany = (req: AnyReq) => (req.params?.companyId as string) || null;

  // --- Entitlements (one rule per company+key; default off) ---

  app.get(
    "/api/portal/admin/companies/:companyId/entitlements",
    [deps.auth, requirePermission("entitlements.manage", targetCompany)],
    async (req: AnyReq, res: Response) => {
      try {
        const companyId = targetCompany(req)!;
        const [records, held] = await Promise.all([
          listEntitlementRecords(companyId),
          getEntitlements(companyId),
        ]);
        res.json({ success: true, entitlements: records, held });
      } catch (error: any) {
        fail(res, error);
      }
    },
  );

  app.put(
    "/api/portal/admin/companies/:companyId/entitlements",
    [deps.auth, requirePermission("entitlements.manage", targetCompany), deps.validateInput],
    async (req: AnyReq, res: Response) => {
      try {
        const companyId = targetCompany(req)!;
        const { entitlement, status } = req.body ?? {};
        if (!isEntitlementKey(entitlement)) {
          return res.status(400).json({ error: "Unknown entitlement" });
        }
        if (status !== "active" && status !== "ended") {
          return res.status(400).json({ error: "status must be active or ended" });
        }
        const record = await setEntitlement({
          clientId: companyId,
          entitlement,
          status,
          grantedBy: req.user?.id ?? null,
        });
        const held = await getEntitlements(companyId);
        res.json({ success: true, entitlement: record, held });
      } catch (error: any) {
        fail(res, error);
      }
    },
  );

  // --- Client hats per user ---

  app.get(
    "/api/portal/admin/companies/:companyId/client-roles",
    [deps.auth, requirePermission("clientRoles.manage", targetCompany)],
    async (req: AnyReq, res: Response) => {
      try {
        const companyId = targetCompany(req)!;
        const users = deps.listClientUsers(companyId).map((u) => publicUser(u));
        res.json({ success: true, users });
      } catch (error: any) {
        fail(res, error);
      }
    },
  );

  app.put(
    "/api/portal/admin/companies/:companyId/client-roles",
    [deps.auth, requirePermission("clientRoles.manage", targetCompany), deps.validateInput],
    async (req: AnyReq, res: Response) => {
      try {
        const companyId = targetCompany(req)!;
        const { userId, clientRoles } = req.body ?? {};
        if (!userId || !Array.isArray(clientRoles) || !clientRoles.every(isClientRole)) {
          return res.status(400).json({ error: "userId and valid clientRoles are required" });
        }
        const live = deps.findUserById(String(userId));
        if (!live) return res.status(404).json({ error: "User not found" });
        if (live.clientId !== companyId) {
          // A user's hats belong to its own company; never cross the tenant line.
          return res.status(404).json({ error: "User not found in this company" });
        }
        await deps.commitUser({ ...live, clientRoles: [...new Set(clientRoles)] });
        const updated = deps.findUserById(String(userId)) || live;
        res.json({ success: true, user: publicUser(updated) });
      } catch (error: any) {
        fail(res, error);
      }
    },
  );
}

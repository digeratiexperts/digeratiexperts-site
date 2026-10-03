import type { Express, Request, RequestHandler, Response } from "express";
import type { IStorage } from "./storage";

/**
 * Tenant file routes for the client portal (#259).
 *
 * Lifted out of routes.ts unchanged in behaviour so the tenant boundary can
 * be exercised over real HTTP, the same way portalDepartmentRoutes is (#254).
 * Metadata lives in portal_tenant_files (DatabaseStorage); the bytes live in
 * object storage and are served only by GET /objects/... behind
 * authorizeObjectRead, which asks `resolveTenantOwnerClientId` below who owns
 * a path. Invariants kept from main:
 *
 * - list/upload/delete by company id are DE-admin only (requireAdmin);
 * - /api/portal/my-files lists only the caller's own company (an admin may
 *   view an impersonated company; the auth middleware already strips
 *   impersonation from non-admins, and this module refuses it again);
 * - file-URL ownership resolves through storage.findTenantFileByFileUrl, so a
 *   path registered to company A never authorizes company B;
 * - a deleted file is gone from every list and no longer resolves an owner
 *   (DatabaseStorage soft-deletes, MemStorage removes).
 *
 * Added by #259: delete is scoped to the company in the URL, so a file id of
 * another company is a 404 and nothing is deleted.
 */

type TenantFileStorage = Pick<
  IStorage,
  "getTenantFilesByClientId" | "findTenantFileByFileUrl" | "createTenantFile" | "deleteTenantFile"
>;

type Caller = {
  id?: string;
  email?: string;
  role?: string | null;
  impersonatingCompanyId?: string | null;
};

type TenantFileRequest = Request & { userId?: string; user?: Caller };

export type TenantFileRouteDeps = {
  auth: RequestHandler;
  admin: RequestHandler;
  validateInput: RequestHandler;
  storage: TenantFileStorage;
  /** Portal company by id (portal auth store). */
  getCompany: (id: string) => { companyName?: string } | undefined | null;
  /** Portal user by email (portal auth store). */
  getUserByEmail: (email: string) => { clientId?: string | null } | undefined | null;
  logSecurityEvent: (event: string, req: any, data: Record<string, unknown>) => void;
};

/**
 * Who owns an object path, for registerObjectStorageRoutes. Null (deny unless
 * admin / ACL owner) when no live tenant file row names the path.
 */
export function tenantOwnerResolver(storage: Pick<IStorage, "findTenantFileByFileUrl">) {
  return async (objectPath: string): Promise<string | null> => {
    const file = await storage.findTenantFileByFileUrl(objectPath);
    return file?.clientId ?? null;
  };
}

export function registerPortalTenantFileRoutes(app: Express, deps: TenantFileRouteDeps): void {
  const { auth, admin, validateInput, storage, getCompany, getUserByEmail, logSecurityEvent } = deps;

  // Get tenant-specific files for a company (admin only)
  app.get("/api/portal/admin/companies/:id/files", [auth, admin], async (req: TenantFileRequest, res: Response) => {
    try {
      const company = getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Get tenant files from storage - scoped to this company
      const tenantFiles = await storage.getTenantFilesByClientId(req.params.id);

      res.json({ files: tenantFiles });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get files for current user's company (regular users + admin impersonation)
  app.get("/api/portal/my-files", [auth], async (req: TenantFileRequest, res: Response) => {
    try {
      let clientId: string | null = null;
      let companyName: string = "";

      // Check if admin is impersonating a company (never honoured for non-admins)
      const impersonatingCompanyId =
        req.user?.role === "admin" ? req.user?.impersonatingCompanyId : null;
      if (impersonatingCompanyId) {
        const company = getCompany(impersonatingCompanyId);
        if (company) {
          clientId = impersonatingCompanyId;
          companyName = company.companyName || "";
        }
      } else {
        // Regular user - get their company
        const user = getUserByEmail(req.user?.email || "");
        if (user && user.clientId) {
          const company = getCompany(user.clientId);
          if (company) {
            clientId = user.clientId;
            companyName = company.companyName || "";
          }
        }
      }

      if (!clientId) {
        return res.json({ files: [], companyName: "Your Company" });
      }

      // Get tenant files from storage
      const tenantFiles = await storage.getTenantFilesByClientId(clientId);

      res.json({ files: tenantFiles, companyName });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload file for a tenant (admin only)
  app.post("/api/portal/admin/companies/:id/files", [auth, admin, validateInput], async (req: TenantFileRequest, res: Response) => {
    try {
      const company = getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      const { fileName, fileType, category, description, objectPath } = req.body;

      if (!fileName || !objectPath) {
        return res.status(400).json({ error: "fileName and objectPath are required" });
      }

      const tenantFile = await storage.createTenantFile({
        clientId: req.params.id,
        fileName,
        fileType: fileType || "document",
        category: category || "general",
        description: description || "",
        fileUrl: objectPath,
        uploadedBy: req.userId || "",
      });

      res.json({ success: true, file: tenantFile });
      logSecurityEvent("TENANT_FILE_UPLOADED", req, { companyId: req.params.id, fileName });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete tenant file (admin only)
  app.delete("/api/portal/admin/companies/:companyId/files/:fileId", [auth, admin], async (req: TenantFileRequest, res: Response) => {
    try {
      // Tenant-scoped: a file id from another company is a 404, not a delete.
      const deleted = await storage.deleteTenantFile(req.params.fileId, req.params.companyId, req.userId || undefined);
      if (!deleted) {
        return res.status(404).json({ error: "File not found" });
      }

      res.json({ success: true });
      logSecurityEvent("TENANT_FILE_DELETED", req, { companyId: req.params.companyId, fileId: req.params.fileId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

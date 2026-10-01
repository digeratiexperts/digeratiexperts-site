import type { Express, Request, RequestHandler, Response } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { authorizeObjectRead } from "./objectAccess";

export type ObjectStorageGuards = {
  auth: RequestHandler;
  admin: RequestHandler;
  /**
   * Resolve the portal tenant (client) that owns this object path via
   * portal_tenant_files / equivalent registry. Return null when unknown.
   */
  resolveTenantOwnerClientId?: (objectPath: string) => Promise<string | null>;
};

type AuthedRequest = Request & {
  userId?: string;
  user?: { id?: string; role?: string; clientId?: string | null };
};

/**
 * Register object storage routes for file uploads.
 *
 * Uploads are admin-only. Reads require authentication AND authorization
 * (admin, object ACL owner, or tenant file ownership). Default deny.
 */
export function registerObjectStorageRoutes(
  app: Express,
  guards: ObjectStorageGuards,
): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", guards.auth, guards.admin, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects to an authorized portal session.
   * GET /objects/:objectPath(*)
   */
  app.get("/objects/:objectPath(*)", guards.auth, async (req: AuthedRequest, res: Response) => {
    try {
      const objectPath = req.path;
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

      const userId = req.userId || req.user?.id;
      const aclAllowsUser = userId
        ? await objectStorageService.canAccessObjectEntity({
            userId,
            objectFile,
            requestedPermission: ObjectPermission.READ,
          })
        : false;

      let tenantOwnerClientId: string | null = null;
      if (guards.resolveTenantOwnerClientId) {
        try {
          tenantOwnerClientId = await guards.resolveTenantOwnerClientId(objectPath);
        } catch (lookupError) {
          console.error("Error resolving object tenant owner:", lookupError);
          tenantOwnerClientId = null;
        }
      }

      const decision = authorizeObjectRead(
        {
          userId,
          role: req.user?.role,
          clientId: req.user?.clientId,
        },
        { aclAllowsUser, tenantOwnerClientId },
      );

      if (!decision.allow) {
        console.warn("[SECURITY] OBJECT_READ_DENIED", {
          userId,
          role: req.user?.role,
          clientId: req.user?.clientId,
          objectPath,
          reason: decision.reason,
        });
        return res.status(403).json({ error: "Access denied" });
      }

      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

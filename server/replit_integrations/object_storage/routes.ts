import type {
  Express,
  Request,
  RequestHandler,
  Response,
} from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

type EnvironmentInput = Record<string, string | undefined>;

export const LEGACY_OBJECT_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

const LEGACY_OBJECT_UPLOAD_CONTENT_TYPES = new Set([
  "application/gzip",
  "application/json",
  "application/msword",
  "application/octet-stream",
  "application/pdf",
  "application/vnd.apple.installer+xml",
  "application/vnd.microsoft.portable-executable",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-apple-diskimage",
  "application/x-msdownload",
  "application/x-msi",
  "application/x-tar",
  "application/x-zip-compressed",
  "application/zip",
  "image/jpeg",
  "image/png",
  "text/csv",
  "text/plain",
]);

type ValidatedUploadMetadata = {
  name: string;
  size: number;
  contentType: string;
};

type UploadMetadataValidation =
  | { ok: true; metadata: ValidatedUploadMetadata }
  | { ok: false; error: string };

export function validateLegacyObjectUploadMetadata(
  input: unknown,
): UploadMetadataValidation {
  const value = input && typeof input === "object"
    ? input as Record<string, unknown>
    : {};
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (
    !name ||
    name.length > 255 ||
    name === "." ||
    name === ".." ||
    /[\\/\u0000-\u001f\u007f]/.test(name)
  ) {
    return { ok: false, error: "File name must be a safe base name" };
  }

  const size = value.size;
  if (
    typeof size !== "number" ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > LEGACY_OBJECT_UPLOAD_MAX_BYTES
  ) {
    return {
      ok: false,
      error: `File size must be between 1 and ${LEGACY_OBJECT_UPLOAD_MAX_BYTES} bytes`,
    };
  }

  const contentType = typeof value.contentType === "string"
    ? value.contentType.trim().toLowerCase()
    : "";
  if (!LEGACY_OBJECT_UPLOAD_CONTENT_TYPES.has(contentType)) {
    return { ok: false, error: "File content type is not allowed" };
  }

  return { ok: true, metadata: { name, size, contentType } };
}

function applyTenantObjectDownloadPolicy(res: Response): void {
  res.set({
    "Cache-Control": "private, no-store",
    "Content-Disposition": "attachment",
    "Content-Security-Policy": "sandbox; default-src 'none'; base-uri 'none'; form-action 'none'",
    "Content-Type": "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
}

type ObjectStorageRouteService = Pick<
  ObjectStorageService,
  | "downloadObject"
  | "getObjectEntityFile"
  | "getObjectEntityUploadURL"
  | "normalizeObjectEntityPath"
>;

export type ObjectStorageRouteOptions = {
  enabled: boolean;
  authenticate: RequestHandler;
  authorizeUpload: RequestHandler;
  authorizeDownload: (
    req: Request,
    objectPath: string,
  ) => boolean | Promise<boolean>;
  service?: ObjectStorageRouteService;
};

/**
 * The Replit sidecar adapter is retained only as a temporary compatibility
 * path. Development can use it when configured, but production must opt in
 * explicitly after its portal authorization policy has been wired.
 */
export function isLegacyObjectStorageEnabled(
  env: EnvironmentInput = process.env,
): boolean {
  const environment = env.NODE_ENV?.trim().toLowerCase() || "development";
  if (environment === "development" || environment === "test") return true;
  return env.LEGACY_OBJECT_STORAGE_ENABLED?.trim().toLowerCase() === "true";
}

/**
 * Register the legacy object storage routes behind mandatory authentication
 * and application-owned authorization callbacks.
 *
 * This provides the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * The adapter itself does not know portal tenants. Callers must authenticate
 * every request, restrict uploads, and authorize each requested object path.
 */
export function registerObjectStorageRoutes(
  app: Express,
  options: ObjectStorageRouteOptions,
): void {
  if (!options.enabled) return;

  const objectStorageService = options.service ?? new ObjectStorageService();

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
  app.post(
    "/api/uploads/request-url",
    options.authenticate,
    options.authorizeUpload,
    async (req, res) => {
      try {
        const validation = validateLegacyObjectUploadMetadata(req.body);
        if (!validation.ok) {
          return res.status(400).json({ error: validation.error });
        }
        const { name, size, contentType } = validation.metadata;

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
    },
  );

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * The application authorization callback runs before storage lookup so an
   * unauthorized caller cannot use status differences to enumerate objects.
   */
  app.get(
    "/objects/:objectPath(*)",
    options.authenticate,
    async (req, res) => {
      try {
        const authorized = await options.authorizeDownload(req, req.path);
        if (!authorized) {
          return res.status(404).json({ error: "Object not found" });
        }

        const objectFile = await objectStorageService.getObjectEntityFile(req.path);
        applyTenantObjectDownloadPolicy(res);
        await objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        console.error("Error serving object:", error);
        if (error instanceof ObjectNotFoundError) {
          return res.status(404).json({ error: "Object not found" });
        }
        return res.status(500).json({ error: "Failed to serve object" });
      }
    },
  );
}


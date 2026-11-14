import { canViewClientWide, type OrgUserFields } from "./portalOrg";

export type PortalObjectStorageUser = {
  id?: string | null;
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
  orgRole?: string | null;
  clientId?: string | null;
  departmentId?: string | null;
  managerUserId?: string | null;
  isCompanyItContact?: boolean | null;
  impersonatingCompanyId?: string | null;
};

export type TenantObjectRecord = {
  fileUrl?: string | null;
};

type TenantObjectAuthorizationInput = {
  user?: PortalObjectStorageUser | null;
  objectPath: string;
  listTenantFiles: (clientId: string) => Promise<TenantObjectRecord[]>;
};

/**
 * Authorize a portal download from durable tenant-file metadata.
 *
 * A non-impersonating Digerati administrator may work across tenants. While
 * impersonating, even an administrator is restricted to that tenant so the
 * browser cannot accidentally disclose another customer's object. Live
 * department/company IT contacts are restricted to their own client binding;
 * staff and managers cannot fetch tenant objects directly.
 */
export async function canPortalUserDownloadTenantObject({
  user,
  objectPath,
  listTenantFiles,
}: TenantObjectAuthorizationInput): Promise<boolean> {
  if (!user) return false;

  const impersonatingClientId = user.role === "admin"
    ? user.impersonatingCompanyId?.trim()
    : "";

  if (user.role === "admin" && !impersonatingClientId) return true;

  const hasClientWideAccess = canViewClientWide({
    id: user.id || "portal-object-download",
    email: user.email || "",
    fullName: user.fullName || "Portal user",
    role: user.role || "user",
    orgRole: user.orgRole,
    clientId: user.clientId,
    departmentId: user.departmentId,
    managerUserId: user.managerUserId,
    isCompanyItContact: user.isCompanyItContact,
  } satisfies OrgUserFields);
  if (!hasClientWideAccess) return false;

  const clientId = impersonatingClientId || user.clientId?.trim();
  if (!clientId) return false;

  const tenantFiles = await listTenantFiles(clientId);
  return tenantFiles.some((file) => file.fileUrl === objectPath);
}

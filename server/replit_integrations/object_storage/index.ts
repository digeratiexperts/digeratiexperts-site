export {
  ObjectStorageService,
  ObjectNotFoundError,
  objectStorageClient,
} from "./objectStorage";

export type {
  ObjectAclPolicy,
  ObjectAccessGroup,
  ObjectAccessGroupType,
  ObjectAclRule,
} from "./objectAcl";

export {
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

export {
  isLegacyObjectStorageEnabled,
  LEGACY_OBJECT_UPLOAD_MAX_BYTES,
  registerObjectStorageRoutes,
  validateLegacyObjectUploadMetadata,
} from "./routes";

export type { ObjectStorageRouteOptions } from "./routes";


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

export { registerObjectStorageRoutes } from "./routes";
export type { ObjectStorageGuards } from "./routes";
export { authorizeObjectRead } from "./objectAccess";
export type { ObjectReadSubject, ObjectReadEvidence, ObjectReadDecision } from "./objectAccess";


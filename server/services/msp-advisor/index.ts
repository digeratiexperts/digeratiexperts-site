export { handleAdvisorChat } from "./advisor";
export { getSession, publicSessionView, getOrCreateSession } from "./session";
export { buildLeadSummary } from "./profile";
export { materializeAction, isAllowedActionType, sanitizePath } from "./actions";
export { classifyMode, isPromptInjectionAttempt, isMetaDialogue } from "./classify";
export { selectKnowledgeSlice, getCanonicalPricingKnowledge, DE_COMPANY, COMPLIANCE_DISCLAIMER, inferPageType, listKnownServiceNames } from "./knowledge";
export { extractProfileFromText, mergeProfile, knownFactsList, createEmptyProfile, isInformalCompanyName } from "./profile";
export {
  initDeskChatStore,
  listDeskSessions,
  getDeskSessionMessages,
  getDeskMessagesSince,
  upsertDeskSession,
  appendDeskMessage,
  claimDeskSession,
  releaseDeskSession,
  isDeskAgentLive,
  getDeskStoreStatus,
  AGENT_LIVE_MS,
} from "./persist";
export type { DeskChatRole, DeskChatMessage, DeskChatSessionSummary } from "./persist";
export type * from "./types";
export {
  handlePortalAssistChat,
  portalAssistSessionId,
  sanitizePageInput,
  sanitizeFill,
  materializePortalActions,
  fallbackPortalReply,
  PORTAL_ASSIST_FILLABLE,
} from "./portal-assist";
export type { PortalAssistAction, PortalAssistPage, PortalAssistResponse } from "./portal-assist";

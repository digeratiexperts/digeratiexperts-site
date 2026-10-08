export type AdvisorMode =
  | "msp_discovery"
  | "cybersecurity"
  | "it_support"
  | "compliance"
  | "cloud_m365"
  | "pricing"
  | "assessment"
  | "existing_client"
  | "security_incident"
  | "off_topic";

export type AdvisorActionType =
  | "schedule_consultation"
  | "request_assessment"
  | "contact_sales"
  | "create_lead"
  | "open_portal"
  | "existing_client_support"
  | "request_callback"
  | "navigate"
  | "leave_message";

export type PageType =
  | "home"
  | "cybersecurity"
  | "pricing"
  | "store"
  | "compliance"
  | "service"
  | "industry"
  | "support"
  | "other";

export interface PageContext {
  pathname: string;
  pageTitle?: string;
  pageType: PageType;
  serviceContext?: string;
  campaignSource?: string;
}

export interface ConversationProfile {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  employeeCount?: number;
  siteCount?: number;
  industry?: string;
  location?: string;
  internalIT?: string;
  currentProvider?: string;
  complianceRequirements?: string[];
  currentEnvironment?: string;
  pains: string[];
  priorities: string[];
  timeline?: string;
  prospectOrClient?: "prospect" | "client" | "unknown";
  recommendedServices: string[];
  qualificationConfidence: number;
  decisionRole?: string;
  desiredOutcome?: string;
  /** Joke / declined company — treat as walk-in, do not collapse the thread. */
  companyInformal?: boolean;
  /** Visitor indicated they work at Digerati Experts — not an external company, not a client claim. */
  deInternal?: boolean;
}

export interface AdvisorAction {
  type: AdvisorActionType;
  label: string;
  href?: string;
  path?: string;
  payload?: Record<string, unknown>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: number;
}

export interface AdvisorSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  profile: ConversationProfile;
  lastMode: AdvisorMode;
  analyticsFlags: Record<string, boolean>;
  pageContext?: PageContext;
  /** Substantive first question held until name + company are collected. */
  heldUserMessage?: string;
  /** First real ask — kept after identity so later turns do not forget it. */
  originalIntent?: string;
  /** Visitor asked for a person (Joe, a human, a callback): no name/company gate after that. */
  humanRequested?: boolean;
  /** Visitor's answer to the name question was not a name: never ask for name or company again. */
  nameDeclined?: boolean;
  lastAssistantReply?: string;
  fallbackVariant?: number;
}

export interface AdvisorChatRequest {
  sessionId?: string;
  message: string;
  pageContext?: PageContext;
}

export interface AdvisorChatResponse {
  sessionId: string;
  reply: string;
  mode: AdvisorMode;
  profile: ConversationProfile;
  actions: AdvisorAction[];
  analyticsEvents: string[];
  knownFacts: string[];
  /** True when a portal agent has claimed this session and AI is paused. */
  agentLive?: boolean;
  agentName?: string | null;
  /** Server-persisted assistant/ack message — widget uses these to avoid poll duplicates. */
  messageId?: string;
  messageCreatedAt?: string;
  /** Ask DE should offer Get Support chips under this reply. */
  suggestSupportChips?: boolean;
}

export interface AdvisorActionRequest {
  sessionId: string;
  action: AdvisorActionType;
  payload?: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    message?: string;
    path?: string;
  };
}

export interface ModelAdvisorOutput {
  reply: string;
  mode?: AdvisorMode;
  profilePatch?: Partial<ConversationProfile>;
  proposedActions?: Array<{ type: AdvisorActionType; label?: string; path?: string }>;
  analyticsEvents?: string[];
}

export function emptyProfile(): ConversationProfile {
  return {
    pains: [],
    priorities: [],
    recommendedServices: [],
    complianceRequirements: [],
    qualificationConfidence: 0,
    prospectOrClient: "unknown",
  };
}

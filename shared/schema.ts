import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, pgEnum, decimal, customType, date } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);
export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "in_review", "done", "archived"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member", "viewer"]);
export const viewTypeEnum = pgEnum("view_type", ["board", "list", "calendar", "timeline", "table"]);

// Portal enums
export const portalUserRoleEnum = pgEnum("portal_user_role", ["admin", "user", "viewer"]);

/** Client-org hierarchy (separate from DE portal role + store commerce role) */
export const portalOrgRoleEnum = pgEnum("portal_org_role", [
  "staff",
  "manager",
  "dept_it_contact",
  "company_it_contact",
]);

export const approvalRequestStatusEnum = pgEnum("portal_approval_request_status", [
  "pending",
  "approved",
  "rejected",
  "info_requested",
  "cancelled",
]);

export const approvalStepTypeEnum = pgEnum("portal_approval_step_type", [
  "manager",
  "skip_level",
  "dept_it",
  "company_it",
]);

export const approvalStepStatusEnum = pgEnum("portal_approval_step_status", [
  "pending",
  "approved",
  "rejected",
  "info_requested",
  "skipped",
]);

// Store role enum for RBAC - determines what users can do in the store
// - public: Anonymous visitors (not logged in)
// - prospect: Registered but unverified users
// - managed: Managed service clients (can't purchase managed services, schedule only)
// - comanaged: Co-Managed clients (can purchase co-managed products)
// - admin: Digerati admin (full access)
export const storeRoleEnum = pgEnum("store_role", ["public", "prospect", "managed", "comanaged", "admin"]);

export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "pending_client", "resolved", "closed"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "medium", "high", "critical"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue", "cancelled"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").unique(),
  fullName: text("full_name"),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workspaces table
export const workspaces = pgTable("workspaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workspace members table
export const workspaceMembers = pgTable("workspace_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: memberRoleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Projects table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  defaultView: viewTypeEnum("default_view").default("board"),
  isFavorite: boolean("is_favorite").default(false),
  isArchived: boolean("is_archived").default(false),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Boards/Lists table (columns within a project)
export const boards = pgTable("boards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  position: integer("position").notNull().default(0),
  isCollapsed: boolean("is_collapsed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Labels table
export const labels = pgTable("labels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  boardId: varchar("board_id").references(() => boards.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("todo"),
  priority: taskPriorityEnum("priority").default("medium"),
  position: integer("position").notNull().default(0),
  dueDate: timestamp("due_date"),
  startDate: timestamp("start_date"),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours"),
  assigneeId: varchar("assignee_id").references(() => users.id, { onDelete: "set null" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  parentTaskId: varchar("parent_task_id").references((): any => tasks.id, { onDelete: "set null" }),
  isArchived: boolean("is_archived").default(false),
  customFields: jsonb("custom_fields"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Task labels (many-to-many)
export const taskLabels = pgTable("task_labels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  labelId: varchar("label_id").notNull().references(() => labels.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Comments table
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Attachments table
export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Activity/Audit log table
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  taskId: varchar("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =============== PORTAL TABLES ===============

// Portal clients table
export const portalClients = pgTable("portal_clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  website: text("website"),
  industry: text("industry"),
  employeeCount: integer("employee_count"),
  primaryContact: text("primary_contact"),
  accountManager: text("account_manager"),
  status: text("status").default("active"),
  /** managed | comanaged | prospect — drives storeRole for linked users */
  serviceType: text("service_type").default("prospect"),
  /** Hub accounts.id — canonical commercial identity once mapped */
  hubAccountId: varchar("hub_account_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const syncOutbox = pgTable("sync_outbox", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  version: integer("version").notNull().default(1),
  source: text("source").notNull(),
  destination: text("destination").notNull(),
  occurredAt: timestamp("occurred_at").notNull(),
  correlationId: varchar("correlation_id"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  canonicalAccountId: varchar("canonical_account_id"),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at").notNull(),
  lastError: text("last_error"),
  lockedAt: timestamp("locked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
});

export const syncInbox = pgTable("sync_inbox", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  source: text("source").notNull(),
  canonicalAccountId: varchar("canonical_account_id"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  appliedAt: timestamp("applied_at"),
});

export const syncFailures = pgTable("sync_failures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  direction: text("direction").notNull(),
  eventType: text("event_type").notNull(),
  lastError: text("last_error").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const syncConflicts = pgTable("sync_conflicts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  canonicalAccountId: varchar("canonical_account_id"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  field: text("field").notNull(),
  hubValue: jsonb("hub_value"),
  peerValue: jsonb("peer_value"),
  resolution: text("resolution").notNull().default("hub_wins"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const publicCatalogSnapshots = pgTable("public_catalog_snapshots", {
  id: varchar("id").primaryKey(),
  snapshot: jsonb("snapshot").notNull(),
  sourceVersion: text("source_version"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
});

/** Hub-owned entity state projected for the portal. Key is entityType:entityId. */
export const syncProjections = pgTable("sync_projections", {
  id: varchar("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  canonicalAccountId: varchar("canonical_account_id"),
  eventType: text("event_type").notNull(),
  eventId: varchar("event_id").notNull(),
  payload: jsonb("payload").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

/** Client departments — optional Dept IT Contact per department */
export const portalDepartments = pgTable("portal_departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id")
    .notNull()
    .references(() => portalClients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  itContactUserId: varchar("it_contact_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Records DE staff enter by hand for a client company when a portal page's
 * data source is "manual" (server/portalIntegrations.ts): WireGuard / OpenVPN
 * devices (kind "vpn_device") and staff-entered tracking numbers ("shipment").
 * `data` holds the kind's fields; the server validates its shape.
 */
export const portalManualRecords = pgTable("portal_manual_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id")
    .notNull()
    .references(() => portalClients.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  data: jsonb("data").notNull(),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Portal service requests (migrations/0009_service_requests.sql; shared/serviceRequests.ts). */
export const serviceRequests = pgTable("service_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull().unique(),
  type: text("type").notNull(),
  accountId: varchar("account_id")
    .notNull()
    .references(() => portalClients.id, { onDelete: "cascade" }),
  requestedForUserId: varchar("requested_for_user_id").notNull(),
  submittedByUserId: varchar("submitted_by_user_id").notNull(),
  status: text("status").notNull(),
  payload: jsonb("payload").notNull().default({}),
  siteId: varchar("site_id"),
  site: jsonb("site"),
  customAddress: jsonb("custom_address"),
  statusHistory: jsonb("status_history").notNull().default([]),
  revision: integer("revision").notNull().default(1),
  hubSyncStatus: text("hub_sync_status").notNull().default("not_sent"),
  hubSyncedAt: timestamp("hub_synced_at"),
  hubLastEventId: varchar("hub_last_event_id"),
  deskTicketId: text("desk_ticket_id"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const serviceRequestAttachments = pgTable("service_request_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id")
    .notNull()
    .references(() => serviceRequests.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  data: bytea("data").notNull(),
  uploadedBy: varchar("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

/** Licensing and knowledge base (migrations/0010_licensing_and_kb.sql; shared/licensing.ts, shared/kb.ts). */
export const clientLicensePolicies = pgTable("client_license_policies", {
  clientId: varchar("client_id")
    .primaryKey()
    .references(() => portalClients.id, { onDelete: "cascade" }),
  policy: jsonb("policy").notNull(),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clientUserAccounts = pgTable("client_user_accounts", {
  userId: varchar("user_id").primaryKey(),
  clientId: varchar("client_id")
    .notNull()
    .references(() => portalClients.id, { onDelete: "cascade" }),
  accountType: text("account_type").notNull(),
  tier: text("tier"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clientOrgProfiles = pgTable("client_org_profiles", {
  clientId: varchar("client_id")
    .primaryKey()
    .references(() => portalClients.id, { onDelete: "cascade" }),
  profile: jsonb("profile").notNull(),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Primary key (client_id, unit_kind, unit_id) is in migrations/0011.
export const clientUnitLeaders = pgTable("client_unit_leaders", {
  clientId: varchar("client_id")
    .notNull()
    .references(() => portalClients.id, { onDelete: "cascade" }),
  unitKind: text("unit_kind").notNull(),
  unitId: varchar("unit_id").notNull(),
  leaderUserId: varchar("leader_user_id"),
  backupUserId: varchar("backup_user_id"),
  ccLeader: boolean("cc_leader").notNull().default(true),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clientPeople = pgTable("client_people", {
  userId: varchar("user_id").primaryKey(),
  clientId: varchar("client_id")
    .notNull()
    .references(() => portalClients.id, { onDelete: "cascade" }),
  dePersonId: text("de_person_id").notNull().unique(),
  companyPersonId: text("company_person_id"),
  siteId: varchar("site_id"),
  supportTier: text("support_tier").notNull().default("standard"),
  awayUntil: date("away_until", { mode: "string" }),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kbArticles = pgTable("kb_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  category: text("category").notNull(),
  body: text("body").notNull(),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  audienceClientId: varchar("audience_client_id").references(() => portalClients.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("draft"),
  revisedByName: text("revised_by_name").notNull().default(""),
  revisedAt: timestamp("revised_at").defaultNow().notNull(),
  views: integer("views").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const kbArticleRatings = pgTable("kb_article_ratings", {
  articleId: varchar("article_id")
    .notNull()
    .references(() => kbArticles.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  stars: integer("stars").notNull(),
  ratedAt: timestamp("rated_at").defaultNow().notNull(),
});

export const kbArticleSubscriptions = pgTable("kb_article_subscriptions", {
  articleId: varchar("article_id")
    .notNull()
    .references(() => kbArticles.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
});

// Portal users table (durable auth — Neon)
export const portalUsers = pgTable("portal_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => portalClients.id, { onDelete: "set null" }),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: portalUserRoleEnum("role").default("user"),
  storeRole: storeRoleEnum("store_role").default("prospect"),
  /** Client org hierarchy role (ignored for DE portal admins) */
  orgRole: portalOrgRoleEnum("org_role").default("staff"),
  departmentId: varchar("department_id").references(() => portalDepartments.id, { onDelete: "set null" }),
  managerUserId: varchar("manager_user_id"),
  isCompanyItContact: boolean("is_company_it_contact").default(false),
  emailVerified: boolean("email_verified").default(false),
  isActive: boolean("is_active").default(true),
  mfaEnabled: boolean("mfa_enabled").default(false),
  mfaMethod: text("mfa_method"),
  mfaTotpSecret: text("mfa_totp_secret"),
  mfaBackupCodes: jsonb("mfa_backup_codes").$type<string[]>().default([]),
  /** WebAuthn passkeys: credential id, public key, counter, provider. No secrets. */
  mfaPasskeys: jsonb("mfa_passkeys").$type<Array<Record<string, unknown>>>().default([]),
  lastLogin: timestamp("last_login"),
  /** Tokens issued before this instant are no longer valid (password reset, "sign out everywhere") (#242). */
  sessionsValidAfter: timestamp("sessions_valid_after"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Individually revoked portal tokens (logout). Keyed by SHA-256 of the token; rows expire with the token (#242). */
export const portalRevokedSessions = pgTable("portal_revoked_sessions", {
  tokenHash: varchar("token_hash").primaryKey(),
  userId: varchar("user_id"),
  revokedAt: timestamp("revoked_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const portalApprovalRequests = pgTable("portal_approval_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestNumber: text("request_number").notNull().unique(),
  clientId: varchar("client_id")
    .notNull()
    .references(() => portalClients.id, { onDelete: "cascade" }),
  requesterUserId: varchar("requester_user_id")
    .notNull()
    .references(() => portalUsers.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: ticketPriorityEnum("priority").default("medium"),
  amountCents: integer("amount_cents"),
  status: approvalRequestStatusEnum("status").default("pending"),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
  fulfillmentTicketId: varchar("fulfillment_ticket_id"),
  noManagerAssigned: boolean("no_manager_assigned").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const portalApprovalSteps = pgTable("portal_approval_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id")
    .notNull()
    .references(() => portalApprovalRequests.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  stepType: approvalStepTypeEnum("step_type").notNull(),
  approverUserId: varchar("approver_user_id").references(() => portalUsers.id, {
    onDelete: "set null",
  }),
  status: approvalStepStatusEnum("status").default("pending"),
  note: text("note"),
  actedAt: timestamp("acted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Service order form submissions from /portal/order-form */
/**
 * One-way hashed, single-use email-verification and password-reset tokens (#251).
 * The raw token only ever exists in the emailed link; the database holds its
 * SHA-256, so a restart or deploy does not invalidate an outstanding link.
 */
export const portalAuthTokens = pgTable("portal_auth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purpose: text("purpose").notNull(), // email_verification | password_reset
  tokenHash: text("token_hash").notNull().unique(),
  userId: varchar("user_id").notNull().references(() => portalUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  revokedAt: timestamp("revoked_at"),
});

export const portalOrderForms = pgTable("portal_order_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => portalUsers.id, { onDelete: "set null" }),
  clientId: varchar("client_id").references(() => portalClients.id, { onDelete: "set null" }),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").default("submitted"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** First-party portal surveys (CSAT, onboarding, awareness quizzes) */
export const portalSurveys = pgTable("portal_surveys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  questions: jsonb("questions").$type<Array<Record<string, unknown>>>().notNull(),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const portalSurveyResponses = pgTable("portal_survey_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  surveyId: varchar("survey_id")
    .notNull()
    .references(() => portalSurveys.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => portalUsers.id, { onDelete: "set null" }),
  clientId: varchar("client_id").references(() => portalClients.id, { onDelete: "set null" }),
  answers: jsonb("answers").$type<Record<string, unknown>>().notNull(),
  rating: integer("rating"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

// Portal services table
export const portalServices = pgTable("portal_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => portalClients.id, { onDelete: "cascade" }),
  serviceName: text("service_name").notNull(),
  description: text("description"),
  status: text("status").default("active"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }),
  userCount: integer("user_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Portal support tickets table
export const portalTickets = pgTable("portal_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => portalClients.id, { onDelete: "cascade" }),
  ticketNumber: text("ticket_number").unique().notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").default("open"),
  priority: ticketPriorityEnum("priority").default("medium"),
  category: text("category"),
  assignedTo: text("assigned_to"),
  createdBy: varchar("created_by").notNull().references(() => portalUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

// Portal ticket comments table
export const portalTicketComments = pgTable("portal_ticket_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => portalTickets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => portalUsers.id),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Portal invoices table
export const portalInvoices = pgTable("portal_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => portalClients.id, { onDelete: "cascade" }),
  invoiceNumber: text("invoice_number").unique().notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").default("draft"),
  issueDate: timestamp("issue_date"),
  dueDate: timestamp("due_date"),
  paidDate: timestamp("paid_date"),
  description: text("description"),
  lineItems: jsonb("line_items"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Portal knowledge base articles table
export const portalKBArticles = pgTable("portal_kb_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").unique().notNull(),
  content: text("content").notNull(),
  category: text("category"),
  tags: text("tags").array(),
  views: integer("views").default(0),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  workspaceMembers: many(workspaceMembers),
  createdProjects: many(projects),
  assignedTasks: many(tasks, { relationName: "assignedTasks" }),
  createdTasks: many(tasks, { relationName: "createdTasks" }),
  comments: many(comments),
  attachments: many(attachments),
  activities: many(activities),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  projects: many(projects),
  labels: many(labels),
  activities: many(activities),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  boards: many(boards),
  tasks: many(tasks),
  activities: many(activities),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  project: one(projects, {
    fields: [boards.projectId],
    references: [projects.id],
  }),
  tasks: many(tasks),
}));

export const labelsRelations = relations(labels, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [labels.workspaceId],
    references: [workspaces.id],
  }),
  taskLabels: many(taskLabels),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  board: one(boards, {
    fields: [tasks.boardId],
    references: [boards.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: "assignedTasks",
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "createdTasks",
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: "subtasks",
  }) as any,
  subtasks: many(tasks, { relationName: "subtasks" }) as any,
  labels: many(taskLabels),
  comments: many(comments),
  attachments: many(attachments),
  activities: many(activities),
}));

export const taskLabelsRelations = relations(taskLabels, ({ one }) => ({
  task: one(tasks, {
    fields: [taskLabels.taskId],
    references: [tasks.id],
  }),
  label: one(labels, {
    fields: [taskLabels.labelId],
    references: [labels.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, {
    fields: [comments.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  task: one(tasks, {
    fields: [attachments.taskId],
    references: [tasks.id],
  }),
  uploader: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [activities.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [activities.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [activities.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

// Portal relations
export const portalClientsRelations = relations(portalClients, ({ many }) => ({
  portalUsers: many(portalUsers),
  services: many(portalServices),
  tickets: many(portalTickets),
  invoices: many(portalInvoices),
}));

export const portalUsersRelations = relations(portalUsers, ({ one, many }) => ({
  client: one(portalClients, {
    fields: [portalUsers.clientId],
    references: [portalClients.id],
  }),
  ticketComments: many(portalTicketComments),
}));

export const portalServicesRelations = relations(portalServices, ({ one }) => ({
  client: one(portalClients, {
    fields: [portalServices.clientId],
    references: [portalClients.id],
  }),
}));

export const portalTicketsRelations = relations(portalTickets, ({ one, many }) => ({
  client: one(portalClients, {
    fields: [portalTickets.clientId],
    references: [portalClients.id],
  }),
  createdBy: one(portalUsers, {
    fields: [portalTickets.createdBy],
    references: [portalUsers.id],
  }),
  comments: many(portalTicketComments),
}));

export const portalTicketCommentsRelations = relations(portalTicketComments, ({ one }) => ({
  ticket: one(portalTickets, {
    fields: [portalTicketComments.ticketId],
    references: [portalTickets.id],
  }),
  user: one(portalUsers, {
    fields: [portalTicketComments.userId],
    references: [portalUsers.id],
  }),
}));

export const portalInvoicesRelations = relations(portalInvoices, ({ one }) => ({
  client: one(portalClients, {
    fields: [portalInvoices.clientId],
    references: [portalClients.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
  avatar: true,
});

export const selectUserSchema = createSelectSchema(users);

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBoardSchema = createInsertSchema(boards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const updateTaskSchema = insertTaskSchema.partial();

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLabelSchema = createInsertSchema(labels).omit({
  id: true,
});

// Portal Zod schemas
export const insertPortalUserSchema = createInsertSchema(portalUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
});

export const insertPortalTicketSchema = createInsertSchema(portalTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  ticketNumber: true,
});

export const insertPortalTicketCommentSchema = createInsertSchema(portalTicketComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Board = typeof boards.$inferSelect;
export type InsertBoard = z.infer<typeof insertBoardSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;

export type Label = typeof labels.$inferSelect;
export type InsertLabel = z.infer<typeof insertLabelSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type Attachment = typeof attachments.$inferSelect;

export type Activity = typeof activities.$inferSelect;

// Portal types
export type PortalClient = typeof portalClients.$inferSelect;
export type PortalUser = typeof portalUsers.$inferSelect;
export type InsertPortalUser = z.infer<typeof insertPortalUserSchema>;

export type PortalService = typeof portalServices.$inferSelect;
export type PortalTicket = typeof portalTickets.$inferSelect;
export type InsertPortalTicket = z.infer<typeof insertPortalTicketSchema>;

export type PortalTicketComment = typeof portalTicketComments.$inferSelect;
export type InsertPortalTicketComment = z.infer<typeof insertPortalTicketCommentSchema>;

export type PortalInvoice = typeof portalInvoices.$inferSelect;
export type PortalKBArticle = typeof portalKBArticles.$inferSelect;
export type PortalSurvey = typeof portalSurveys.$inferSelect;
export type PortalSurveyResponse = typeof portalSurveyResponses.$inferSelect;

// Chat messages table
export const portalChatMessages = pgTable("portal_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => portalTickets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => portalUsers.id, { onDelete: "cascade" }),
  senderName: text("sender_name").notNull(),
  senderRole: text("sender_role").notNull(), // "client" or "support"
  content: text("content").notNull(),
  encryptedContent: text("encrypted_content"), // For encryption at rest
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Classification table - stores AI-determined ticket metadata
export const portalTicketAIClassifications = pgTable("portal_ticket_ai_classifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => portalTickets.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  suggestedPriority: text("suggested_priority"),
  suggestedDepartment: text("suggested_department"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  appliedAt: timestamp("applied_at"),
  isApplied: boolean("is_applied").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Suggestions table - stores AI-generated recommendations
export const portalAISuggestions = pgTable("portal_ai_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => portalTickets.id, { onDelete: "cascade" }),
  suggestionType: text("suggestion_type").notNull(), // "resolution", "escalation", "info", "action"
  content: text("content").notNull(),
  source: text("source"), // where suggestion comes from
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  wasUseful: boolean("was_useful"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Shipments table - for Ship Center
export const portalShipments = pgTable("portal_shipments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => portalClients.id, { onDelete: "cascade" }),
  shipmentNumber: text("shipment_number").unique().notNull(),
  carrier: text("carrier").notNull(), // "usps", "fedex", "ups"
  service: text("service"), // e.g., "Priority Mail", "Next Day Air"
  status: text("status").default("pending"), // pending, processing, shipped, in_transit, delivered
  itemCount: integer("item_count"),
  weight: decimal("weight", { precision: 10, scale: 2 }), // in pounds
  trackingNumber: text("tracking_number").unique(),
  labelUrl: text("label_url"), // URL to shipping label
  cost: decimal("cost", { precision: 10, scale: 2 }),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  estimatedDelivery: timestamp("estimated_delivery"),
  deliveredAt: timestamp("delivered_at"),
  lastTrackingUpdate: timestamp("last_tracking_update"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Shipping Carrier Configuration table
export const shippingCarriers = pgTable("shipping_carriers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  carrierName: text("carrier_name").notNull(), // "usps", "fedex", "ups"
  accountId: text("account_id").notNull(),
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret"), // For carriers that need it
  isActive: boolean("is_active").default(true),
  testMode: boolean("test_mode").default(false),
  configuredBy: varchar("configured_by").notNull().references(() => portalUsers.id),
  lastValidated: timestamp("last_validated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tracking history table
export const shippingTrackingHistory = pgTable("shipping_tracking_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentId: varchar("shipment_id").notNull().references(() => portalShipments.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // picked_up, in_transit, out_for_delivery, delivered
  location: text("location"),
  description: text("description"),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Shipping rates cache table (for faster lookups)
export const shippingRatesCache = pgTable("shipping_rates_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromZip: text("from_zip").notNull(),
  toZip: text("to_zip").notNull(),
  weight: decimal("weight", { precision: 10, scale: 2 }).notNull(),
  carrier: text("carrier").notNull(),
  service: text("service").notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
  estimatedDays: integer("estimated_days"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Procurement Products table - products from internal and partners
export const portalProcurementProducts = pgTable("portal_procurement_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  price: decimal("price", { precision: 10, scale: 2 }),
  source: text("source").default("internal"), // "internal", "griffin-it", "sherweb", "pax8", "climbcs"
  externalUrl: text("external_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPortalChatMessageSchema = createInsertSchema(portalChatMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  encryptedContent: true,
});

// External Integration Sync Tables
export const externalIntegrationMappings = pgTable("external_integration_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => portalClients.id, { onDelete: "cascade" }),
  integrationType: text("integration_type").notNull(), // "zoho_desk", "zoho_crm", "jumpcloud", "seamless_ai"
  externalId: text("external_id").notNull(), // ID from external system
  externalType: text("external_type"), // "company", "user", "contact"
  mappedPortalId: varchar("mapped_portal_id"), // ID of mapped portalUser or portalClient
  mappedType: text("mapped_type"), // "user" or "client"
  syncStatus: text("sync_status").default("active"), // active, archived, deleted
  lastSyncedAt: timestamp("last_synced_at"),
  externalData: jsonb("external_data"), // Store original external data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Desktop Agents (JumpCloud, Coro.net, BlackPoint, etc.)
export const desktopAgents = pgTable("desktop_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => portalClients.id, { onDelete: "cascade" }),
  agentName: text("agent_name").notNull(), // "Digerati", "JumpCloud", "Coro", "BlackPoint"
  agentType: text("agent_type").notNull(), // "jumpcloud", "coro", "blackpoint", "other"
  downloadUrl: text("download_url"),
  version: text("version"),
  description: text("description"),
  features: text("features").array(), // Array of feature descriptions
  systemRequirements: jsonb("system_requirements"), // OS, RAM, disk, etc.
  supportedOSes: text("supported_oses").array(), // Windows, Mac, Linux
  installationGuide: text("installation_guide"),
  isActive: boolean("is_active").default(true),
  uploadedBy: varchar("uploaded_by").notNull().references(() => portalUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Integration Sync Logs
export const integrationSyncLogs = pgTable("integration_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => portalClients.id, { onDelete: "set null" }),
  integrationType: text("integration_type").notNull(),
  syncType: text("sync_type"), // "import", "update", "delete"
  totalRecords: integer("total_records"),
  successCount: integer("success_count"),
  failureCount: integer("failure_count"),
  status: text("status"), // "in_progress", "completed", "failed"
  errorMessage: text("error_message"),
  syncDetails: jsonb("sync_details"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zoho Integration Configuration Table
export const zohoConfigurations = pgTable("zoho_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: text("account_id").notNull().unique(), // Zoho account/org ID
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  tokenExpiry: timestamp("token_expiry"),
  region: text("region").default("us"), // us, eu, in, com
  portalId: text("portal_id"), // Zoho Desk portal ID for ASAP
  flowsEnabled: boolean("flows_enabled").default(false),
  deskEnabled: boolean("desk_enabled").default(false),
  crmEnabled: boolean("crm_enabled").default(false),
  isActive: boolean("is_active").default(true),
  configuredBy: varchar("configured_by").notNull().references(() => portalUsers.id),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Zoho Integration Logs
export const zohoIntegrationLogs = pgTable("zoho_integration_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  zohoConfigId: varchar("zoho_config_id").notNull().references(() => zohoConfigurations.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // "sync", "ticket_create", "flow_execute", "error"
  eventDetails: jsonb("event_details"),
  status: text("status").notNull(), // "success", "failed", "pending"
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zoho Ticket Sync (local copy of Zoho Desk tickets)
export const zohoTicketSync = pgTable("zoho_ticket_sync", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  zohoTicketId: text("zoho_ticket_id").notNull().unique(),
  zohoConfigId: varchar("zoho_config_id").notNull().references(() => zohoConfigurations.id, { onDelete: "cascade" }),
  localTicketId: varchar("local_ticket_id").references(() => portalTickets.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  description: text("description"),
  status: text("status"), // Open, On Hold, Pending Review, Closed
  priority: text("priority"), // Low, Medium, High, Urgent
  contactEmail: text("contact_email"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Zoho Flow Triggers (track which flows are active)
export const zohoFlowTriggers = pgTable("zoho_flow_triggers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  zohoConfigId: varchar("zoho_config_id").notNull().references(() => zohoConfigurations.id, { onDelete: "cascade" }),
  flowId: text("flow_id").notNull(),
  flowName: text("flow_name").notNull(),
  triggerType: text("trigger_type").notNull(), // "webhook", "schedule", "manual"
  triggerEvent: text("trigger_event"), // "ticket_created", "ticket_updated", "form_submitted"
  isActive: boolean("is_active").default(true),
  webhookUrl: text("webhook_url"), // Our endpoint that Flow sends data to
  lastExecutedAt: timestamp("last_executed_at"),
  executionCount: integer("execution_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PortalChatMessage = typeof portalChatMessages.$inferSelect;
export type InsertPortalChatMessage = z.infer<typeof insertPortalChatMessageSchema>;

export type PortalTicketAIClassification = typeof portalTicketAIClassifications.$inferSelect;
export type PortalAISuggestion = typeof portalAISuggestions.$inferSelect;
export type PortalShipment = typeof portalShipments.$inferSelect;
export type PortalProcurementProduct = typeof portalProcurementProducts.$inferSelect;

export type ExternalIntegrationMapping = typeof externalIntegrationMappings.$inferSelect;
export type DesktopAgent = typeof desktopAgents.$inferSelect;
export type IntegrationSyncLog = typeof integrationSyncLogs.$inferSelect;

export type ZohoConfiguration = typeof zohoConfigurations.$inferSelect;
export type ZohoIntegrationLog = typeof zohoIntegrationLogs.$inferSelect;
export type ZohoTicketSync = typeof zohoTicketSync.$inferSelect;
export type ZohoFlowTrigger = typeof zohoFlowTriggers.$inferSelect;

export type ShippingCarrier = typeof shippingCarriers.$inferSelect;
export type ShippingTrackingHistory = typeof shippingTrackingHistory.$inferSelect;
export type ShippingRatesCache = typeof shippingRatesCache.$inferSelect;

// =============== MULTI-TENANCY TABLES ===============

// Tenant-specific files/documents
export const portalTenantFiles = pgTable("portal_tenant_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => portalClients.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // "document", "agent", "guide", "policy", "other"
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  description: text("description"),
  category: text("category"), // "agents", "policies", "documentation", "onboarding"
  isPublic: boolean("is_public").default(true), // visible to client users
  uploadedBy: varchar("uploaded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Soft delete (#259): the row keeps the object path so a blob is never orphaned silently.
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
});

// Insert schema for tenant files
export const insertPortalTenantFileSchema = createInsertSchema(portalTenantFiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schema for portal clients
export const insertPortalClientSchema = createInsertSchema(portalClients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PortalTenantFile = typeof portalTenantFiles.$inferSelect;
export type InsertPortalTenantFile = z.infer<typeof insertPortalTenantFileSchema>;
export type InsertPortalClient = z.infer<typeof insertPortalClientSchema>;

// =============== CONTRACT & SIGNATURE TABLES ===============

// Contract status enum
export const contractStatusEnum = pgEnum("contract_status", [
  "draft",           // Template being prepared
  "pending",         // Sent to client, awaiting signature
  "signed",          // Client has signed
  "countersigned",   // Both parties signed
  "expired",         // Contract expired without signature
  "declined",        // Client declined to sign
  "cancelled"        // Cancelled by admin
]);

// Contract templates (master templates uploaded by admin)
export const contractTemplates = pgTable("contract_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // "msa", "sow", "nda", "sla", "addendum", "other"
  version: text("version").default("1.0"),
  pdfUrl: text("pdf_url"), // URL to the PDF template
  pdfContent: text("pdf_content"), // Base64 encoded PDF content
  htmlContent: text("html_content"), // HTML version for display
  fields: jsonb("fields"), // Merge fields like {{client_name}}, {{date}}, etc.
  requiresCountersign: boolean("requires_countersign").default(false),
  expirationDays: integer("expiration_days").default(30), // Days until contract expires
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Contracts assigned to clients
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => contractTemplates.id),
  clientId: varchar("client_id").notNull().references(() => portalClients.id, { onDelete: "cascade" }),
  assignedToUserId: varchar("assigned_to_user_id").references(() => portalUsers.id), // Specific user who should sign
  contractNumber: text("contract_number").unique(),
  title: text("title").notNull(),
  description: text("description"),
  pdfUrl: text("pdf_url"), // Generated PDF URL
  pdfContent: text("pdf_content"), // Base64 encoded PDF with signature
  mergedFields: jsonb("merged_fields"), // Field values merged into template
  status: contractStatusEnum("status").default("draft"),
  sentAt: timestamp("sent_at"), // When sent to client
  expiresAt: timestamp("expires_at"), // Deadline to sign
  signedAt: timestamp("signed_at"), // When client signed
  countersignedAt: timestamp("countersigned_at"), // When admin countersigned
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  signedPdfUrl: text("signed_pdf_url"), // Final signed PDF
  ipAddress: text("ip_address"), // IP when signed
  userAgent: text("user_agent"), // Browser info when signed
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Individual signatures on contracts (supports multiple signers)
export const contractSignatures = pgTable("contract_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => portalUsers.id), // Portal user who signed
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email").notNull(),
  signerTitle: text("signer_title"), // Job title
  signatureType: text("signature_type").default("drawn"), // "drawn", "typed", "uploaded"
  signatureData: text("signature_data"), // Base64 of drawn signature or text
  signedAt: timestamp("signed_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  isCountersign: boolean("is_countersign").default(false), // True if this is admin countersign
  pageNumber: integer("page_number"), // Which page the signature appears on
  positionX: integer("position_x"), // X coordinate of signature
  positionY: integer("position_y"), // Y coordinate of signature
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Contract audit log
export const contractAuditLog = pgTable("contract_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // "created", "sent", "viewed", "signed", "declined", "expired"
  performedBy: varchar("performed_by"), // User ID or "system"
  performedByName: text("performed_by_name"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractSignatureSchema = createInsertSchema(contractSignatures).omit({
  id: true,
  createdAt: true,
});

export const insertContractAuditLogSchema = createInsertSchema(contractAuditLog).omit({
  id: true,
  createdAt: true,
});

// Types
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type ContractSignature = typeof contractSignatures.$inferSelect;
export type InsertContractSignature = z.infer<typeof insertContractSignatureSchema>;
export type ContractAuditLog = typeof contractAuditLog.$inferSelect;
export type InsertContractAuditLog = z.infer<typeof insertContractAuditLogSchema>;

// =============== E-COMMERCE STORE TABLES ===============

// Store product category enum
export const storeProductCategoryEnum = pgEnum("store_product_category", [
  "contract_services",      // A) Contract-only (non-purchasable)
  "comanaged_subscriptions", // B) Co-Managed IT subscriptions
  "comanaged_onboarding",   // B2) Co-Managed onboarding
  "networking_managed",     // C) Managed Network
  "networking_projects",    // C2) Network project labor
  "ucaas_subscriptions",    // D) UCaaS subscriptions
  "ucaas_setup",           // D2) UCaaS setup
  "hardware_provisioning", // E) Hardware provisioning
  "hardware_physical",     // E2) Physical hardware
  "hardware_handling",     // E3) Optional handling & install
  "digital_assessments",   // F) Digital assessments
  "digital_templates",     // F2) Templates & compliance packs
  "digital_training",      // F3) Training
  "professional_services"  // G) Professional services
]);

// Pricing type enum
export const storePricingTypeEnum = pgEnum("store_pricing_type", [
  "one_time",      // One-time purchase
  "monthly",       // Monthly subscription
  "yearly",        // Annual subscription
  "per_hour",      // Hourly rate
  "per_user",      // Per user pricing
  "per_endpoint",  // Per endpoint pricing
  "per_device",    // Per device pricing
  "per_location",  // Per location pricing
  "per_seat"       // Per seat pricing
]);

// Client type for store access
export const storeClientTypeEnum = pgEnum("store_client_type", [
  "public",        // Public visitors (no login)
  "managed",       // Managed clients (contract-only)
  "comanaged"      // Co-Managed clients (checkout enabled)
]);

// Store Products table
export const storeProducts = pgTable("store_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  shortDescription: text("short_description"),
  category: storeProductCategoryEnum("category").notNull(),
  pricingType: storePricingTypeEnum("pricing_type").notNull(),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  pricingUnit: text("pricing_unit"), // "user", "endpoint", "device", "location", "hour", "seat"
  isContractOnly: boolean("is_contract_only").default(false), // True = schedule consult, no checkout
  isCheckoutEnabled: boolean("is_checkout_enabled").default(true),
  isClientOnly: boolean("is_client_only").default(false), // Only visible to logged-in clients
  requiredClientType: storeClientTypeEnum("required_client_type").default("public"),
  minimumQuantity: integer("minimum_quantity").default(1),
  features: text("features").array(),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  stripePriceId: text("stripe_price_id"), // For Stripe checkout
  stripeProductId: text("stripe_product_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Client-specific pricing tiers
export const storeClientPricing = pgTable("store_client_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => portalClients.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => storeProducts.id, { onDelete: "cascade" }),
  customPrice: decimal("custom_price", { precision: 10, scale: 2 }).notNull(),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Shopping cart
export const storeCarts = pgTable("store_carts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id"), // For guest carts
  userId: varchar("user_id").references(() => portalUsers.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").references(() => portalClients.id, { onDelete: "cascade" }),
  items: jsonb("items").notNull().default([]), // Array of {productId, quantity, unitPrice}
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Store order status enum
export const storeOrderStatusEnum = pgEnum("store_order_status", [
  "pending",
  "quote_requested",
  "quote_sent",
  "awaiting_payment",
  "paid",
  "processing",
  "provisioning",
  "completed",
  "cancelled",
  "refunded"
]);

// Payment method enum
export const storePaymentMethodEnum = pgEnum("store_payment_method", [
  "stripe",
  "zoho",
  "quote_request",
  "invoice"
]);

// Store Orders table
export const storeOrders = pgTable("store_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").unique().notNull(),
  userId: varchar("user_id").references(() => portalUsers.id, { onDelete: "set null" }),
  clientId: varchar("client_id").references(() => portalClients.id, { onDelete: "set null" }),
  status: storeOrderStatusEnum("status").default("pending"),
  paymentMethod: storePaymentMethodEnum("payment_method"),
  lineItems: jsonb("line_items").notNull(), // Array of order items with product details
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  zohoPaymentId: text("zoho_payment_id"),
  zohoPaymentSessionId: text("zoho_payment_session_id"),
  billingEmail: text("billing_email"),
  billingName: text("billing_name"),
  billingCompany: text("billing_company"),
  billingAddress: jsonb("billing_address"),
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Store order controls (migrations/0012): a hold pauses fulfilment until a date;
// change requests (cancel a paid order, amend) are reviewed by DE. Neither edits the order.
export const storeOrderHolds = pgTable("store_order_holds", {
  orderId: varchar("order_id")
    .primaryKey()
    .references(() => storeOrders.id, { onDelete: "cascade" }),
  clientId: varchar("client_id"),
  heldUntil: date("held_until", { mode: "string" }).notNull(),
  reason: text("reason").notNull(),
  heldByUserId: varchar("held_by_user_id"),
  heldByName: text("held_by_name").notNull(),
  heldByRole: text("held_by_role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const storeOrderChangeRequests = pgTable("store_order_change_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id")
    .notNull()
    .references(() => storeOrders.id, { onDelete: "cascade" }),
  orderNumber: text("order_number").notNull(),
  clientId: varchar("client_id"),
  kind: text("kind").notNull(),
  details: text("details").notNull(),
  status: text("status").notNull().default("open"),
  requestedByUserId: varchar("requested_by_user_id"),
  requestedByName: text("requested_by_name").notNull(),
  requestedByRole: text("requested_by_role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedByName: text("resolved_by_name"),
  resolutionNote: text("resolution_note"),
});

// Quote requests for contract-only items
export const storeQuoteRequests = pgTable("store_quote_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteNumber: text("quote_number").unique().notNull(),
  userId: varchar("user_id").references(() => portalUsers.id, { onDelete: "set null" }),
  clientId: varchar("client_id").references(() => portalClients.id, { onDelete: "set null" }),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  companyName: text("company_name"),
  requestedItems: jsonb("requested_items").notNull(), // Products/services requested
  message: text("message"),
  status: text("status").default("pending"), // pending, contacted, quoted, converted, declined
  assignedTo: text("assigned_to"),
  meetingScheduled: timestamp("meeting_scheduled"),
  quoteSentAt: timestamp("quote_sent_at"),
  convertedOrderId: varchar("converted_order_id").references(() => storeOrders.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertStoreProductSchema = createInsertSchema(storeProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreOrderSchema = createInsertSchema(storeOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreQuoteRequestSchema = createInsertSchema(storeQuoteRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreCartSchema = createInsertSchema(storeCarts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type StoreProduct = typeof storeProducts.$inferSelect;
export type InsertStoreProduct = z.infer<typeof insertStoreProductSchema>;
export type StoreClientPricing = typeof storeClientPricing.$inferSelect;
export type StoreCart = typeof storeCarts.$inferSelect;
export type InsertStoreCart = z.infer<typeof insertStoreCartSchema>;
export type StoreOrder = typeof storeOrders.$inferSelect;
export type InsertStoreOrder = z.infer<typeof insertStoreOrderSchema>;
export type StoreQuoteRequest = typeof storeQuoteRequests.$inferSelect;
export type InsertStoreQuoteRequest = z.infer<typeof insertStoreQuoteRequestSchema>;

// =============== DOCUMENT MANAGEMENT SYSTEM ===============

// Document category enum
export const documentCategoryEnum = pgEnum("document_category", [
  "core_legal",      // NDA, MSA - foundational documents
  "commercial",      // Order forms, pricing, terms
  "sow"              // Statements of Work for services
]);

// Document packet status enum  
export const documentPacketStatusEnum = pgEnum("document_packet_status", [
  "draft",           // Being assembled
  "pending_review",  // Ready for client review
  "in_progress",     // Client is signing
  "partially_signed",// Some docs signed
  "completed",       // All required docs signed
  "cancelled"        // Cancelled by admin
]);

// Document templates - the master list of available documents
export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey(), // Matches manifest ID like "msa-digerati-experts-2026"
  selectionKey: text("selection_key").notNull().unique(), // Key used in order form selections
  title: text("title").notNull(),
  category: documentCategoryEnum("category").notNull(),
  version: text("version").notNull(),
  sortOrder: integer("sort_order").default(0), // Controls display/signing order
  requiresSignature: boolean("requires_signature").default(true),
  templateDocxPath: text("template_docx_path"), // Path to DOCX template
  templatePdfPath: text("template_pdf_path"),   // Path to PDF for viewing
  dependsOn: text("depends_on").array(),        // Selection keys of required parent docs
  description: text("description"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Document packets - bundles of documents assembled for a client
export const documentPackets = pgTable("document_packets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => portalClients.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "Service Agreement Packet - January 2026"
  description: text("description"),
  status: documentPacketStatusEnum("status").default("draft"),
  serviceSelections: jsonb("service_selections").notNull().default([]), // Array of selected service keys
  effectiveDate: timestamp("effective_date"),
  billingStartDate: timestamp("billing_start_date"),
  contractTerm: text("contract_term"), // e.g., "12 months", "36 months"
  totalMonthlyValue: decimal("total_monthly_value", { precision: 10, scale: 2 }),
  totalOneTimeValue: decimal("total_one_time_value", { precision: 10, scale: 2 }),
  clientSignatory: text("client_signatory"),      // Name of client signer
  clientSignatoryTitle: text("client_signatory_title"),
  clientSignatoryEmail: text("client_signatory_email"),
  createdBy: varchar("created_by").references(() => portalUsers.id),
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Document packet items - individual documents within a packet
export const documentPacketItems = pgTable("document_packet_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packetId: varchar("packet_id").notNull().references(() => documentPackets.id, { onDelete: "cascade" }),
  templateId: varchar("template_id").notNull().references(() => documentTemplates.id),
  sortOrder: integer("sort_order").default(0),
  requiresSignature: boolean("requires_signature").default(true),
  populatedPdfPath: text("populated_pdf_path"),  // Path to generated PDF with client data
  signedAt: timestamp("signed_at"),
  signatureData: text("signature_data"),          // Base64 signature image
  signerName: text("signer_name"),
  signerIp: text("signer_ip"),
  signerUserAgent: text("signer_user_agent"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Client onboarding data - captures data from order form
export const clientOnboardingData = pgTable("client_onboarding_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => portalClients.id, { onDelete: "cascade" }),
  packetId: varchar("packet_id").references(() => documentPackets.id, { onDelete: "set null" }),
  // Company Information
  legalName: text("legal_name").notNull(),
  dbaName: text("dba_name"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  phone: text("phone"),
  website: text("website"),
  // Signatory Information
  signatoryName: text("signatory_name"),
  signatoryTitle: text("signatory_title"),
  signatoryEmail: text("signatory_email"),
  signatoryPhone: text("signatory_phone"),
  // Technical Contact
  techContactName: text("tech_contact_name"),
  techContactEmail: text("tech_contact_email"),
  techContactPhone: text("tech_contact_phone"),
  // Billing Contact
  billingContactName: text("billing_contact_name"),
  billingContactEmail: text("billing_contact_email"),
  billingContactPhone: text("billing_contact_phone"),
  // Service Configuration
  numberOfSites: integer("number_of_sites").default(1),
  numberOfUsers: integer("number_of_users").default(1),
  numberOfEndpoints: integer("number_of_endpoints").default(1),
  billingFrequency: text("billing_frequency").default("monthly"),
  preferredStartDate: timestamp("preferred_start_date"),
  // Additional Data (flexible JSON for SOW-specific fields)
  additionalData: jsonb("additional_data").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas for document management
export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentPacketSchema = createInsertSchema(documentPackets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentPacketItemSchema = createInsertSchema(documentPacketItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientOnboardingDataSchema = createInsertSchema(clientOnboardingData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Document management types
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentPacket = typeof documentPackets.$inferSelect;
export type InsertDocumentPacket = z.infer<typeof insertDocumentPacketSchema>;
export type DocumentPacketItem = typeof documentPacketItems.$inferSelect;
export type InsertDocumentPacketItem = z.infer<typeof insertDocumentPacketItemSchema>;
export type ClientOnboardingData = typeof clientOnboardingData.$inferSelect;
export type InsertClientOnboardingData = z.infer<typeof insertClientOnboardingDataSchema>;

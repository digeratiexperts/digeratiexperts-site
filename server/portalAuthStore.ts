/**
 * Durable portal auth store — Neon-backed with in-memory cache.
 * Sync get/set API matches the former Map so routes can migrate cleanly.
 */
import { eq, or, sql } from "drizzle-orm";
import { db, dbReady, initPromise } from "./db";
import {
  portalUsers as portalUsersTable,
  portalClients as portalClientsTable,
  portalOrderForms,
} from "@shared/schema";
import { PRIMARY_PHONE } from "@shared/companyContact";
import { decryptTotpSecret, encryptTotpSecret, prepareBackupCodesForStorage } from "./portalMfaCrypto";

type StoreRole = "public" | "prospect" | "managed" | "comanaged" | "admin";

export type PortalAuthUser = {
  id: string;
  email: string;
  username?: string | null;
  password: string;
  fullName: string;
  role: string;
  storeRole?: StoreRole | string | null;
  clientId?: string | null;
  orgRole?: "staff" | "manager" | "dept_it_contact" | "company_it_contact" | string | null;
  departmentId?: string | null;
  managerUserId?: string | null;
  isCompanyItContact?: boolean;
  emailVerified?: boolean;
  isActive?: boolean;
  mfaEnabled?: boolean;
  mfaMethod?: string | null;
  mfaTotpSecret?: string | null;
  mfaBackupCodes?: string[];
  lastLogin?: Date | null;
  createdAt?: Date;
};

export type PortalAuthClient = {
  id: string;
  companyName: string;
  contactEmail: string;
  contactPhone?: string | null;
  industry?: string | null;
  primaryContact?: string | null;
  status?: string | null;
  type?: string;
  serviceType?: string | null;
  hubAccountId?: string | null;
  createdAt?: Date;
};

const usersByKey = new Map<string, PortalAuthUser>();
const clientsById = new Map<string, PortalAuthClient>();
let initialized = false;

function indexUser(user: PortalAuthUser) {
  usersByKey.set(user.email.toLowerCase(), user);
  usersByKey.set(user.email, user);
  if (user.username) {
    usersByKey.set(user.username.toLowerCase(), user);
    usersByKey.set(user.username, user);
  }
}

function rowToUser(row: typeof portalUsersTable.$inferSelect): PortalAuthUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    password: row.password,
    fullName: row.fullName,
    role: row.role || "user",
    storeRole: row.storeRole,
    clientId: row.clientId,
    orgRole: (row as any).orgRole || "staff",
    departmentId: (row as any).departmentId || null,
    managerUserId: (row as any).managerUserId || null,
    isCompanyItContact: !!(row as any).isCompanyItContact,
    emailVerified: row.emailVerified ?? false,
    isActive: row.isActive ?? true,
    mfaEnabled: row.mfaEnabled ?? false,
    mfaMethod: row.mfaMethod,
    mfaTotpSecret: decryptTotpSecret(row.mfaTotpSecret),
    mfaBackupCodes: Array.isArray(row.mfaBackupCodes) ? row.mfaBackupCodes : [],
    lastLogin: row.lastLogin,
    createdAt: row.createdAt,
  };
}

function rowToClient(row: typeof portalClientsTable.$inferSelect): PortalAuthClient {
  return {
    id: row.id,
    companyName: row.companyName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    industry: row.industry,
    primaryContact: row.primaryContact,
    status: row.status,
    serviceType: row.serviceType,
    hubAccountId: (row as { hubAccountId?: string | null }).hubAccountId || null,
    createdAt: row.createdAt,
  };
}

async function ensureSchema() {
  if (!dbReady || !db) return;
  try {
    await db.execute(sql`
      ALTER TABLE portal_clients ADD COLUMN IF NOT EXISTS service_type text DEFAULT 'prospect'
    `);
    await db.execute(sql`
      ALTER TABLE portal_clients ADD COLUMN IF NOT EXISTS hub_account_id varchar
    `);
    await db.execute(sql`ALTER TABLE portal_users ALTER COLUMN client_id DROP NOT NULL`);
    await db.execute(sql`ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS username text`);
    await db.execute(sql`ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS store_role store_role DEFAULT 'prospect'`);
    await db.execute(sql`ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS mfa_enabled boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS mfa_method text`);
    await db.execute(sql`ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS mfa_totp_secret text`);
    await db.execute(sql`ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS mfa_backup_codes jsonb DEFAULT '[]'::jsonb`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS portal_order_forms (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar REFERENCES portal_users(id) ON DELETE SET NULL,
        client_id varchar REFERENCES portal_clients(id) ON DELETE SET NULL,
        payload jsonb NOT NULL,
        status text DEFAULT 'submitted',
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    try {
      const { ensureOrgSchema } = await import("./portalOrg");
      await ensureOrgSchema();
    } catch {
      /* org schema optional at boot */
    }
  } catch (err: any) {
    console.warn("[portalAuthStore] schema ensure:", err?.message);
  }
}

async function upsertUserDb(user: PortalAuthUser) {
  if (!dbReady || !db) return;
  try {
    const values = {
      id: user.id,
      email: user.email,
      username: user.username || null,
      password: user.password,
      fullName: user.fullName,
      role: (user.role as "admin" | "user" | "viewer") || "user",
      storeRole: (user.storeRole as StoreRole) || "prospect",
      clientId: user.clientId || null,
      orgRole: (user.orgRole as "staff" | "manager" | "dept_it_contact" | "company_it_contact") || "staff",
      departmentId: user.departmentId || null,
      managerUserId: user.managerUserId || null,
      isCompanyItContact: user.isCompanyItContact ?? false,
      emailVerified: user.emailVerified ?? false,
      isActive: user.isActive ?? true,
      mfaEnabled: user.mfaEnabled ?? false,
      mfaMethod: user.mfaMethod || null,
      mfaTotpSecret: encryptTotpSecret(user.mfaTotpSecret),
      mfaBackupCodes: prepareBackupCodesForStorage(user.mfaBackupCodes || []),
      lastLogin: user.lastLogin || null,
    };
    await db
      .insert(portalUsersTable)
      .values(values)
      .onConflictDoUpdate({
        target: portalUsersTable.id,
        set: {
          email: values.email,
          username: values.username,
          password: values.password,
          fullName: values.fullName,
          role: values.role,
          storeRole: values.storeRole,
          clientId: values.clientId,
          orgRole: values.orgRole,
          departmentId: values.departmentId,
          managerUserId: values.managerUserId,
          isCompanyItContact: values.isCompanyItContact,
          emailVerified: values.emailVerified,
          isActive: values.isActive,
          mfaEnabled: values.mfaEnabled,
          mfaMethod: values.mfaMethod,
          mfaTotpSecret: values.mfaTotpSecret,
          mfaBackupCodes: values.mfaBackupCodes,
          lastLogin: values.lastLogin,
          updatedAt: new Date(),
        },
      });
  } catch (err: any) {
    console.warn("[portalAuthStore] upsert user failed:", err?.message);
  }
}

async function upsertClientDb(client: PortalAuthClient) {
  if (!dbReady || !db) return;
  try {
    await db
      .insert(portalClientsTable)
      .values({
        id: client.id,
        companyName: client.companyName,
        contactEmail: client.contactEmail,
        contactPhone: client.contactPhone || null,
        industry: client.industry || null,
        primaryContact: client.primaryContact || null,
        status: client.status || "active",
        serviceType: client.serviceType || "prospect",
        hubAccountId: client.hubAccountId || null,
      })
      .onConflictDoUpdate({
        target: portalClientsTable.id,
        set: {
          companyName: client.companyName,
          contactEmail: client.contactEmail,
          contactPhone: client.contactPhone || null,
          industry: client.industry || null,
          primaryContact: client.primaryContact || null,
          status: client.status || "active",
          serviceType: client.serviceType || "prospect",
          hubAccountId: client.hubAccountId || null,
          updatedAt: new Date(),
        },
      });
  } catch (err: any) {
    console.warn("[portalAuthStore] upsert client failed:", err?.message);
  }
}

const ADMIN_HASH = "$2b$12$Bf.sDD1gQ6391SrTebkd4.9BeiteKKOswHl63vyCN0/51CmDldT7K"; // Admin123!

function seedAdmins() {
  const admins: PortalAuthUser[] = [
    {
      id: "admin-001",
      email: "admin@digeratiexperts.com",
      username: "admin",
      password: ADMIN_HASH,
      role: "admin",
      storeRole: "admin",
      fullName: "Administrator",
      clientId: null,
      emailVerified: true,
      isActive: true,
    },
    {
      id: "admin-002",
      email: "admin@digerati-experts.com",
      username: "admin-hyphen",
      password: ADMIN_HASH,
      role: "admin",
      storeRole: "admin",
      fullName: "Administrator",
      clientId: null,
      emailVerified: true,
      isActive: true,
    },
  ];
  for (const a of admins) {
    if (!getUser(a.email)) {
      indexUser(a);
      void upsertUserDb(a);
    }
  }
}

function seedDemoIfNotProduction() {
  if (process.env.NODE_ENV === "production") return;

  const msp: PortalAuthClient = {
    id: "msp-digerati",
    companyName: "Digerati Experts (Internal)",
    contactEmail: "admin@digeratiexperts.com",
    contactPhone: PRIMARY_PHONE.display,
    industry: "MSP/MSSP",
    primaryContact: "Digerati Admin",
    status: "active",
    type: "msp",
    serviceType: "managed",
    createdAt: new Date(),
  };
  setClient(msp);

  const demoCompanies: PortalAuthClient[] = [
    { id: "client-1", companyName: "Acme Corp", contactEmail: "admin@acme.com", contactPhone: "(480) 555-1001", industry: "Manufacturing", primaryContact: "John Smith", status: "active", type: "client", serviceType: "managed", createdAt: new Date() },
    { id: "client-2", companyName: "Phoenix Medical Group", contactEmail: "it@phoenixmedical.com", contactPhone: "(480) 555-1002", industry: "Healthcare", primaryContact: "Sarah Jones", status: "active", type: "client", serviceType: "managed", createdAt: new Date() },
    { id: "client-3", companyName: "Desert Law Partners", contactEmail: "admin@desertlaw.com", contactPhone: "(480) 555-1003", industry: "Legal", primaryContact: "Mike Davis", status: "active", type: "client", serviceType: "comanaged", createdAt: new Date() },
    { id: "client-4", companyName: "Scottsdale Realty", contactEmail: "tech@scottsdalereal.com", contactPhone: "(480) 555-1004", industry: "Real Estate", primaryContact: "Lisa Wilson", status: "active", type: "client", serviceType: "comanaged", createdAt: new Date() },
    { id: "client-5", companyName: "Alamo Industries", contactEmail: "support@alamoindustries.com", contactPhone: "(480) 555-1005", industry: "Manufacturing", primaryContact: "Maria Garcia", status: "active", type: "client", serviceType: "comanaged", createdAt: new Date() },
    { id: "client-6", companyName: "Sel Machining", contactEmail: "support@selmachining.com", contactPhone: "(480) 555-1006", industry: "Manufacturing", primaryContact: "Operations Manager", status: "active", type: "client", serviceType: "comanaged", createdAt: new Date() },
  ];
  for (const c of demoCompanies) setClient(c);

  const demos: PortalAuthUser[] = [
    { id: "user-001", email: "john.smith@acme.com", username: "johnsmith", password: ADMIN_HASH, role: "user", storeRole: "managed", fullName: "John Smith", clientId: "client-1", orgRole: "company_it_contact", isCompanyItContact: true, emailVerified: true, isActive: true },
    { id: "user-002", email: "sarah.jones@phoenixmedical.com", username: "sarahjones", password: ADMIN_HASH, role: "user", storeRole: "managed", fullName: "Sarah Jones", clientId: "client-2", orgRole: "company_it_contact", isCompanyItContact: true, emailVerified: true, isActive: true },
    { id: "user-003", email: "admin@alamoindustries.com", username: "alamoadmin", password: "$2b$12$N9Ys4.kLCKht2rMjK4x0TOJHlQlxY7dRzAT6vmC7.mGrjck7TUI7O", role: "user", storeRole: "comanaged", fullName: "Maria Garcia", clientId: "client-5", orgRole: "company_it_contact", isCompanyItContact: true, emailVerified: true, isActive: true },
    { id: "user-004", email: "admin@selmachining.com", username: "seladmin", password: "$2b$12$m6eyC5YfWBIG4/beE40TxOeG5BG4v/MxsowQ4Ays9RrjhOzcVxx.a", role: "user", storeRole: "comanaged", fullName: "Sel Operations", clientId: "client-6", orgRole: "company_it_contact", isCompanyItContact: true, emailVerified: true, isActive: true },
  ];
  for (const u of demos) {
    if (!getUser(u.email)) setUser(u);
  }
}

/** Update org hierarchy fields for a portal user (People & org admin). */
export function updateUserOrgFields(
  userId: string,
  patch: {
    orgRole?: PortalAuthUser["orgRole"];
    departmentId?: string | null;
    managerUserId?: string | null;
    isCompanyItContact?: boolean;
    fullName?: string;
  },
): PortalAuthUser | null {
  const existing = listUniqueUsers().find((u) => u.id === userId);
  if (!existing) return null;
  if (patch.isCompanyItContact && existing.clientId) {
    for (const u of listUniqueUsers()) {
      if (u.clientId === existing.clientId && u.id !== userId && u.isCompanyItContact) {
        u.isCompanyItContact = false;
        if (u.orgRole === "company_it_contact") u.orgRole = "staff";
        setUser(u);
      }
    }
  }
  const next: PortalAuthUser = {
    ...existing,
    ...patch,
    orgRole: patch.orgRole !== undefined ? patch.orgRole : existing.orgRole,
    departmentId: patch.departmentId !== undefined ? patch.departmentId : existing.departmentId,
    managerUserId: patch.managerUserId !== undefined ? patch.managerUserId : existing.managerUserId,
    isCompanyItContact:
      patch.isCompanyItContact !== undefined ? patch.isCompanyItContact : existing.isCompanyItContact,
  };
  if (next.isCompanyItContact) next.orgRole = "company_it_contact";
  setUser(next);
  return next;
}

export async function initPortalAuthStore(): Promise<void> {
  if (initialized) return;
  await initPromise;
  await ensureSchema();

  if (dbReady && db) {
    try {
      const clients = await db.select().from(portalClientsTable);
      for (const c of clients) clientsById.set(c.id, rowToClient(c));
      const users = await db.select().from(portalUsersTable);
      for (const u of users) indexUser(rowToUser(u));
      console.log(`✅ Portal auth store loaded ${users.length} users, ${clients.length} clients from DB`);
    } catch (err: any) {
      console.warn("[portalAuthStore] load from DB failed:", err?.message);
    }
  } else {
    console.warn("⚠️ Portal auth store: DB unavailable — using memory (non-durable)");
  }

  seedAdmins();
  seedDemoIfNotProduction();
  ensureInternalMspClient();
  initialized = true;
}

export function getUser(key: string | undefined | null): PortalAuthUser | undefined {
  if (!key) return undefined;
  return usersByKey.get(key) || usersByKey.get(key.toLowerCase());
}

export function hasUser(key: string): boolean {
  return !!getUser(key);
}

export function setUser(user: PortalAuthUser): void {
  indexUser(user);
  void upsertUserDb(user);
}

/**
 * Drop stale index keys (e.g. a previous email) that no longer point at the
 * user after a profile change, so the old address can't still authenticate.
 * Only removes a key when it currently resolves to this same user id.
 */
export function removeUserKeys(userId: string, keys: Array<string | null | undefined>): void {
  for (const key of keys) {
    if (!key) continue;
    for (const variant of [key, key.toLowerCase()]) {
      const existing = usersByKey.get(variant);
      if (existing && existing.id === userId) {
        usersByKey.delete(variant);
      }
    }
  }
}

export function listUniqueUsers(): PortalAuthUser[] {
  const seen = new Set<string>();
  const out: PortalAuthUser[] = [];
  Array.from(usersByKey.values()).forEach((u) => {
    if (seen.has(u.id)) return;
    seen.add(u.id);
    out.push(u);
  });
  return out;
}

export function getClient(id: string | undefined | null): PortalAuthClient | undefined {
  if (!id) return undefined;
  return clientsById.get(id);
}

export function setClient(client: PortalAuthClient): void {
  clientsById.set(client.id, client);
  void upsertClientDb(client);
}

export function listClients(): PortalAuthClient[] {
  return Array.from(clientsById.values());
}

const INTERNAL_MSP_ID = "msp-digerati";

/** Live Digerati org if one exists; otherwise create the internal MSP tenant. */
export function findInternalMspClient(): PortalAuthClient | undefined {
  const all = listClients();
  return (
    all.find((c) => c.id === INTERNAL_MSP_ID) ||
    all.find((c) => c.type === "msp") ||
    all.find((c) => /digerati experts/i.test(c.companyName || ""))
  );
}

export function ensureInternalMspClient(): PortalAuthClient {
  const existing = findInternalMspClient();
  if (existing) return existing;
  const client: PortalAuthClient = {
    id: INTERNAL_MSP_ID,
    companyName: "Digerati Experts",
    contactEmail: "admin@digeratiexperts.com",
    contactPhone: PRIMARY_PHONE.display,
    industry: "MSP/MSSP",
    primaryContact: "Digerati Admin",
    status: "active",
    type: "msp",
    serviceType: "managed",
    createdAt: new Date(),
  };
  setClient(client);
  return client;
}

/** Create a prospect client + link user (signup). */
export async function createProspectClientForUser(user: PortalAuthUser, companyName?: string): Promise<PortalAuthClient> {
  const client: PortalAuthClient = {
    id: `prospect-${user.id.slice(0, 12)}`,
    companyName: companyName || `${user.fullName || user.username || "Prospect"} (Prospect)`,
    contactEmail: user.email,
    primaryContact: user.fullName || user.username || user.email,
    status: "prospect",
    type: "client",
    serviceType: "prospect",
    createdAt: new Date(),
  };
  setClient(client);
  user.clientId = client.id;
  user.storeRole = "prospect";
  setUser(user);
  return client;
}

export async function saveOrderForm(opts: {
  userId?: string | null;
  clientId?: string | null;
  payload: Record<string, unknown>;
}): Promise<{ id: string }> {
  const id = `order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  if (dbReady && db) {
    try {
      const [row] = await db
        .insert(portalOrderForms)
        .values({
          id,
          userId: opts.userId || null,
          clientId: opts.clientId || null,
          payload: opts.payload,
          status: "submitted",
        })
        .returning({ id: portalOrderForms.id });
      return { id: row.id };
    } catch (err: any) {
      console.warn("[portalAuthStore] order form insert failed:", err?.message);
    }
  }
  return { id };
}

export async function findUserByEmailOrUsername(identifier: string): Promise<PortalAuthUser | undefined> {
  const cached = getUser(identifier);
  if (cached) return cached;
  if (!dbReady || !db) return undefined;
  try {
    const [row] = await db
      .select()
      .from(portalUsersTable)
      .where(or(eq(portalUsersTable.email, identifier), eq(portalUsersTable.username, identifier)))
      .limit(1);
    if (row) {
      const user = rowToUser(row);
      indexUser(user);
      return user;
    }
  } catch (err: any) {
    console.warn("[portalAuthStore] findUser failed:", err?.message);
  }
  return undefined;
}

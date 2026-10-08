/**
 * Durable DE Desk (public advisor) conversation store.
 * Neon-backed with in-memory fallback — same pattern as portalChatStore.
 */
import { sql } from "drizzle-orm";
import { db, dbReady, initPromise } from "../../db";
import { randomBytes } from "crypto";

export type DeskChatRole = "user" | "assistant" | "agent";

export type DeskChatMessage = {
  id: string;
  sessionId: string;
  role: DeskChatRole;
  content: string;
  senderName: string | null;
  createdAt: string;
};

export type DeskChatSessionSummary = {
  sessionId: string;
  email: string | null;
  contactName: string | null;
  companyName: string | null;
  pagePath: string | null;
  messageCount: number;
  preview: string | null;
  agentActive: boolean;
  agentName: string | null;
  agentJoinedAt: string | null;
  /** Set once DE staff archive the chat; archived chats leave the live list. */
  archivedAt: string | null;
  /** The company folder an archived chat is filed under (see archiveFolderFor). */
  archiveFolder: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Folder for archived chats whose visitor gave no usable company. */
export const NO_COMPANY_FOLDER = "No company";

/**
 * Answers the desk records for "what company are you with?" that are not a
 * company ("none", "walk-in", "just myself"). These all file into one folder
 * instead of a folder each.
 */
const NOT_A_COMPANY = new Set([
  "none", "no", "no company", "n/a", "na", "-", "nothing", "walk-in", "walk in",
  "walkin", "myself", "just myself", "me", "self", "individual", "personal",
  "home", "unknown", "not given", "none given",
]);

/**
 * The company folder an archived chat drops into. Spelling variants of one
 * company ("Acme  Corp", "acme corp.") land in the same folder: the key is
 * case- and whitespace-insensitive, and the folder keeps the first spelling.
 */
export function archiveFolderFor(companyName: string | null | undefined): string {
  const name = String(companyName || "").replace(/\s+/g, " ").trim().replace(/[.,]+$/, "");
  if (!name || NOT_A_COMPANY.has(name.toLowerCase())) return NO_COMPANY_FOLDER;
  return name.slice(0, 120);
}

export function archiveFolderKey(folder: string): string {
  return folder.toLowerCase();
}

/** Agent claim stays live for this long after the last agent message. */
export const AGENT_LIVE_MS = 45 * 60 * 1000;

const memorySessions = new Map<
  string,
  {
    email: string | null;
    contactName: string | null;
    companyName: string | null;
    pagePath: string | null;
    agentActive: boolean;
    agentName: string | null;
    agentJoinedAt: string | null;
    archivedAt: string | null;
    archiveFolder: string | null;
    createdAt: string;
    updatedAt: string;
    messages: DeskChatMessage[];
  }
>();

function parseRole(raw: unknown): DeskChatRole {
  if (raw === "agent") return "agent";
  if (raw === "assistant") return "assistant";
  return "user";
}

function isAgentLive(agentActive: boolean, updatedAt: string, lastAgentAt?: string | null): boolean {
  if (!agentActive) return false;
  const anchor = lastAgentAt || updatedAt;
  return Date.now() - Date.parse(anchor) < AGENT_LIVE_MS;
}

let schemaReady = false;

function newId(): string {
  return randomBytes(16).toString("hex");
}

function normalizeRows(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  const rows = (result as any)?.rows;
  return Array.isArray(rows) ? rows : [];
}

async function ensureSchema(): Promise<void> {
  if (schemaReady || !dbReady || !db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS de_desk_chat_sessions (
        session_id varchar PRIMARY KEY,
        email varchar,
        contact_name text,
        company_name text,
        page_path text,
        agent_active boolean DEFAULT false NOT NULL,
        agent_name text,
        agent_joined_at timestamptz,
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS de_desk_chat_messages (
        id varchar PRIMARY KEY,
        session_id varchar NOT NULL,
        role text NOT NULL,
        content text NOT NULL,
        sender_name text,
        created_at timestamptz DEFAULT now() NOT NULL
      )
    `);
    // Additive migrations for stores created before agent handoff
    await db.execute(sql`
      ALTER TABLE de_desk_chat_sessions
      ADD COLUMN IF NOT EXISTS agent_active boolean DEFAULT false NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE de_desk_chat_sessions
      ADD COLUMN IF NOT EXISTS agent_name text
    `);
    await db.execute(sql`
      ALTER TABLE de_desk_chat_sessions
      ADD COLUMN IF NOT EXISTS agent_joined_at timestamptz
    `);
    await db.execute(sql`
      ALTER TABLE de_desk_chat_messages
      ADD COLUMN IF NOT EXISTS sender_name text
    `);
    await db.execute(sql`
      ALTER TABLE de_desk_chat_sessions
      ADD COLUMN IF NOT EXISTS archived_at timestamptz
    `);
    await db.execute(sql`
      ALTER TABLE de_desk_chat_sessions
      ADD COLUMN IF NOT EXISTS archive_folder text
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_de_desk_sessions_email
      ON de_desk_chat_sessions (email, updated_at DESC)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_de_desk_messages_session
      ON de_desk_chat_messages (session_id, created_at)
    `);
    schemaReady = true;
  } catch (err: any) {
    console.warn("[de-desk-persist] schema ensure:", err?.message);
  }
}

export async function initDeskChatStore(): Promise<void> {
  await initPromise;
  await ensureSchema();
  if (dbReady && schemaReady) {
    console.log("✅ DE Desk chat store ready (Neon)");
  } else {
    console.warn("⚠️ DE Desk chat store: DB unavailable — using memory (non-durable)");
  }
}

function emptyMemSession(now: string) {
  return {
    email: null as string | null,
    contactName: null as string | null,
    companyName: null as string | null,
    pagePath: null as string | null,
    agentActive: false,
    agentName: null as string | null,
    agentJoinedAt: null as string | null,
    archivedAt: null as string | null,
    archiveFolder: null as string | null,
    createdAt: now,
    updatedAt: now,
    messages: [] as DeskChatMessage[],
  };
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function mapSessionRow(
  row: any,
  messageCount: number,
  preview: string | null,
): DeskChatSessionSummary {
  const updatedAt = toIso(row.updated_at);
  const agentJoinedAt = row.agent_joined_at ? toIso(row.agent_joined_at) : null;
  const agentActive = isAgentLive(!!row.agent_active, updatedAt, agentJoinedAt);
  return {
    sessionId: String(row.session_id),
    email: row.email ? String(row.email) : null,
    contactName: row.contact_name ? String(row.contact_name) : null,
    companyName: row.company_name ? String(row.company_name) : null,
    pagePath: row.page_path ? String(row.page_path) : null,
    messageCount,
    preview,
    agentActive,
    agentName: row.agent_name ? String(row.agent_name) : null,
    agentJoinedAt,
    archivedAt: row.archived_at ? toIso(row.archived_at) : null,
    archiveFolder: row.archived_at ? String(row.archive_folder || NO_COMPANY_FOLDER) : null,
    createdAt: toIso(row.created_at),
    updatedAt,
  };
}

function mapMessageRow(m: any): DeskChatMessage {
  return {
    id: String(m.id),
    sessionId: String(m.session_id),
    role: parseRole(m.role),
    content: String(m.content),
    senderName: m.sender_name ? String(m.sender_name) : null,
    createdAt: toIso(m.created_at),
  };
}

function memSummary(sessionId: string, s: ReturnType<typeof emptyMemSession>): DeskChatSessionSummary {
  const lastUser = [...s.messages].reverse().find((m) => m.role === "user");
  const lastAgent = [...s.messages].reverse().find((m) => m.role === "agent");
  return {
    sessionId,
    email: s.email,
    contactName: s.contactName,
    companyName: s.companyName,
    pagePath: s.pagePath,
    messageCount: s.messages.length,
    preview: lastUser?.content.slice(0, 160) || null,
    agentActive: isAgentLive(s.agentActive, s.updatedAt, lastAgent?.createdAt || s.agentJoinedAt),
    agentName: s.agentName,
    agentJoinedAt: s.agentJoinedAt,
    archivedAt: s.archivedAt,
    archiveFolder: s.archivedAt ? s.archiveFolder || NO_COMPANY_FOLDER : null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export async function upsertDeskSession(input: {
  sessionId: string;
  email?: string | null;
  contactName?: string | null;
  companyName?: string | null;
  pagePath?: string | null;
}): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  const mem = memorySessions.get(input.sessionId) || emptyMemSession(now);
  if (input.email) mem.email = input.email.toLowerCase();
  if (input.contactName) mem.contactName = input.contactName;
  if (input.companyName) mem.companyName = input.companyName;
  if (input.pagePath) mem.pagePath = input.pagePath;
  mem.updatedAt = now;
  memorySessions.set(input.sessionId, mem);

  if (!(dbReady && db && schemaReady)) return;
  try {
    await db.execute(sql`
      INSERT INTO de_desk_chat_sessions
        (session_id, email, contact_name, company_name, page_path, agent_active, agent_name, agent_joined_at, created_at, updated_at)
      VALUES (
        ${input.sessionId},
        ${mem.email},
        ${mem.contactName},
        ${mem.companyName},
        ${mem.pagePath},
        ${mem.agentActive},
        ${mem.agentName},
        ${mem.agentJoinedAt ? new Date(mem.agentJoinedAt) : null},
        ${new Date(mem.createdAt)},
        ${new Date(now)}
      )
      ON CONFLICT (session_id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, de_desk_chat_sessions.email),
        contact_name = COALESCE(EXCLUDED.contact_name, de_desk_chat_sessions.contact_name),
        company_name = COALESCE(EXCLUDED.company_name, de_desk_chat_sessions.company_name),
        page_path = COALESCE(EXCLUDED.page_path, de_desk_chat_sessions.page_path),
        updated_at = EXCLUDED.updated_at
    `);
  } catch (err: any) {
    console.warn("[de-desk-persist] upsert session failed:", err?.message);
  }
}

export async function appendDeskMessage(input: {
  sessionId: string;
  role: DeskChatRole;
  content: string;
  senderName?: string | null;
  email?: string | null;
  contactName?: string | null;
  companyName?: string | null;
  pagePath?: string | null;
}): Promise<DeskChatMessage> {
  await upsertDeskSession({
    sessionId: input.sessionId,
    email: input.email,
    contactName: input.contactName,
    companyName: input.companyName,
    pagePath: input.pagePath,
  });

  const message: DeskChatMessage = {
    id: newId(),
    sessionId: input.sessionId,
    role: input.role,
    content: input.content.trim().slice(0, 8000),
    senderName: input.senderName?.trim().slice(0, 120) || null,
    createdAt: new Date().toISOString(),
  };

  const mem = memorySessions.get(input.sessionId)!;
  mem.messages.push(message);
  if (mem.messages.length > 100) mem.messages = mem.messages.slice(-100);
  mem.updatedAt = message.createdAt;
  if (input.role === "user" && mem.archivedAt) {
    // The visitor came back: the chat returns to the live list.
    mem.archivedAt = null;
    mem.archiveFolder = null;
  }
  if (input.role === "agent") {
    mem.agentActive = true;
    mem.agentName = message.senderName || mem.agentName || "DE Agent";
    mem.agentJoinedAt = message.createdAt;
  }

  if (dbReady && db && schemaReady) {
    try {
      await db.execute(sql`
        INSERT INTO de_desk_chat_messages (id, session_id, role, content, sender_name, created_at)
        VALUES (
          ${message.id},
          ${message.sessionId},
          ${message.role},
          ${message.content},
          ${message.senderName},
          ${new Date(message.createdAt)}
        )
      `);
      if (input.role === "agent") {
        await db.execute(sql`
          UPDATE de_desk_chat_sessions
          SET updated_at = ${new Date(message.createdAt)},
              agent_active = true,
              agent_name = ${mem.agentName},
              agent_joined_at = ${new Date(message.createdAt)}
          WHERE session_id = ${input.sessionId}
        `);
      } else if (input.role === "user") {
        await db.execute(sql`
          UPDATE de_desk_chat_sessions
          SET updated_at = ${new Date(message.createdAt)},
              archived_at = NULL,
              archive_folder = NULL
          WHERE session_id = ${input.sessionId}
        `);
      } else {
        await db.execute(sql`
          UPDATE de_desk_chat_sessions
          SET updated_at = ${new Date(message.createdAt)}
          WHERE session_id = ${input.sessionId}
        `);
      }
    } catch (err: any) {
      console.warn("[de-desk-persist] append message DB failed:", err?.message);
    }
  }

  return message;
}

export async function claimDeskSession(
  sessionId: string,
  agentName: string,
): Promise<DeskChatSessionSummary | null> {
  await ensureSchema();
  const now = new Date().toISOString();
  const name = agentName.trim().slice(0, 120) || "DE Agent";
  let mem = memorySessions.get(sessionId);
  if (!mem) {
    const existing = await getDeskSessionMessages(sessionId);
    if (!existing.session) return null;
    mem = emptyMemSession(existing.session.createdAt);
    mem.email = existing.session.email;
    mem.contactName = existing.session.contactName;
    mem.companyName = existing.session.companyName;
    mem.pagePath = existing.session.pagePath;
    mem.messages = existing.messages;
    mem.createdAt = existing.session.createdAt;
  }
  mem.agentActive = true;
  mem.agentName = name;
  mem.agentJoinedAt = now;
  mem.updatedAt = now;
  memorySessions.set(sessionId, mem);

  if (dbReady && db && schemaReady) {
    try {
      await db.execute(sql`
        UPDATE de_desk_chat_sessions
        SET agent_active = true,
            agent_name = ${name},
            agent_joined_at = ${new Date(now)},
            updated_at = ${new Date(now)}
        WHERE session_id = ${sessionId}
      `);
    } catch (err: any) {
      console.warn("[de-desk-persist] claim failed:", err?.message);
    }
  }
  return memSummary(sessionId, mem);
}

export async function releaseDeskSession(sessionId: string): Promise<DeskChatSessionSummary | null> {
  await ensureSchema();
  const now = new Date().toISOString();
  const mem = memorySessions.get(sessionId);
  if (mem) {
    mem.agentActive = false;
    mem.updatedAt = now;
  }

  if (dbReady && db && schemaReady) {
    try {
      await db.execute(sql`
        UPDATE de_desk_chat_sessions
        SET agent_active = false, updated_at = ${new Date(now)}
        WHERE session_id = ${sessionId}
      `);
    } catch (err: any) {
      console.warn("[de-desk-persist] release failed:", err?.message);
    }
  }

  const { session } = await getDeskSessionMessages(sessionId);
  return session;
}

export async function isDeskAgentLive(sessionId: string): Promise<{
  live: boolean;
  agentName: string | null;
}> {
  const { session, messages } = await getDeskSessionMessages(sessionId);
  if (!session) return { live: false, agentName: null };
  const lastAgent = [...messages].reverse().find((m) => m.role === "agent");
  const live = isAgentLive(
    session.agentActive,
    session.updatedAt,
    lastAgent?.createdAt || session.agentJoinedAt,
  );
  return { live, agentName: live ? session.agentName || lastAgent?.senderName || "DE Agent" : null };
}

export async function listDeskSessions(opts?: {
  email?: string;
  limit?: number;
  /**
   * true: only archived chats; false/omitted: only live (unarchived) ones;
   * "all": both. The archive is a DE-staff filing tool, so a client's own
   * list ignores it ("all").
   */
  archived?: boolean | "all";
}): Promise<DeskChatSessionSummary[]> {
  await ensureSchema();
  const limit = Math.min(Math.max(opts?.limit || 50, 1), opts?.archived === true ? 500 : 200);
  const email = opts?.email?.toLowerCase();
  const all = opts?.archived === "all";
  const archived = opts?.archived === true;

  if (dbReady && db && schemaReady) {
    try {
      const result = email
        ? await db.execute(sql`
            SELECT s.session_id, s.email, s.contact_name, s.company_name, s.page_path,
                   s.agent_active, s.agent_name, s.agent_joined_at,
                   s.archived_at, s.archive_folder,
                   s.created_at, s.updated_at,
                   (SELECT COUNT(*)::int FROM de_desk_chat_messages m WHERE m.session_id = s.session_id) AS message_count,
                   (SELECT m.content FROM de_desk_chat_messages m
                      WHERE m.session_id = s.session_id AND m.role = 'user'
                      ORDER BY m.created_at DESC LIMIT 1) AS preview
            FROM de_desk_chat_sessions s
            WHERE lower(s.email) = ${email}
              AND (${all} OR (s.archived_at IS NOT NULL) = ${archived})
            ORDER BY s.updated_at DESC
            LIMIT ${limit}
          `)
        : await db.execute(sql`
            SELECT s.session_id, s.email, s.contact_name, s.company_name, s.page_path,
                   s.agent_active, s.agent_name, s.agent_joined_at,
                   s.archived_at, s.archive_folder,
                   s.created_at, s.updated_at,
                   (SELECT COUNT(*)::int FROM de_desk_chat_messages m WHERE m.session_id = s.session_id) AS message_count,
                   (SELECT m.content FROM de_desk_chat_messages m
                      WHERE m.session_id = s.session_id AND m.role = 'user'
                      ORDER BY m.created_at DESC LIMIT 1) AS preview
            FROM de_desk_chat_sessions s
            WHERE ${all} OR (s.archived_at IS NOT NULL) = ${archived}
            ORDER BY s.updated_at DESC
            LIMIT ${limit}
          `);

      return normalizeRows(result).map((row) =>
        mapSessionRow(
          row,
          Number(row.message_count || 0),
          row.preview ? String(row.preview).slice(0, 160) : null,
        ),
      );
    } catch (err: any) {
      console.warn("[de-desk-persist] list sessions failed:", err?.message);
    }
  }

  let entries = Array.from(memorySessions.entries()).filter(([, s]) => all || !!s.archivedAt === archived);
  if (email) {
    entries = entries.filter(([, s]) => s.email === email);
  }
  return entries
    .sort((a, b) => Date.parse(b[1].updatedAt) - Date.parse(a[1].updatedAt))
    .slice(0, limit)
    .map(([sessionId, s]) => memSummary(sessionId, s));
}

export async function getDeskSessionMessages(
  sessionId: string,
): Promise<{ session: DeskChatSessionSummary | null; messages: DeskChatMessage[] }> {
  await ensureSchema();

  if (dbReady && db && schemaReady) {
    try {
      const sessionResult = await db.execute(sql`
        SELECT session_id, email, contact_name, company_name, page_path,
               agent_active, agent_name, agent_joined_at, archived_at, archive_folder,
               created_at, updated_at
        FROM de_desk_chat_sessions
        WHERE session_id = ${sessionId}
        LIMIT 1
      `);
      const sessionRows = normalizeRows(sessionResult);
      if (sessionRows.length > 0) {
        const row = sessionRows[0];
        const msgResult = await db.execute(sql`
          SELECT id, session_id, role, content, sender_name, created_at
          FROM de_desk_chat_messages
          WHERE session_id = ${sessionId}
          ORDER BY created_at ASC
          LIMIT 200
        `);
        const messages = normalizeRows(msgResult).map(mapMessageRow);
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        // Keep memory warm for claim/agent paths
        const mem = memorySessions.get(sessionId) || emptyMemSession(toIso(row.created_at));
        mem.email = row.email ? String(row.email) : null;
        mem.contactName = row.contact_name ? String(row.contact_name) : null;
        mem.companyName = row.company_name ? String(row.company_name) : null;
        mem.pagePath = row.page_path ? String(row.page_path) : null;
        mem.agentActive = !!row.agent_active;
        mem.agentName = row.agent_name ? String(row.agent_name) : null;
        mem.agentJoinedAt = row.agent_joined_at ? toIso(row.agent_joined_at) : null;
        mem.archivedAt = row.archived_at ? toIso(row.archived_at) : null;
        mem.archiveFolder = row.archive_folder ? String(row.archive_folder) : null;
        mem.createdAt = toIso(row.created_at);
        mem.updatedAt = toIso(row.updated_at);
        mem.messages = messages;
        memorySessions.set(sessionId, mem);
        return {
          session: mapSessionRow(
            row,
            messages.length,
            lastUser?.content.slice(0, 160) || null,
          ),
          messages,
        };
      }
    } catch (err: any) {
      console.warn("[de-desk-persist] get session failed:", err?.message);
    }
  }

  const mem = memorySessions.get(sessionId);
  if (!mem) return { session: null, messages: [] };
  return { session: memSummary(sessionId, mem), messages: mem.messages };
}

/** Public/widget poll: messages after a given ISO timestamp (exclusive). */
export async function getDeskMessagesSince(
  sessionId: string,
  sinceIso?: string | null,
): Promise<{
  session: DeskChatSessionSummary | null;
  messages: DeskChatMessage[];
  agentLive: boolean;
  agentName: string | null;
}> {
  const { session, messages } = await getDeskSessionMessages(sessionId);
  if (!session) {
    return { session: null, messages: [], agentLive: false, agentName: null };
  }
  const sinceMs = sinceIso ? Date.parse(sinceIso) : 0;
  const filtered =
    sinceMs > 0
      ? messages.filter((m) => Date.parse(m.createdAt) > sinceMs)
      : messages;
  const lastAgent = [...messages].reverse().find((m) => m.role === "agent");
  const agentLive = isAgentLive(
    session.agentActive,
    session.updatedAt,
    lastAgent?.createdAt || session.agentJoinedAt,
  );
  return {
    session,
    messages: filtered,
    agentLive,
    agentName: agentLive ? session.agentName || lastAgent?.senderName || "DE Agent" : null,
  };
}

/**
 * File chats into their company folder. A visitor who writes again in an
 * archived chat brings it back to the live list (appendDeskMessage), so an
 * archive never hides someone waiting on a reply. Folder names reuse an existing folder's spelling when one matches,
 * so "acme corp" and "Acme Corp" never split into two folders.
 */
export async function archiveDeskSessions(sessionIds: string[]): Promise<DeskChatSessionSummary[]> {
  await ensureSchema();
  const now = new Date().toISOString();
  const existingFolders = new Map<string, string>();
  for (const s of await listDeskSessions({ archived: true, limit: 500 })) {
    if (s.archiveFolder) {
      const key = archiveFolderKey(s.archiveFolder);
      if (!existingFolders.has(key)) existingFolders.set(key, s.archiveFolder);
    }
  }
  const out: DeskChatSessionSummary[] = [];
  // Oldest chat first, so a new folder takes the spelling of the company's first chat.
  const found: DeskChatSessionSummary[] = [];
  for (const sessionId of sessionIds) {
    const { session } = await getDeskSessionMessages(sessionId);
    if (session) found.push(session);
  }
  found.sort((x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt) || x.sessionId.localeCompare(y.sessionId));
  for (const session of found) {
    const sessionId = session.sessionId;
    const proposed = archiveFolderFor(session.companyName);
    const key = archiveFolderKey(proposed);
    const folder = existingFolders.get(key) || proposed;
    existingFolders.set(key, folder);
    const mem = memorySessions.get(sessionId);
    if (mem) {
      mem.archivedAt = now;
      mem.archiveFolder = folder;
    }
    if (dbReady && db && schemaReady) {
      try {
        await db.execute(sql`
          UPDATE de_desk_chat_sessions
          SET archived_at = ${new Date(now)}, archive_folder = ${folder}
          WHERE session_id = ${sessionId}
        `);
      } catch (err: any) {
        console.warn("[de-desk-persist] archive failed:", err?.message);
        continue;
      }
    }
    out.push({ ...session, archivedAt: now, archiveFolder: folder });
  }
  return out;
}

/** Every live chat whose company files into the same folder as this one. */
export async function sessionIdsInSameCompany(sessionId: string): Promise<string[]> {
  const { session } = await getDeskSessionMessages(sessionId);
  if (!session) return [];
  const key = archiveFolderKey(archiveFolderFor(session.companyName));
  const live = await listDeskSessions({ limit: 200 });
  const ids = live
    .filter((s) => archiveFolderKey(archiveFolderFor(s.companyName)) === key)
    .map((s) => s.sessionId);
  return ids.includes(sessionId) ? ids : [sessionId, ...ids];
}

export async function unarchiveDeskSession(sessionId: string): Promise<DeskChatSessionSummary | null> {
  await ensureSchema();
  const mem = memorySessions.get(sessionId);
  if (mem) {
    mem.archivedAt = null;
    mem.archiveFolder = null;
  }
  if (dbReady && db && schemaReady) {
    try {
      await db.execute(sql`
        UPDATE de_desk_chat_sessions
        SET archived_at = NULL, archive_folder = NULL
        WHERE session_id = ${sessionId}
      `);
    } catch (err: any) {
      console.warn("[de-desk-persist] unarchive failed:", err?.message);
    }
  }
  const { session } = await getDeskSessionMessages(sessionId);
  return session;
}

/** Permanently remove a chat and its messages. Returns false if it did not exist. */
export async function deleteDeskSession(sessionId: string): Promise<boolean> {
  await ensureSchema();
  const { session } = await getDeskSessionMessages(sessionId);
  if (!session) return false;
  memorySessions.delete(sessionId);
  if (dbReady && db && schemaReady) {
    await db.execute(sql`DELETE FROM de_desk_chat_messages WHERE session_id = ${sessionId}`);
    await db.execute(sql`DELETE FROM de_desk_chat_sessions WHERE session_id = ${sessionId}`);
  }
  return true;
}

export function getDeskStoreStatus(): { durable: boolean } {
  return { durable: !!(dbReady && schemaReady) };
}

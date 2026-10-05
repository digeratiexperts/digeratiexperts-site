/**
 * Durable portal live-chat store — Neon-backed with in-memory fallback.
 * Conversation key is always live-{userId} so messages survive restarts
 * without depending on portal_tickets FKs.
 */
import { sql } from "drizzle-orm";
import { db, dbReady, initPromise } from "./db";
import { randomBytes } from "crypto";
import {
  continuesSession,
  groupIntoSessions,
  newSessionId,
  type PortalChatSessionSummary,
} from "./portalChatSessions";

export type { PortalChatSessionSummary };

export type LiveChatMessage = {
  id: string;
  conversationId: string;
  userId: string;
  senderName: string;
  senderRole: "client" | "support";
  content: string;
  isRead: boolean;
  timestamp: string;
  /** The run this message belongs to. Null only on rows written before chats
   *  were split into runs; those are grouped by the idle rule on read. */
  sessionId: string | null;
};

const memoryByConversation = new Map<string, LiveChatMessage[]>();
let schemaReady = false;

function newId(): string {
  return randomBytes(16).toString("hex");
}

export function conversationIdForUser(userId: string): string {
  return `live-${userId}`;
}

async function ensureSchema(): Promise<void> {
  if (schemaReady || !dbReady || !db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS portal_live_chat_messages (
        id varchar PRIMARY KEY,
        conversation_id varchar NOT NULL,
        user_id varchar NOT NULL,
        sender_name text NOT NULL,
        sender_role text NOT NULL,
        content text NOT NULL,
        is_read boolean DEFAULT false,
        session_id varchar,
        created_at timestamptz DEFAULT now() NOT NULL
      )
    `);
    // Existing deployments have the table without the column. Added separately
    // and nullable, so no row has to be rewritten and old messages keep their
    // place in history rather than being guessed at by a backfill UPDATE.
    await db.execute(sql`
      ALTER TABLE portal_live_chat_messages ADD COLUMN IF NOT EXISTS session_id varchar
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_portal_live_chat_session
      ON portal_live_chat_messages (session_id, created_at)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_portal_live_chat_conv_created
      ON portal_live_chat_messages (conversation_id, created_at)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_portal_live_chat_user
      ON portal_live_chat_messages (user_id, created_at)
    `);
    schemaReady = true;
  } catch (err: any) {
    console.warn("[portalChatStore] schema ensure:", err?.message);
  }
}

export async function initPortalChatStore(): Promise<void> {
  await initPromise;
  await ensureSchema();
  if (dbReady && schemaReady) {
    console.log("✅ Portal live chat store ready (Neon)");
  } else {
    console.warn("⚠️ Portal live chat store: DB unavailable — using memory (non-durable)");
  }
}

function rowToMessage(row: {
  id: string;
  conversation_id: string;
  user_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  is_read: boolean | null;
  session_id?: string | null;
  created_at: Date | string;
}): LiveChatMessage {
  const created =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString();
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    senderName: row.sender_name,
    senderRole: row.sender_role === "support" ? "support" : "client",
    content: row.content,
    isRead: !!row.is_read,
    sessionId: row.session_id ?? null,
    timestamp: created,
  };
}

/**
 * Messages for a conversation, oldest first.
 *
 * `sessionId` narrows to one run. The narrowing is done in code rather than in
 * SQL on purpose: rows written before chats were split carry no session_id, so
 * their run ids are derived by the idle rule, and only the grouping knows them.
 * Deriving in one place keeps the stored and the backfilled paths identical.
 * For the same reason a `since` filter is applied after grouping — a partial
 * window has no boundaries to group by.
 */
export async function listMessages(
  conversationId: string,
  opts?: { since?: string; limit?: number; sessionId?: string }
): Promise<LiveChatMessage[]> {
  await ensureSchema();
  const limit = Math.min(Math.max(opts?.limit || 200, 1), 500);
  const sinceMs = opts?.since ? Date.parse(opts.since) : NaN;
  const hasSince = !Number.isNaN(sinceMs);

  const after = (msgs: LiveChatMessage[]): LiveChatMessage[] => {
    let out = msgs;
    if (opts?.sessionId) {
      const ids = sessionIdByMessageId(conversationId, out);
      out = out.filter((m) => ids.get(m.id) === opts.sessionId);
    }
    if (hasSince) out = out.filter((m) => Date.parse(m.timestamp) > sinceMs);
    return out.slice(-limit);
  };

  if (dbReady && db && schemaReady) {
    try {
      const normalizeRows = (result: unknown): any[] => {
        if (Array.isArray(result)) return result;
        const rows = (result as any)?.rows;
        return Array.isArray(rows) ? rows : [];
      };

      // A plain incremental poll can still be answered from a narrow window.
      if (hasSince && !opts?.sessionId) {
        const result = await db.execute(sql`
          SELECT id, conversation_id, user_id, sender_name, sender_role, content, is_read, session_id, created_at
          FROM portal_live_chat_messages
          WHERE conversation_id = ${conversationId}
            AND created_at > ${new Date(sinceMs)}
          ORDER BY created_at ASC
          LIMIT ${limit}
        `);
        return normalizeRows(result).map(rowToMessage);
      }

      const result = await db.execute(sql`
        SELECT id, conversation_id, user_id, sender_name, sender_role, content, is_read, session_id, created_at
        FROM portal_live_chat_messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at ASC
        LIMIT ${Math.max(limit, 500)}
      `);
      return after(normalizeRows(result).map(rowToMessage));
    } catch (err: any) {
      console.warn("[portalChatStore] listMessages failed:", err?.message);
    }
  }

  return after(memoryByConversation.get(conversationId) || []);
}

/** Message id -> the run it belongs to, stored or derived. */
function sessionIdByMessageId(
  conversationId: string,
  msgs: LiveChatMessage[]
): Map<string, string> {
  const out = new Map<string, string>();
  const sessions = groupIntoSessions(conversationId, msgs);
  let cursor = 0;
  for (const session of sessions) {
    for (let i = 0; i < session.messageCount; i += 1) {
      out.set(msgs[cursor].id, session.sessionId);
      cursor += 1;
    }
  }
  return out;
}

/**
 * Every chat this user has had, newest last, each with the date and preview a
 * collapsed row needs. Closed runs are kept, not pruned — a chat nobody
 * continued is still a chat somebody at DE may need to pick up.
 */
export async function listSessions(conversationId: string): Promise<PortalChatSessionSummary[]> {
  const msgs = await listMessages(conversationId, { limit: 500 });
  return groupIntoSessions(conversationId, msgs);
}

/**
 * The run a message sent now would join: the last one if it is still inside the
 * idle window, otherwise a new one. Resolving without writing lets a reader ask
 * "which chat am I in?" without starting one.
 */
export async function currentSessionId(conversationId: string, now: Date = new Date()): Promise<string> {
  const sessions = await listSessions(conversationId);
  const last = sessions[sessions.length - 1];
  if (last && continuesSession(last.lastAt, now)) return last.sessionId;
  return newSessionId(conversationId, now);
}

export async function appendMessage(input: {
  conversationId: string;
  userId: string;
  senderName: string;
  senderRole: "client" | "support";
  content: string;
  /** Join this run explicitly. Omitted, the run is resolved from the clock, so
   *  a message after a long quiet gap opens a new chat instead of reviving one
   *  nobody was going to continue. */
  sessionId?: string;
}): Promise<LiveChatMessage> {
  await ensureSchema();
  const sessionId = input.sessionId ?? (await currentSessionId(input.conversationId));
  const message: LiveChatMessage = {
    id: newId(),
    conversationId: input.conversationId,
    userId: input.userId,
    senderName: input.senderName,
    senderRole: input.senderRole,
    content: input.content.trim(),
    isRead: input.senderRole === "client",
    sessionId,
    timestamp: new Date().toISOString(),
  };

  if (dbReady && db && schemaReady) {
    try {
      await db.execute(sql`
        INSERT INTO portal_live_chat_messages
          (id, conversation_id, user_id, sender_name, sender_role, content, is_read, session_id, created_at)
        VALUES (
          ${message.id},
          ${message.conversationId},
          ${message.userId},
          ${message.senderName},
          ${message.senderRole},
          ${message.content},
          ${message.isRead},
          ${message.sessionId},
          ${new Date(message.timestamp)}
        )
      `);
    } catch (err: any) {
      console.warn("[portalChatStore] appendMessage DB failed, using memory:", err?.message);
      const list = memoryByConversation.get(message.conversationId) || [];
      list.push(message);
      memoryByConversation.set(message.conversationId, list);
      return message;
    }
  }

  const list = memoryByConversation.get(message.conversationId) || [];
  list.push(message);
  memoryByConversation.set(message.conversationId, list);
  return message;
}

/**
 * Greet the start of a chat, not the start of a lifetime. The welcome is
 * written once per run, so someone returning a week later opens a fresh thread
 * that reads like one, rather than appending to a wall of old messages.
 */
export async function ensureWelcomeMessage(
  conversationId: string,
  userId: string
): Promise<LiveChatMessage | null> {
  const sessionId = await currentSessionId(conversationId);
  const existing = await listMessages(conversationId, { limit: 1, sessionId });
  if (existing.length > 0) return null;

  return appendMessage({
    conversationId,
    userId,
    sessionId,
    senderName: "DE Support",
    senderRole: "support",
    content:
      "Welcome to Digerati Experts Live Chat. Ask a question anytime — our assistant will help immediately, and the team monitors conversations during business hours (Mon–Fri, 9 AM–6 PM EST).",
  });
}

export function getChatStoreStatus(): {
  durable: boolean;
  transport: "http-poll";
} {
  return {
    durable: !!(dbReady && schemaReady),
    transport: "http-poll",
  };
}

/**
 * The Ask DE conversation, kept for the browser tab.
 *
 * A visitor who reloads, or opens a page in the same tab after a full load,
 * returns to the same conversation instead of a fresh greeting. It lives in
 * sessionStorage (this tab only, gone when the tab closes) and expires after
 * DESK_CHAT_TTL_MS. Storage failures (private mode, quota, blocked storage)
 * are ignored: the Desk simply starts fresh.
 */

import { sanitizeDeskActions, type DeskAction } from "./deskActions";

export type DeskStoredRole = "user" | "assistant" | "agent";

export type DeskStoredMessage = {
  id: string;
  role: DeskStoredRole;
  content: string;
  senderName?: string | null;
  createdAt?: string;
  actions?: DeskAction[];
};

export type DeskStoredChat = {
  sessionId: string | null;
  messages: DeskStoredMessage[];
  savedAt: number;
};

export const DESK_CHAT_STORAGE_KEY = "de-desk-chat-v1";
export const DESK_CHAT_TTL_MS = 12 * 60 * 60 * 1000;
export const DESK_CHAT_MAX_MESSAGES = 60;

const ROLES: readonly DeskStoredRole[] = ["user", "assistant", "agent"];

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function isMessage(value: unknown): value is DeskStoredMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.content === "string" &&
    ROLES.includes(m.role as DeskStoredRole) &&
    (m.createdAt === undefined || typeof m.createdAt === "string") &&
    (m.senderName === undefined || m.senderName === null || typeof m.senderName === "string")
  );
}

/** The stored conversation, or null when there is none, it expired, or it does not parse. */
export function readDeskChat(now = Date.now()): DeskStoredChat | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(DESK_CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeskStoredChat>;
    if (typeof parsed.savedAt !== "number" || now - parsed.savedAt > DESK_CHAT_TTL_MS) {
      store.removeItem(DESK_CHAT_STORAGE_KEY);
      return null;
    }
    const messages = (Array.isArray(parsed.messages) ? parsed.messages.filter(isMessage) : []).map((m) => {
      const actions = sanitizeDeskActions((m as { actions?: unknown }).actions);
      const { actions: _dropped, ...rest } = m as DeskStoredMessage;
      return actions.length ? { ...rest, actions } : rest;
    });
    // Nothing worth restoring unless the visitor actually said something.
    if (!messages.some((m) => m.role === "user")) return null;
    return {
      sessionId: typeof parsed.sessionId === "string" && parsed.sessionId ? parsed.sessionId : null,
      messages,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

/** Save the conversation. Only once the visitor has sent something; keeps the newest messages. */
export function writeDeskChat(sessionId: string | null, messages: DeskStoredMessage[], now = Date.now()): void {
  const store = storage();
  if (!store) return;
  if (!messages.some((m) => m.role === "user")) return;
  const kept = messages.slice(-DESK_CHAT_MAX_MESSAGES).map(({ id, role, content, senderName, createdAt, actions }) => ({
    id,
    role,
    content,
    senderName: senderName ?? null,
    createdAt,
    ...(actions?.length ? { actions } : {}),
  }));
  try {
    store.setItem(DESK_CHAT_STORAGE_KEY, JSON.stringify({ sessionId, messages: kept, savedAt: now }));
  } catch {
    /* quota or blocked storage: the conversation just is not kept */
  }
}

export function clearDeskChat(): void {
  try {
    storage()?.removeItem(DESK_CHAT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * A ticket drafted from the conversation: the visitor's own words only (the
 * Desk's replies are not evidence of the problem), the first message as the
 * summary. The ticket also carries the chat session id, so the desk can open
 * the full thread.
 */
export function ticketDraftFromChat(messages: DeskStoredMessage[]): { subject: string; message: string } | null {
  const said = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!said.length) return null;
  const first = said[0];
  const subject = first.length > 80 ? `${first.slice(0, 77).trimEnd()}…` : first;
  const message = ["From my Ask DE conversation:", ...said.map((line) => `- ${line}`)].join("\n").slice(0, 4000);
  return { subject, message };
}

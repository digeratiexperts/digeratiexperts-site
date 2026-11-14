import { randomBytes } from "crypto";
import type { AdvisorSession, ChatMessage, ConversationProfile, PageContext } from "./types";
import { createEmptyProfile } from "./profile";

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_MESSAGES = 24;

const sessions = new Map<string, AdvisorSession>();

/** Personal contact fields that must never appear on the unauthenticated session GET. */
export const PUBLIC_SESSION_PII_FIELDS = ["email", "phone", "contactName"] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip email addresses and phone numbers from free text. */
export function redactContactPii(text: string, profile?: ConversationProfile): string {
  let out = text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted]")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted]");
  if (profile) {
    for (const value of [profile.email, profile.phone, profile.contactName]) {
      const trimmed = (value || "").trim();
      if (trimmed.length < 2) continue;
      out = out.replace(new RegExp(escapeRegExp(trimmed), "gi"), "[redacted]");
    }
  }
  return out;
}

export function publicProfileView(
  profile: ConversationProfile,
): Omit<ConversationProfile, "email" | "phone" | "contactName"> {
  const { email: _email, phone: _phone, contactName: _contactName, ...safe } = profile;
  return safe;
}

function newId(): string {
  return randomBytes(16).toString("hex");
}

function pruneExpired(now = Date.now()): void {
  for (const [id, s] of Array.from(sessions.entries())) {
    if (now - s.updatedAt > TTL_MS) sessions.delete(id);
  }
}

export function createSession(pageContext?: PageContext): AdvisorSession {
  pruneExpired();
  const now = Date.now();
  const session: AdvisorSession = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    messages: [],
    profile: createEmptyProfile(),
    lastMode: "msp_discovery",
    analyticsFlags: {},
    pageContext,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string | undefined): AdvisorSession | undefined {
  if (!id) return undefined;
  pruneExpired();
  const s = sessions.get(id);
  if (!s) return undefined;
  if (Date.now() - s.updatedAt > TTL_MS) {
    sessions.delete(id);
    return undefined;
  }
  return s;
}

export function getOrCreateSession(id: string | undefined, pageContext?: PageContext): AdvisorSession {
  const existing = getSession(id);
  if (existing) {
    if (pageContext) existing.pageContext = pageContext;
    existing.updatedAt = Date.now();
    return existing;
  }
  return createSession(pageContext);
}

export function appendMessage(session: AdvisorSession, role: ChatMessage["role"], content: string): void {
  session.messages.push({ role, content, at: Date.now() });
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }
  session.updatedAt = Date.now();
}

export function updateProfile(session: AdvisorSession, profile: ConversationProfile): void {
  session.profile = profile;
  session.updatedAt = Date.now();
}

/**
 * Unauthenticated view of a DE Desk session. Email, phone, and contact name are
 * omitted from the profile, and the same values (plus email/phone patterns) are
 * redacted from message text. No client currently calls GET
 * /api/public/advisor/session/:id; this keeps that endpoint from leaking PII
 * to anyone who only has the session id.
 */
export function publicSessionView(session: AdvisorSession) {
  return {
    sessionId: session.id,
    profile: publicProfileView(session.profile),
    messages: session.messages.map((m) => ({
      role: m.role,
      content: redactContactPii(m.content, session.profile),
    })),
    lastMode: session.lastMode,
  };
}

export function getPublicSessionResponse(id: string):
  | { status: 200; body: ReturnType<typeof publicSessionView> }
  | { status: 404; body: { error: string } } {
  const session = getSession(id);
  if (!session) return { status: 404, body: { error: "Session not found" } };
  return { status: 200, body: publicSessionView(session) };
}

/** Test helper */
export function _resetSessionsForTests(): void {
  sessions.clear();
}
/**
 * When one portal chat ends and the next begins.
 *
 * The live chat used to be a single endless transcript per user: a message sent
 * today appended to one sent three weeks ago with nothing between them. Nobody
 * is continuing a conversation after that long, and a support person opening it
 * could not tell where one question stopped and the next started.
 *
 * So a conversation is a RUN of messages. A quiet gap longer than
 * PORTAL_CHAT_IDLE_MS closes the run; the next message opens a new one. Closing
 * is not deleting — every run is kept, which is the point: whoever picks it up
 * later gets a readable thread with a date on it rather than a wall.
 *
 * The rule lives here, apart from the store, so it can be tested without a
 * database and so both the Neon path and the in-memory fallback obey exactly
 * the same definition of "a chat".
 */

/** A quiet gap this long ends a conversation. Twelve hours, so a question asked
 *  in the morning and answered after lunch is still one chat, while anything
 *  spanning a night or a weekend is not. */
export const PORTAL_CHAT_IDLE_MS = 12 * 60 * 60 * 1000;

export type SessionableMessage = {
  id: string;
  sessionId?: string | null;
  content: string;
  senderRole: "client" | "support";
  senderName: string;
  timestamp: string;
};

export type PortalChatSessionSummary = {
  sessionId: string;
  /** First message in the run. */
  startedAt: string;
  /** Last message in the run — what the list sorts and labels by. */
  lastAt: string;
  messageCount: number;
  /** The visitor's last question, for the collapsed row. Empty when they never
   *  spoke, which happens when only the welcome message exists. */
  preview: string;
  /** False once the gap has closed it. A closed run is read-only history. */
  open: boolean;
};

/**
 * A session id that sorts by when the run started and carries its date on its
 * face, so a row is identifiable from the id alone in a log or a support tool.
 */
export function newSessionId(conversationId: string, startedAt: Date): string {
  const stamp = startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return `${conversationId}:${stamp}`;
}

/** True when a message arriving at `now` belongs to a run whose last message
 *  was at `lastAt`. A missing or unparseable `lastAt` means there is no run. */
export function continuesSession(lastAt: string | null | undefined, now: Date): boolean {
  if (!lastAt) return false;
  const last = Date.parse(lastAt);
  if (Number.isNaN(last)) return false;
  const gap = now.getTime() - last;
  // A clock skew that puts the last message in the future must not be read as a
  // gap of its own; only a real quiet stretch closes a run.
  if (gap < 0) return true;
  return gap <= PORTAL_CHAT_IDLE_MS;
}

/**
 * Split a conversation's messages into runs.
 *
 * Messages that already carry a sessionId keep it — that is the stored truth.
 * Messages without one predate sessions, so they are grouped by the same idle
 * rule, which gives the backfill the shape it would have had all along rather
 * than one undated lump.
 *
 * Input must be in ascending time order, as both store paths return it.
 */
export function groupIntoSessions(
  conversationId: string,
  messages: SessionableMessage[],
  now: Date = new Date(),
): PortalChatSessionSummary[] {
  const runs: { id: string; items: SessionableMessage[] }[] = [];

  for (const message of messages) {
    const current = runs[runs.length - 1];
    const stored = message.sessionId?.trim();

    if (current) {
      const currentStored = current.items[current.items.length - 1].sessionId?.trim();
      // Two stored ids disagree, or a stored run meets an unstored one: either
      // way the boundary is explicit and must be honoured over the clock.
      const sameStored = stored && currentStored ? stored === currentStored : !stored && !currentStored;
      if (sameStored && (stored || continuesSession(current.items[current.items.length - 1].timestamp, new Date(message.timestamp)))) {
        current.items.push(message);
        continue;
      }
    }

    runs.push({
      id: stored || newSessionId(conversationId, new Date(message.timestamp)),
      items: [message],
    });
  }

  return runs.map((run) => {
    const first = run.items[0];
    const last = run.items[run.items.length - 1];
    const lastFromVisitor = [...run.items].reverse().find((m) => m.senderRole === "client");
    return {
      sessionId: run.id,
      startedAt: first.timestamp,
      lastAt: last.timestamp,
      messageCount: run.items.length,
      preview: lastFromVisitor?.content ?? "",
      open: continuesSession(last.timestamp, now),
    };
  });
}

import { CARD_DATA_REJECTED_MESSAGE, looksLikeCardData } from "@shared/pciGuard";

/**
 * DE Desk secure field (Intelligence-Hub #1179): the pure half of the masked
 * "share it securely" control used in the website DE Desk, the portal ticket
 * page and both sides of the portal chat.
 *
 * The value is typed into a masked field and sent once, straight to the Hub
 * (through the website server), where it is stored encrypted on the ticket.
 * It never becomes a chat message, a ticket comment or an email, is never
 * synced to Zoho Desk, and the browser only ever gets metadata back.
 */

export const SECURE_FIELD_KINDS = [
  { value: "password", label: "Password" },
  { value: "wifi", label: "Wi-Fi key" },
  { value: "license_key", label: "Licence key" },
  { value: "pin", label: "PIN" },
  { value: "api_key", label: "API key" },
  { value: "other", label: "Other secret" },
] as const;
export type SecureFieldKind = (typeof SECURE_FIELD_KINDS)[number]["value"];

export const SECURE_FIELD_MAX_VALUE_LENGTH = 4096;
export const SECURE_FIELD_LABEL_MAX = 120;

/** Metadata the website server returns. There is deliberately no value field. */
export interface SecureFieldMeta {
  id: number;
  label: string;
  kind: SecureFieldKind;
  status: "active" | "expired";
  submittedBy: { kind: "staff" | "client"; name: string };
  expiresAt: string;
  expiredAt: string | null;
  revealCount: number;
  lastRevealedAt: string | null;
  createdAt: string;
}

export const SECURE_FIELD_STORED_COPY =
  "Stored encrypted with your DE ticket. It never appears in this chat, the ticket thread, email or Zoho Desk, and it expires on its own.";
export const SECURE_FIELD_REVEAL_COPY =
  "DE staff open secure fields from the ticket in the Hub, where every reveal is audited.";

export function secureFieldKindLabel(kind: string): string {
  return SECURE_FIELD_KINDS.find((k) => k.value === kind)?.label ?? "Secret";
}

/** Validate before sending. Messages never include the value. */
export function secureFieldProblem(input: { label: string; secretValue: string }): string | null {
  const label = input.label.trim();
  if (!label) return "Say what it is for, e.g. Office Wi-Fi.";
  if (label.length > SECURE_FIELD_LABEL_MAX) return `Keep the description under ${SECURE_FIELD_LABEL_MAX} characters.`;
  if (!input.secretValue) return "Enter the value to share.";
  if (input.secretValue.length > SECURE_FIELD_MAX_VALUE_LENGTH) return "That value is too long to store.";
  if (looksLikeCardData(input.secretValue) || looksLikeCardData(input.label)) {
    return CARD_DATA_REJECTED_MESSAGE;
  }
  if (input.secretValue.length >= 4 && label.includes(input.secretValue)) {
    return "The description contains the secret itself. Put the value only in the masked field.";
  }
  return null;
}

/** The request body. Built at send time so the value is not kept in component state afterwards. */
export function secureFieldPayload(input: { label: string; kind: SecureFieldKind; secretValue: string }) {
  return { label: input.label.trim(), kind: input.kind, secretValue: input.secretValue };
}

/** One line for a stored field: what, state, until when. No value, ever. */
export function secureFieldSummary(meta: Pick<SecureFieldMeta, "label" | "kind" | "status" | "expiresAt">, now: Date = new Date()): string {
  const kind = secureFieldKindLabel(meta.kind);
  if (meta.status !== "active" || new Date(meta.expiresAt).getTime() <= now.getTime()) {
    return `${meta.label} (${kind}): expired, value removed`;
  }
  const until = new Date(meta.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${meta.label} (${kind}): stored securely until ${until}`;
}

/**
 * Does a chat line look like it carries a credential? Used to stop a password
 * going into a transcript and point the person at the secure field instead.
 * Deliberately narrow: "I forgot my password" or "reset my Wi-Fi" pass; "the
 * password is Tr0ub4dor" or a pasted product key does not.
 */
export function looksLikeSecret(text: string): boolean {
  const t = String(text || "");
  if (!t.trim()) return false;
  const labelled =
    /\b(pass\s?word|passwd|pwd|passcode|pass\s?phrase|pin(?:\s?code)?|wi-?fi\s+(?:password|key|code)|wpa2?\s+key|network\s+key|api[\s_-]?key|secret(?:\s+key)?|licen[cs]e\s+key|product\s+key|serial\s+key)\s*(?:is|was|=|:|->)\s*["'`]?([^\s"'`]{4,})/i;
  const m = labelled.exec(t);
  if (m) {
    const value = m[2].toLowerCase().replace(/[.,!?;]+$/, "");
    // "my password is expired / wrong / not working" is a description, not a value.
    const describing = new Set(["expired", "wrong", "incorrect", "invalid", "locked", "missing", "forgotten", "changed", "reset", "blank", "empty", "not", "working", "broken", "required", "needed", "unknown", "lost"]);
    // Real credentials almost always carry a digit or a symbol; plain words ("still", "wrong") are descriptions.
    if (!describing.has(value) && /[^a-z]/i.test(m[2].replace(/[.,!?;]+$/, ""))) return true;
  }
  // A pasted product / licence key: five groups of five.
  if (/\b[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}\b/.test(t)) return true;
  // Well-known API key shapes.
  if (/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/.test(t)) return true;
  if (/\bAKIA[0-9A-Z]{16}\b/.test(t)) return true;
  if (/\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(t)) return true;
  if (looksLikeCardData(t)) return true;
  return false;
}

export const SECRET_IN_CHAT_WARNING =
  "That looks like a password or key, so it wasn't sent. Use “Share a password securely” instead: it goes to your DE ticket encrypted and never appears in this chat.";

/** A message DE staff can send that asks for a secret without anyone typing it into the thread. */
export const DE_SECURE_REQUEST_TEMPLATE =
  "Could you share that through the secure field instead of the chat? Open your ticket in the Client Portal (or use “Share a password securely” here) and enter it there. It is stored encrypted with your ticket and never appears in this conversation.";

/** The website DE Desk (Ask DE) version: the visitor shares it on the ticket from Get Support. */
export const SECRET_IN_CHAT_WARNING_WEBSITE =
  "That looks like a password or key, so it wasn't sent. Open Get Support to log a ticket; you can then share it there securely, and it never appears in this chat.";

/** What a DE agent can send a website DE Desk visitor instead of asking them to type a secret into the chat. */
export const DE_SECURE_REQUEST_TEMPLATE_WEBSITE =
  "Please don't type that here. Open Get Support in this window and send the ticket; on the confirmation you can share the password securely. It's stored encrypted with your ticket and never appears in this chat.";

/** What DE staff see when their own reply looks like it carries a secret. */
export const SECRET_IN_AGENT_REPLY_WARNING =
  "That reply looks like it contains a password or key, so it wasn't sent. Store it as a secure field on the ticket instead; chat replies are kept in the transcript.";

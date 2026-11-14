import { createHmac, timingSafeEqual } from "crypto";
import { asc, eq } from "drizzle-orm";
import { db, dbReady } from "./db";
import { logger } from "./logger";
import { marketingEmailOptOuts } from "@shared/schema";
import { businessPostalAddress, isPostalAddressPlaceholder, type EmailEnv } from "@shared/marketingEmail";
import { escapeEmailHtml } from "./services/emailEscape";
import { baseEmailTemplate, sendEmail, type EmailOptions, type EmailPurpose } from "./services/notificationService";

/**
 * Marketing and other commercial email: the newsletter welcome and anything
 * else sent to a list rather than in answer to something the person did.
 * Receipts, password resets, tickets and account notices go through
 * sendEmail directly and are not affected by anything here.
 *
 * A marketing send goes out only when all of these hold:
 *   - MARKETING_EMAIL_ENABLED is "true" (off by default);
 *   - BUSINESS_POSTAL_ADDRESS is set to a real mailing address;
 *   - MARKETING_UNSUBSCRIBE_SECRET is set;
 *   - a sender that may carry this kind of mail is available;
 *   - the recipient is not on the opt-out list, and the list could be read.
 * Each refusal writes one log line saying why.
 *
 * Which sender: the welcome note sent once, in reply to a signup, goes
 * through ZeptoMail with the transactional mail. Newsletter issues,
 * campaigns and promotions never do (see EmailPurpose in
 * notificationService.ts); they go through a MarketingSender. Bulk mail is
 * meant to go through Zoho Campaigns, which is not wired in yet, so the
 * default sender is "not configured" and those sends are refused.
 *
 * The opt-out table is the source of truth. listOptOuts() and the admin
 * export in marketingUnsubscribeRoutes.ts hand it to the bulk sender's
 * suppression list.
 */

const DEFAULT_SITE_URL = "https://digeratiexperts.com";
const TOKEN_CONTEXT = "marketing-unsubscribe:";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function marketingEmailEnabled(env: EmailEnv): boolean {
  return (env.MARKETING_EMAIL_ENABLED ?? "").trim().toLowerCase() === "true";
}

/**
 * Unsubscribe links are signed with MARKETING_UNSUBSCRIBE_SECRET only. After
 * a rotation, MARKETING_UNSUBSCRIBE_SECRET_PREVIOUS still verifies links
 * already sent but never signs new ones. Keep it for at least 30 days.
 */
function signingSecret(env: EmailEnv): string | null {
  return env.MARKETING_UNSUBSCRIBE_SECRET?.trim() || null;
}

function verifyingSecrets(env: EmailEnv): string[] {
  const current = signingSecret(env);
  const previous = env.MARKETING_UNSUBSCRIBE_SECRET_PREVIOUS?.trim();
  return [current, previous].filter((secret): secret is string => Boolean(secret));
}

/** Why a marketing send would be refused right now, or null when it may go. */
export function marketingSendBlockReason(env: EmailEnv): string | null {
  if (!marketingEmailEnabled(env)) return "MARKETING_EMAIL_ENABLED is off";
  if (isPostalAddressPlaceholder(businessPostalAddress(env))) {
    return "BUSINESS_POSTAL_ADDRESS is not set; footers still carry the placeholder";
  }
  if (!signingSecret(env)) return "MARKETING_UNSUBSCRIBE_SECRET is not set";
  return null;
}

const b64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

function signature(email: string, secret: string): string {
  return createHmac("sha256", secret).update(TOKEN_CONTEXT + email).digest("base64url");
}

/** Token for an unsubscribe link: the address plus an HMAC over it. Does not expire. */
export function unsubscribeToken(email: string, secret: string): string {
  const address = normalizeEmail(email);
  return `${b64url(address)}.${signature(address, secret)}`;
}

/** The address a token was issued for, or null when it is malformed or forged. */
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const [encoded, sig, extra] = token.split(".");
  if (!encoded || !sig || extra !== undefined) return null;
  let address: string;
  try {
    address = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!address.includes("@") || address !== normalizeEmail(address)) return null;
  const expected = Buffer.from(signature(address, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return address;
}

/** Checks the current secret, then the previous one. */
export function verifyUnsubscribeTokenFromEnv(token: string, env: EmailEnv): string | null {
  for (const secret of verifyingSecrets(env)) {
    const address = verifyUnsubscribeToken(token, secret);
    if (address) return address;
  }
  return null;
}

export function unsubscribeUrl(email: string, env: EmailEnv): string {
  const secret = signingSecret(env);
  if (!secret) throw new Error("MARKETING_UNSUBSCRIBE_SECRET is not set");
  const base = (env.APP_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, "");
  return `${base}/api/email/unsubscribe?t=${encodeURIComponent(unsubscribeToken(email, secret))}`;
}

/** Footer for every marketing email: why they got it, the postal address, and the unsubscribe link. */
export function marketingFooterHtml(address: string, unsubscribeLink: string): string {
  return `
      <p style="color: #888; font-size: 12px; margin-top: 24px; line-height: 1.6;">
        You are receiving this because this address signed up for Digerati Experts updates at digeratiexperts.com.<br>
        Digerati Experts &middot; ${escapeEmailHtml(address)}<br>
        <a href="${escapeEmailHtml(unsubscribeLink)}" style="color: #a855f7;">Unsubscribe from Digerati Experts marketing email</a>
      </p>`;
}

export function marketingFooterText(address: string, unsubscribeLink: string): string {
  return [
    "You are receiving this because this address signed up for Digerati Experts updates at digeratiexperts.com.",
    `Digerati Experts - ${address}`,
    `Unsubscribe: ${unsubscribeLink}`,
  ].join("\n");
}

/* ------------------------------------------------------------ opt-out list */

export interface OptOutRecord {
  email: string;
  source: string;
  optedOutAt: string;
}

export interface OptOutStore {
  /** Throws when the list cannot be read; the caller must then not send. */
  has(email: string): Promise<boolean>;
  /** Throws when the opt-out could not be saved durably. */
  add(email: string, source: string): Promise<void>;
  /** Every opt-out, oldest first. Throws when the list cannot be read. */
  list(): Promise<OptOutRecord[]>;
}

const memOptOuts = new Set<string>();

export function _resetOptOutMemory(): void {
  memOptOuts.clear();
}

/**
 * Postgres (migrations/0027) with an in-process copy. Without a database the
 * list cannot be trusted, so has() throws and no marketing email goes out;
 * add() still keeps the address in memory and then reports the failure.
 */
export const dbOptOutStore: OptOutStore = {
  async has(email) {
    const address = normalizeEmail(email);
    if (memOptOuts.has(address)) return true;
    if (!dbReady || !db) throw new Error("opt-out list unavailable: no database");
    const rows = await db
      .select({ email: marketingEmailOptOuts.email })
      .from(marketingEmailOptOuts)
      .where(eq(marketingEmailOptOuts.email, address))
      .limit(1);
    return rows.length > 0;
  },
  async add(email, source) {
    const address = normalizeEmail(email);
    memOptOuts.add(address);
    if (!dbReady || !db) throw new Error("opt-out not saved: no database");
    await db.insert(marketingEmailOptOuts).values({ email: address, source }).onConflictDoNothing();
  },
  async list() {
    if (!dbReady || !db) throw new Error("opt-out list unavailable: no database");
    const rows: Array<{ email: string; source: string; optedOutAt: Date }> = await db
      .select()
      .from(marketingEmailOptOuts)
      .orderBy(asc(marketingEmailOptOuts.optedOutAt));
    return rows.map((row) => ({ email: row.email, source: row.source, optedOutAt: new Date(row.optedOutAt).toISOString() }));
  },
};

/** The opt-out list in the shape a bulk sender's suppression import takes. */
export async function exportSuppressions(store: OptOutStore = dbOptOutStore): Promise<{ count: number; records: OptOutRecord[] }> {
  const records = await store.list();
  return { count: records.length, records };
}

export function suppressionsCsv(records: OptOutRecord[]): string {
  const cell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = records.map((r) => [r.email, r.source, r.optedOutAt].map(cell).join(","));
  return ["email,source,opted_out_at", ...lines].join("\n") + "\n";
}

/* ---------------------------------------------------------------- senders */

/** Purposes that are marketing: everything but plain transactional mail. */
export type MarketingPurpose = Exclude<EmailPurpose, "transactional">;

export interface MarketingMessage {
  purpose: MarketingPurpose;
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  unsubscribeUrl: string;
}

/** Carries newsletter issues, campaigns and promotions. Never ZeptoMail. */
export interface MarketingSender {
  readonly name: string;
  /** Null when it can send; otherwise why not. */
  unavailableReason(): string | null;
  send(message: MarketingMessage): Promise<boolean>;
}

export const notConfiguredMarketingSender: MarketingSender = {
  name: "not configured",
  unavailableReason: () => "no bulk marketing sender is configured (bulk mail goes through Zoho Campaigns)",
  send: async () => false,
};

/* ------------------------------------------------------------------ sends */

export interface MarketingSendDeps {
  env?: EmailEnv;
  store?: OptOutStore;
  /** The transactional sender, used only for the signup welcome. */
  send?: (options: EmailOptions) => Promise<boolean>;
  /** Everything else. Defaults to "not configured". */
  marketingSender?: MarketingSender;
}

export interface MarketingEmail {
  purpose: MarketingPurpose;
  to: string;
  subject: string;
  title: string;
  /** Body HTML; the footer is appended here. */
  contentHtml: string;
  /** Plain-text body; the footer is appended here. */
  contentText: string;
}

export type MarketingSendResult = { sent: true } | { sent: false; reason: string };

export async function sendMarketingEmail(email: MarketingEmail, deps: MarketingSendDeps = {}): Promise<MarketingSendResult> {
  const env = deps.env ?? process.env;
  const store = deps.store ?? dbOptOutStore;
  const transactional = deps.send ?? sendEmail;
  const bulk = deps.marketingSender ?? notConfiguredMarketingSender;
  const refuse = (reason: string, level: "warn" | "info" = "warn"): MarketingSendResult => {
    logger[level](`[MARKETING_EMAIL] ${email.purpose} not sent: ${reason}`);
    return { sent: false, reason };
  };

  const blocked = marketingSendBlockReason(env);
  if (blocked) return refuse(blocked);

  const viaTransactional = email.purpose === "signup-welcome";
  if (!viaTransactional) {
    const unavailable = bulk.unavailableReason();
    if (unavailable) return refuse(unavailable);
  }

  const to = normalizeEmail(email.to);
  try {
    if (await store.has(to)) return refuse("recipient opted out", "info");
  } catch (error: any) {
    return refuse(`opt-out list could not be checked (${error?.message || error})`);
  }

  const address = businessPostalAddress(env);
  const link = unsubscribeUrl(to, env);
  const htmlBody = baseEmailTemplate(email.contentHtml + marketingFooterHtml(address, link), email.title);
  const textBody = `${email.contentText.trim()}\n\n${marketingFooterText(address, link)}\n`;
  const ok = viaTransactional
    ? await transactional({ to, subject: email.subject, htmlBody, textBody, purpose: "signup-welcome", listUnsubscribe: { url: link } })
    : await bulk.send({ purpose: email.purpose, to, subject: email.subject, htmlBody, textBody, unsubscribeUrl: link });
  return ok ? { sent: true } : { sent: false, reason: "delivery failed" };
}

/**
 * The one welcome note sent in reply to a newsletter signup. It goes through
 * the transactional sender but is still a marketing email: paused like the rest.
 */
export function sendNewsletterWelcome(to: string, deps: MarketingSendDeps = {}): Promise<MarketingSendResult> {
  return sendMarketingEmail(
    {
      purpose: "signup-welcome",
      to,
      subject: "Welcome — Digerati Experts insights",
      title: "Newsletter Welcome",
      contentHtml: `
      <h2>You're on the list</h2>
      <p>Thanks for subscribing to Digerati Experts updates — practical IT and cybersecurity notes for Arizona businesses.</p>
      <p>We'll only send useful content. Prefer a free risk assessment instead?</p>
      <a href="https://digeratiexperts.com/book" class="button">Schedule My Assessment</a>`,
      contentText: [
        "You're on the list",
        "",
        "Thanks for subscribing to Digerati Experts updates — practical IT and cybersecurity notes for Arizona businesses.",
        "We'll only send useful content. Prefer a free risk assessment instead?",
        "Schedule your assessment: https://digeratiexperts.com/book",
      ].join("\n"),
    },
    deps,
  );
}

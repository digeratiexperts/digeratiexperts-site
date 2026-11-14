import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db, dbReady } from "./db";
import { logger } from "./logger";
import { marketingEmailOptOuts } from "@shared/schema";
import { businessPostalAddress, isPostalAddressPlaceholder, type EmailEnv } from "@shared/marketingEmail";
import { escapeEmailHtml } from "./services/emailEscape";
import { baseEmailTemplate, sendEmail, type EmailOptions } from "./services/notificationService";

/**
 * Marketing and other commercial email: the newsletter welcome and anything
 * else sent to a list rather than in answer to something the person did.
 * Receipts, password resets, tickets and account notices go through
 * sendEmail directly and are not affected by anything here.
 *
 * A marketing send goes out only when all of these hold:
 *   - MARKETING_EMAIL_ENABLED is "true" (off by default);
 *   - BUSINESS_POSTAL_ADDRESS is set to a real mailing address;
 *   - an unsubscribe signing secret is configured;
 *   - the recipient is not on the opt-out list, and the list could be read.
 * Each refusal writes one log line saying why.
 */

const DEFAULT_SITE_URL = "https://digeratiexperts.com";
const TOKEN_CONTEXT = "marketing-unsubscribe:";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function marketingEmailEnabled(env: EmailEnv): boolean {
  return (env.MARKETING_EMAIL_ENABLED ?? "").trim().toLowerCase() === "true";
}

function unsubscribeSecret(env: EmailEnv): string | null {
  const secret = env.MARKETING_UNSUBSCRIBE_SECRET?.trim() || env.SESSION_SECRET?.trim();
  return secret ? secret : null;
}

/** Why a marketing send would be refused right now, or null when it may go. */
export function marketingSendBlockReason(env: EmailEnv): string | null {
  if (!marketingEmailEnabled(env)) return "MARKETING_EMAIL_ENABLED is off";
  if (isPostalAddressPlaceholder(businessPostalAddress(env))) {
    return "BUSINESS_POSTAL_ADDRESS is not set; footers still carry the placeholder";
  }
  if (!unsubscribeSecret(env)) return "no unsubscribe signing secret (MARKETING_UNSUBSCRIBE_SECRET or SESSION_SECRET)";
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

export function verifyUnsubscribeTokenFromEnv(token: string, env: EmailEnv): string | null {
  const secret = unsubscribeSecret(env);
  return secret ? verifyUnsubscribeToken(token, secret) : null;
}

export function unsubscribeUrl(email: string, env: EmailEnv): string {
  const secret = unsubscribeSecret(env);
  if (!secret) throw new Error("no unsubscribe signing secret");
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

export interface OptOutStore {
  /** Throws when the list cannot be read; the caller must then not send. */
  has(email: string): Promise<boolean>;
  /** Throws when the opt-out could not be saved durably. */
  add(email: string, source: string): Promise<void>;
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
};

/* ------------------------------------------------------------------ sends */

export interface MarketingSendDeps {
  env?: EmailEnv;
  store?: OptOutStore;
  send?: (options: EmailOptions) => Promise<boolean>;
}

export interface MarketingEmail {
  /** Short name for logs, e.g. "newsletter-welcome". */
  kind: string;
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
  const send = deps.send ?? sendEmail;

  const blocked = marketingSendBlockReason(env);
  if (blocked) {
    logger.warn(`[MARKETING_EMAIL] ${email.kind} not sent: ${blocked}`);
    return { sent: false, reason: blocked };
  }

  const to = normalizeEmail(email.to);
  try {
    if (await store.has(to)) {
      logger.info(`[MARKETING_EMAIL] ${email.kind} not sent: recipient opted out`);
      return { sent: false, reason: "recipient opted out" };
    }
  } catch (error: any) {
    const reason = `opt-out list could not be checked (${error?.message || error})`;
    logger.warn(`[MARKETING_EMAIL] ${email.kind} not sent: ${reason}`);
    return { sent: false, reason };
  }

  const address = businessPostalAddress(env);
  const link = unsubscribeUrl(to, env);
  const ok = await send({
    to,
    subject: email.subject,
    htmlBody: baseEmailTemplate(email.contentHtml + marketingFooterHtml(address, link), email.title),
    textBody: `${email.contentText.trim()}\n\n${marketingFooterText(address, link)}\n`,
    listUnsubscribe: { url: link },
  });
  return ok ? { sent: true } : { sent: false, reason: "delivery failed" };
}

/** Welcome note after a newsletter signup. A marketing email: paused like the rest. */
export function sendNewsletterWelcome(to: string, deps: MarketingSendDeps = {}): Promise<MarketingSendResult> {
  return sendMarketingEmail(
    {
      kind: "newsletter-welcome",
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

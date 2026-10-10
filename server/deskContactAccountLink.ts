import type { ZohoDeskAccount, ZohoDeskContact } from "./zoho/zohoDesk";
import { normalizeCompanyName, pickDeskAccount } from "./portalDeskTickets";

/**
 * Plan for filing named Desk contacts under one Desk account, so the portal's
 * ticket view for that company (portalDeskTickets.ts, scoped by accountId)
 * sees their tickets. Pure: the caller does every Desk read and write.
 *
 * Fail-safe rules:
 * - no account, or more than one account with the same normalized name: no step writes;
 * - an email with no Desk contact, or more than one: that contact is skipped;
 * - a contact already under another account is reported, never moved.
 */

export type AccountResolution =
  | { state: "found"; id: string; name: string }
  | { state: "missing"; wanted: string }
  | { state: "ambiguous"; wanted: string; names: string[] };

export type LinkAction = "link" | "already-linked" | "linked-elsewhere" | "no-contact" | "several-contacts";

export interface LinkStep {
  email: string;
  action: LinkAction;
  contactId?: string;
  contactName?: string;
  /** The account the contact sits under today, when it has one. */
  currentAccountId?: string;
  currentAccountName?: string;
}

export interface LinkPlan {
  account: AccountResolution;
  steps: LinkStep[];
  /** Steps that would change Desk. Zero whenever the account is not found. */
  writes: LinkStep[];
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Comma- or whitespace-separated emails, de-duplicated, invalid ones reported. */
export function parseEmailList(raw: string): { emails: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const part of raw.split(/[\s,;]+/).map(normalizeEmail).filter(Boolean)) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(part)) invalid.push(part);
    else if (!seen.has(part)) {
      seen.add(part);
      emails.push(part);
    }
  }
  return { emails, invalid };
}

export function resolveAccount(accountName: string, accounts: ZohoDeskAccount[]): AccountResolution {
  const picked = pickDeskAccount(accountName, accounts);
  if (picked) return { state: "found", id: picked.id, name: picked.accountName };
  const want = normalizeCompanyName(accountName);
  const same = accounts.filter((a) => normalizeCompanyName(a.accountName) === want);
  return same.length > 1
    ? { state: "ambiguous", wanted: accountName, names: same.map((a) => `${a.accountName} (${a.id})`) }
    : { state: "missing", wanted: accountName };
}

function contactName(c: ZohoDeskContact): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
}

export function planContactAccountLinks(input: {
  accountName: string;
  accounts: ZohoDeskAccount[];
  emails: string[];
  /** Desk contacts found for each email (as normalizeEmail returns it). */
  contactsByEmail: Record<string, ZohoDeskContact[]>;
}): LinkPlan {
  const account = resolveAccount(input.accountName, input.accounts);
  const names = new Map(input.accounts.map((a) => [a.id, a.accountName]));

  const steps = input.emails.map((raw): LinkStep => {
    const email = normalizeEmail(raw);
    const found = (input.contactsByEmail[email] ?? []).filter((c) => normalizeEmail(c.email ?? "") === email);
    const unique = Array.from(new Map(found.map((c) => [c.id, c])).values());
    if (unique.length === 0) return { email, action: "no-contact" };
    if (unique.length > 1) return { email, action: "several-contacts" };
    const c = unique[0];
    const base = {
      email,
      contactId: c.id,
      contactName: contactName(c) || undefined,
      currentAccountId: c.accountId || undefined,
      currentAccountName: c.accountId ? c.accountName || names.get(c.accountId) : undefined,
    };
    if (account.state === "found" && c.accountId === account.id) return { ...base, action: "already-linked" };
    if (c.accountId) return { ...base, action: "linked-elsewhere" };
    return { ...base, action: "link" };
  });

  return { account, steps, writes: account.state === "found" ? steps.filter((s) => s.action === "link") : [] };
}

const ACTION_TEXT: Record<LinkAction, string> = {
  link: "WILL LINK",
  "already-linked": "no change (already under the account)",
  "linked-elsewhere": "SKIP (under another account; not moved)",
  "no-contact": "SKIP (no Desk contact with this email)",
  "several-contacts": "SKIP (more than one Desk contact with this email)",
};

/** Human-readable plan. Contains contact names and emails, never credentials. */
export function formatLinkPlan(plan: LinkPlan, opts: { apply: boolean }): string {
  const lines: string[] = [];
  const a = plan.account;
  if (a.state === "found") lines.push(`Desk account: ${a.name} (${a.id})`);
  else if (a.state === "missing") lines.push(`Desk account "${a.wanted}": NOT FOUND. Nothing will be changed until DE creates it.`);
  else lines.push(`Desk account "${a.wanted}": AMBIGUOUS (${a.names.join("; ")}). Nothing will be changed; merge or rename first.`);
  for (const s of plan.steps) {
    const who = s.contactName ? `${s.contactName} <${s.email}>` : s.email;
    const id = s.contactId ? ` contact ${s.contactId}` : "";
    const now = s.currentAccountId ? `, now under ${s.currentAccountName ?? "account"} (${s.currentAccountId})` : "";
    const action = a.state === "found" || s.action !== "link" ? ACTION_TEXT[s.action] : "would link once the account exists";
    lines.push(`- ${who}${id}${now}: ${action}`);
  }
  lines.push(
    plan.writes.length === 0
      ? "Planned Desk changes: none."
      : `Planned Desk changes: ${plan.writes.length} (set accountId on ${plan.writes.length} contact${plan.writes.length === 1 ? "" : "s"}).${opts.apply ? "" : " Dry run: pass --apply to make them."}`,
  );
  return lines.join("\n");
}

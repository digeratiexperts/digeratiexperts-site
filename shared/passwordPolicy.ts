/**
 * Client Portal password policy, shared by the forms (live checklist) and the
 * server (enforcement on register, reset and change). One list, so the page
 * can never promise a rule the server does not check, or the reverse.
 *
 * Joe, 2026-10-15: the rules a carrier sign-up page shows, plus a breached-
 * password check, with the minimum a little lower (10). The maximum is 64 so
 * passphrases fit (NIST SP 800-63B asks for at least 64); spaces and symbols
 * are allowed. The breach check needs the network and runs on the server only
 * (server/passwordBreach.ts); the checklist lists it as "checked when you submit".
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 64;

/** Who the password belongs to; it may not contain any of these. */
export interface PasswordContext {
  email?: string | null;
  username?: string | null;
  fullName?: string | null;
  companyName?: string | null;
}

export type PasswordRuleId =
  | "minLength"
  | "maxLength"
  | "number"
  | "uppercase"
  | "lowercase"
  | "noRepeat"
  | "noSequence"
  | "noPersonal";

export interface PasswordRuleResult {
  id: PasswordRuleId;
  label: string;
  ok: boolean;
}

export const PASSWORD_RULE_LABELS: Record<PasswordRuleId, string> = {
  minLength: `Be at least ${PASSWORD_MIN_LENGTH} characters`,
  maxLength: `Be at most ${PASSWORD_MAX_LENGTH} characters`,
  number: "Include at least one number",
  uppercase: "Include at least one uppercase letter",
  lowercase: "Include at least one lowercase letter",
  noRepeat: "Not repeat the same character 3 or more times in a row (aaa)",
  noSequence: "Not contain 3 or more letters or numbers in sequence (abc, 321)",
  noPersonal: "Not contain your email, username, name or company name",
};

export const PASSWORD_BREACH_LABEL = "Not appear in a known data breach (checked when you submit)";

/** Three or more of the same character in a row, e.g. "aaa" or "111". */
export function hasRepeatedRun(password: string): boolean {
  return /(.)\1\1/u.test(password);
}

function seqClass(ch: string): "digit" | "alpha" | null {
  if (/[0-9]/.test(ch)) return "digit";
  if (/[a-z]/i.test(ch)) return "alpha";
  return null;
}

/** Three or more ascending or descending letters or digits, e.g. "abc", "CBA", "123", "987". */
export function hasSequentialRun(password: string): boolean {
  const chars = Array.from(password.toLowerCase());
  for (let i = 0; i + 2 < chars.length; i++) {
    const [a, b, c] = [chars[i], chars[i + 1], chars[i + 2]];
    const cls = seqClass(a);
    if (!cls || seqClass(b) !== cls || seqClass(c) !== cls) continue;
    const d1 = b.charCodeAt(0) - a.charCodeAt(0);
    const d2 = c.charCodeAt(0) - b.charCodeAt(0);
    if ((d1 === 1 && d2 === 1) || (d1 === -1 && d2 === -1)) return true;
  }
  return false;
}

/**
 * Personal tokens a password may not contain: the email's local part and
 * domain label, the username, and each word of the name and company name.
 * Tokens shorter than 3 characters are skipped (too many false hits).
 */
export function personalTokens(ctx: PasswordContext = {}): string[] {
  const out = new Set<string>();
  const add = (v?: string | null) => {
    const t = (v || "").trim().toLowerCase();
    if (t.length >= 3) out.add(t);
  };
  const email = (ctx.email || "").trim().toLowerCase();
  if (email) {
    const [local, domain = ""] = email.split("@");
    add(local);
    local.split(/[^a-z0-9]+/).forEach(add);
    add(domain.split(".")[0]);
    domain.split(".")[0].split(/[^a-z0-9]+/).forEach(add);
  }
  add(ctx.username);
  for (const v of [ctx.fullName, ctx.companyName]) {
    (v || "").split(/[^\p{L}\p{N}]+/u).forEach(add);
  }
  // The joined company name too ("digerati experts" -> "digeratiexperts").
  if (ctx.companyName) add(ctx.companyName.replace(/[^\p{L}\p{N}]+/gu, ""));
  return Array.from(out);
}

export function containsPersonalInfo(password: string, ctx: PasswordContext = {}): boolean {
  const pw = password.toLowerCase();
  return personalTokens(ctx).some((t) => pw.includes(t));
}

export function evaluatePassword(password: string, ctx: PasswordContext = {}): PasswordRuleResult[] {
  const pw = password || "";
  const checks: Record<PasswordRuleId, boolean> = {
    minLength: Array.from(pw).length >= PASSWORD_MIN_LENGTH,
    maxLength: Array.from(pw).length <= PASSWORD_MAX_LENGTH,
    number: /[0-9]/.test(pw),
    uppercase: /\p{Lu}/u.test(pw),
    lowercase: /\p{Ll}/u.test(pw),
    noRepeat: !hasRepeatedRun(pw),
    noSequence: !hasSequentialRun(pw),
    noPersonal: !containsPersonalInfo(pw, ctx),
  };
  return (Object.keys(checks) as PasswordRuleId[]).map((id) => ({ id, label: PASSWORD_RULE_LABELS[id], ok: checks[id] }));
}

/** null when the password passes every local rule, else a sentence naming the first rule it breaks. */
export function passwordPolicyError(password: string, ctx: PasswordContext = {}): string | null {
  const failed = evaluatePassword(password, ctx).find((r) => !r.ok);
  if (!failed) return null;
  return `Password must ${failed.label.charAt(0).toLowerCase()}${failed.label.slice(1)}.`;
}

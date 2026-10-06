import { z } from "zod";

/**
 * Company structure, people directory and request routing.
 *
 * Structure: a company is organised by site (the LIDs on its requests) or by
 * department (the existing portal departments). Each site or department has
 * one leader and an optional backup. The leader is who DE copies, and who DE
 * goes to on a team member's behalf when the person can't be reached; for
 * requests that need approval, the leader approves.
 *
 * Support tier: VIPs get direct support only (no leader fallback, no copy).
 * Standard users are contacted directly first; if they are unavailable (or
 * marked away), DE goes to their leader.
 *
 * IDs: every person gets a permanent DE person ID (PREFIX-00042). A company
 * can also import its own employee IDs; the company's ID scheme decides which
 * one the portal and the Hub show.
 */

// ---------- company profile ----------

export const ORG_STRUCTURES = [
  { key: "site", label: "By site", hint: "Each office or location has a site leader." },
  { key: "department", label: "By department", hint: "Each department has a department leader." },
] as const;
export type OrgStructure = (typeof ORG_STRUCTURES)[number]["key"];

export const ID_SCHEMES = [
  { key: "de", label: "DE person IDs", hint: "DE assigns every person an ID such as ACME-00042." },
  { key: "company", label: "Company employee IDs", hint: "Show the IDs your company already uses, imported or entered here." },
] as const;
export type IdScheme = (typeof ID_SCHEMES)[number]["key"];

/** Request types whose approval follows the company's choice (licences follow the licence policy). */
export const APPROVABLE_REQUEST_TYPES = ["loaner_computer", "return_computer"] as const;

export const orgProfileSchema = z.object({
  structure: z.enum(["site", "department"]).default("site"),
  idScheme: z.enum(["de", "company"]).default("de"),
  /** 2-6 capitals; prefixes new DE person IDs. Existing IDs never change. */
  idPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,6}$/, "Use 2 to 6 letters"),
  companyIdLabel: z.string().trim().max(40).default("Employee ID"),
  /** Optional naming rule for company IDs, as a pattern such as E##### (see companyIdPatternToRegex). */
  companyIdPattern: z.string().trim().max(40).default(""),
  vipSkipsApproval: z.boolean().default(true),
  approvalRequiredFor: z.array(z.enum(APPROVABLE_REQUEST_TYPES)).default([]),
});
export type OrgProfile = z.infer<typeof orgProfileSchema>;

export function deriveIdPrefix(companyName: string): string {
  const words = companyName
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["INC", "LLC", "LTD", "CORP", "CO", "THE", "GROUP", "COMPANY"].includes(w));
  let p = words.length >= 2 ? words.map((w) => w[0]).join("").slice(0, 4) : (words[0] ?? "").slice(0, 4);
  if (p.length < 2) p = (p + "DE").slice(0, 2);
  return p;
}

export function defaultOrgProfile(companyName: string): OrgProfile {
  return {
    structure: "site",
    idScheme: "de",
    idPrefix: deriveIdPrefix(companyName),
    companyIdLabel: "Employee ID",
    companyIdPattern: "",
    vipSkipsApproval: true,
    approvalRequiredFor: [],
  };
}

/**
 * Company naming rule → anchored regex. `#` is a digit, `A` a capital letter,
 * `*` any letter or digit; everything else is literal. "E#####" matches E00123.
 * A plain pattern keeps import validation readable and avoids user regexes.
 */
export function companyIdPatternToRegex(pattern: string): RegExp | null {
  const p = pattern.trim();
  if (!p) return null;
  const body = [...p]
    .map((ch) => (ch === "#" ? "\\d" : ch === "A" ? "[A-Z]" : ch === "*" ? "[A-Za-z0-9]" : ch.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&")))
    .join("");
  return new RegExp(`^${body}$`);
}

export function checkCompanyPersonId(profile: Pick<OrgProfile, "companyIdPattern" | "companyIdLabel">, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.length > 40) return `${profile.companyIdLabel} is too long`;
  if (!/^[A-Za-z0-9._\-]+$/.test(v)) return `${profile.companyIdLabel} may use letters, digits, dot, dash and underscore only`;
  const re = companyIdPatternToRegex(profile.companyIdPattern);
  if (re && !re.test(v)) return `${profile.companyIdLabel} must look like ${profile.companyIdPattern}`;
  return null;
}

export function formatDePersonId(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(5, "0")}`;
}

// ---------- leaders ----------

export type UnitKind = "site" | "department";

export const unitLeaderSchema = z.object({
  unitKind: z.enum(["site", "department"]),
  unitId: z.string().trim().min(1).max(80),
  leaderUserId: z.string().trim().max(80).nullable().default(null),
  backupUserId: z.string().trim().max(80).nullable().default(null),
  /** Copy the leader on requests for people in this unit. */
  ccLeader: z.boolean().default(true),
});
export type UnitLeader = z.infer<typeof unitLeaderSchema>;

// ---------- people ----------

export const SUPPORT_TIERS = [
  { key: "standard", label: "Standard", hint: "Contacted directly; their leader if they are unavailable." },
  { key: "vip", label: "VIP", hint: "Direct support only. Their leader is not copied or contacted on their behalf." },
] as const;
export type SupportTier = (typeof SUPPORT_TIERS)[number]["key"];

export type PersonProfile = {
  userId: string;
  clientId: string;
  dePersonId: string;
  companyPersonId: string | null;
  siteId: string | null;
  supportTier: SupportTier;
  /** YYYY-MM-DD, inclusive. */
  awayUntil: string | null;
};

export function displayPersonId(profile: Pick<OrgProfile, "idScheme">, person: Pick<PersonProfile, "dePersonId" | "companyPersonId">): string {
  return profile.idScheme === "company" && person.companyPersonId ? person.companyPersonId : person.dePersonId;
}

export function isAway(person: Pick<PersonProfile, "awayUntil"> | null | undefined, today: string): boolean {
  return Boolean(person?.awayUntil && person.awayUntil >= today);
}

// ---------- routing ----------

export type RoutingPerson = { userId: string; name: string; email: string };
export type RoutingUnit = { kind: UnitKind; id: string; name: string };

/** The unit a request belongs to: the person's own site or department, else the request's site (site structure). */
export function resolveUnit(input: {
  profile: Pick<OrgProfile, "structure">;
  person: Pick<PersonProfile, "siteId"> | null;
  departmentId: string | null;
  requestSiteId: string | null;
}): { kind: UnitKind; id: string } | null {
  if (input.profile.structure === "department") return input.departmentId ? { kind: "department", id: input.departmentId } : null;
  const siteId = input.person?.siteId || input.requestSiteId;
  return siteId ? { kind: "site", id: siteId } : null;
}

export type ContactPlan = {
  supportTier: SupportTier;
  personId: string;
  primary: RoutingPerson & { phone: string | null; awayUntil: string | null };
  unit: RoutingUnit | null;
  /** Who DE goes to when the person can't be reached. Null for VIPs. */
  fallback: (RoutingPerson & { role: "leader" | "backup_leader" }) | null;
  /** Who DE copies. Empty for VIPs. */
  cc: RoutingPerson[];
  /** One line for the Desk ticket and the Hub. */
  summary: string;
};

export function resolveContactPlan(input: {
  personId: string;
  tier: SupportTier;
  primary: RoutingPerson;
  phone: string | null;
  awayUntil: string | null;
  today: string;
  unit: RoutingUnit | null;
  leader: (RoutingPerson & { awayUntil: string | null }) | null;
  backup: (RoutingPerson & { awayUntil: string | null }) | null;
  ccLeader: boolean;
}): ContactPlan {
  const away = Boolean(input.awayUntil && input.awayUntil >= input.today);
  const base = {
    supportTier: input.tier,
    personId: input.personId,
    primary: { ...input.primary, phone: input.phone, awayUntil: input.awayUntil },
    unit: input.unit,
  };
  if (input.tier === "vip") {
    return { ...base, fallback: null, cc: [], summary: `VIP: contact ${input.primary.name} directly. Do not route through their leader.` };
  }
  // The leader stands in, unless the leader is the person or is away; then the backup.
  const usable = (p: (RoutingPerson & { awayUntil: string | null }) | null) =>
    p && p.userId !== input.primary.userId && !(p.awayUntil && p.awayUntil >= input.today) ? p : null;
  const leader = usable(input.leader);
  const backup = usable(input.backup);
  const fb = leader ? { ...strip(leader), role: "leader" as const } : backup ? { ...strip(backup), role: "backup_leader" as const } : null;
  const cc = input.ccLeader && fb ? [strip(fb)] : [];
  const unitName = input.unit ? `${input.unit.kind === "site" ? "site" : "department"} leader${input.unit.name ? ` (${input.unit.name})` : ""}` : "leader";
  const summary = fb
    ? away
      ? `${input.primary.name} is away until ${input.awayUntil}: go to ${fb.name}, ${fb.role === "leader" ? unitName : `backup ${unitName}`}.`
      : `Contact ${input.primary.name} directly; if unavailable, go to ${fb.name}, ${fb.role === "leader" ? unitName : `backup ${unitName}`}.`
    : `Contact ${input.primary.name} directly. No leader is set up for them.`;
  return { ...base, fallback: fb, cc, summary };
}

function strip<T extends RoutingPerson>(p: T): RoutingPerson {
  return { userId: p.userId, name: p.name, email: p.email };
}

export type ApprovalRule = "leader" | "it_contact";
export type ApproverRole = "leader" | "backup_leader" | "manager" | "it_contact";
export type Approver = RoutingPerson & { role: ApproverRole };

export type ApprovalFlow =
  | { required: false; reason: string }
  | {
      required: true;
      rule: ApprovalRule;
      state: "pending" | "approved" | "rejected";
      approvers: Approver[];
      decidedBy?: RoutingPerson & { role: ApproverRole | "de_admin" | "requester" };
      decidedAt?: string;
      note?: string | null;
    };

/**
 * Who may approve, in order. Leader rule: the unit leader, then the backup,
 * then the person's manager, then the company IT contact. IT contact rule:
 * the company IT contact. Anyone away, or the person the request is for, is
 * skipped. Any listed approver may decide.
 */
export function resolveApprovers(input: {
  rule: ApprovalRule;
  requestedForUserId: string;
  today: string;
  leader: (RoutingPerson & { awayUntil: string | null }) | null;
  backup: (RoutingPerson & { awayUntil: string | null }) | null;
  manager: (RoutingPerson & { awayUntil: string | null }) | null;
  itContacts: Array<RoutingPerson & { awayUntil: string | null }>;
}): Approver[] {
  const out: Approver[] = [];
  const add = (p: (RoutingPerson & { awayUntil: string | null }) | null, role: ApproverRole) => {
    if (!p || p.userId === input.requestedForUserId) return;
    if (p.awayUntil && p.awayUntil >= input.today) return;
    if (out.some((x) => x.userId === p.userId)) return;
    out.push({ userId: p.userId, name: p.name, email: p.email, role });
  };
  if (input.rule === "leader") {
    add(input.leader, "leader");
    add(input.backup, "backup_leader");
    add(input.manager, "manager");
  }
  for (const it of input.itContacts) add(it, "it_contact");
  return out;
}

export const APPROVER_ROLE_LABELS: Record<ApproverRole | "de_admin" | "requester", string> = {
  leader: "Leader",
  backup_leader: "Backup leader",
  manager: "Manager",
  it_contact: "IT contact",
  de_admin: "Digerati Experts",
  requester: "Approver (submitted it)",
};

// ---------- import ----------

/** RFC 4180-ish CSV: quoted fields, doubled quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
  email: ["email", "e-mail", "mail", "upn", "userprincipalname", "email address"],
  companyPersonId: ["employee id", "employeeid", "employee_id", "employee number", "employeenumber", "id", "user id", "userid", "staff id", "person id"],
  unit: ["site", "location", "lid", "office", "department", "dept"],
  supportTier: ["vip", "tier", "support tier"],
  awayUntil: ["away until", "away_until", "out of office until"],
};

export type ImportRowPlan = {
  line: number;
  email: string;
  userId: string | null;
  name: string | null;
  companyPersonId: string | null;
  unitId: string | null;
  supportTier: SupportTier | null;
  awayUntil: string | null;
  errors: string[];
};

/**
 * Match CSV rows to the company's portal users by email and check them:
 * company IDs follow the naming rule and are unique (in the file and against
 * other people already holding them), units exist. Nothing is written here.
 */
export function planImport(input: {
  rows: string[][];
  profile: OrgProfile;
  users: Array<{ id: string; email: string; fullName: string }>;
  existingIds: Map<string, string>; // companyPersonId (lower) -> userId
  units: Array<{ id: string; name: string; code?: string }>;
}): { columns: Record<string, number>; rows: ImportRowPlan[]; errors: string[] } {
  const [header, ...body] = input.rows;
  if (!header) return { columns: {}, rows: [], errors: ["The file is empty"] };
  const columns: Record<string, number> = {};
  header.forEach((h, i) => {
    const k = h.trim().toLowerCase();
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) if (columns[key] === undefined && aliases.includes(k)) columns[key] = i;
  });
  if (columns.email === undefined) return { columns, rows: [], errors: ["Add an Email column so rows can be matched to people"] };
  if (body.length > 5000) return { columns, rows: [], errors: ["Import up to 5,000 people at a time"] };

  const byEmail = new Map(input.users.map((u) => [u.email.trim().toLowerCase(), u]));
  const unitByKey = new Map<string, string>();
  for (const u of input.units) {
    unitByKey.set(u.name.trim().toLowerCase(), u.id);
    if (u.code) unitByKey.set(u.code.trim().toLowerCase(), u.id);
  }
  const seenIds = new Map<string, number>();
  const seenEmails = new Set<string>();
  const cell = (r: string[], key: string) => (columns[key] === undefined ? "" : (r[columns[key]] ?? "").trim());

  const rows = body.map((r, idx): ImportRowPlan => {
    const line = idx + 2;
    const email = cell(r, "email").toLowerCase();
    const errors: string[] = [];
    const user = email ? byEmail.get(email) : undefined;
    if (!email) errors.push("Email is empty");
    else if (!user) errors.push("No portal user in this company has this email");
    if (email && seenEmails.has(email)) errors.push("This email appears more than once");
    seenEmails.add(email);

    const cid = cell(r, "companyPersonId") || null;
    if (cid) {
      const bad = checkCompanyPersonId(input.profile, cid);
      if (bad) errors.push(bad);
      const key = cid.toLowerCase();
      if (seenIds.has(key)) errors.push(`${input.profile.companyIdLabel} ${cid} is also on line ${seenIds.get(key)}`);
      else seenIds.set(key, line);
      const holder = input.existingIds.get(key);
      if (holder && user && holder !== user.id) errors.push(`${input.profile.companyIdLabel} ${cid} already belongs to someone else`);
    }

    let unitId: string | null = null;
    const unit = cell(r, "unit");
    if (unit) {
      unitId = unitByKey.get(unit.toLowerCase()) ?? null;
      if (!unitId) errors.push(`${input.profile.structure === "site" ? "Site" : "Department"} "${unit}" was not found`);
    }

    let supportTier: SupportTier | null = null;
    const tier = cell(r, "supportTier").toLowerCase();
    if (tier) {
      if (["vip", "yes", "y", "true", "1"].includes(tier)) supportTier = "vip";
      else if (["standard", "no", "n", "false", "0", "end user"].includes(tier)) supportTier = "standard";
      else errors.push(`VIP should be yes or no, not "${tier}"`);
    }

    let awayUntil: string | null = null;
    const away = cell(r, "awayUntil");
    if (away) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(away)) awayUntil = away;
      else errors.push("Away until must be YYYY-MM-DD");
    }

    return { line, email, userId: user?.id ?? null, name: user?.fullName ?? null, companyPersonId: cid, unitId, supportTier, awayUntil, errors };
  });
  return { columns, rows, errors: [] };
}

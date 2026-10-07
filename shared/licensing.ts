import { z } from "zod";

/**
 * Client licensing: which account type gets which licence, on which platform,
 * how it is assigned, and which directory group grants it.
 *
 * The catalog lists product names only. Prices live in the Hub catalog and the
 * Store; nothing here is a price, a quote or a SKU for billing.
 *
 * Each client company has one policy (entered by DE staff): the platforms it
 * runs, its own tier labels (e.g. "Band 2 and below"), base-licence rules per
 * account type and tier, and add-ons people can request. Company IT contacts
 * assign each person an account type and tier; the policy then answers "what
 * licence does this account get, and do they need to ask for it".
 */

export const LICENSE_PLATFORMS = [
  { key: "microsoft_commercial", label: "Microsoft 365 (Commercial)", directory: "Microsoft Entra ID" },
  { key: "microsoft_gcc", label: "Microsoft 365 GCC", directory: "Microsoft Entra ID (GCC)" },
  { key: "microsoft_gcc_high", label: "Microsoft 365 GCC High", directory: "Microsoft Entra ID (Azure Government)" },
  { key: "google_workspace", label: "Google Workspace", directory: "Google Workspace Admin" },
  { key: "zoho_workplace", label: "Zoho Workplace", directory: "Zoho Directory" },
] as const;
export type LicensePlatform = (typeof LICENSE_PLATFORMS)[number]["key"];
const PLATFORM_KEYS = LICENSE_PLATFORMS.map((p) => p.key) as [LicensePlatform, ...LicensePlatform[]];

export type CatalogLicense = { key: string; platform: LicensePlatform; name: string; kind: "base" | "addon"; note?: string };

export const LICENSE_CATALOG: readonly CatalogLicense[] = [
  // Microsoft 365 Commercial
  { key: "ms_m365_e5", platform: "microsoft_commercial", name: "Microsoft 365 E5", kind: "base" },
  { key: "ms_m365_e3", platform: "microsoft_commercial", name: "Microsoft 365 E3", kind: "base" },
  { key: "ms_o365_e1", platform: "microsoft_commercial", name: "Office 365 E1", kind: "base" },
  { key: "ms_m365_f3", platform: "microsoft_commercial", name: "Microsoft 365 F3", kind: "base", note: "Frontline" },
  { key: "ms_m365_f1", platform: "microsoft_commercial", name: "Microsoft 365 F1", kind: "base", note: "Frontline" },
  { key: "ms_m365_bp", platform: "microsoft_commercial", name: "Microsoft 365 Business Premium", kind: "base" },
  { key: "ms_m365_bs", platform: "microsoft_commercial", name: "Microsoft 365 Business Standard", kind: "base" },
  { key: "ms_m365_bb", platform: "microsoft_commercial", name: "Microsoft 365 Business Basic", kind: "base" },
  { key: "ms_visio_p2", platform: "microsoft_commercial", name: "Visio Plan 2", kind: "addon" },
  { key: "ms_project_p3", platform: "microsoft_commercial", name: "Project Plan 3", kind: "addon" },
  { key: "ms_powerbi_pro", platform: "microsoft_commercial", name: "Power BI Pro", kind: "addon" },
  { key: "ms_teams_phone", platform: "microsoft_commercial", name: "Teams Phone Standard", kind: "addon" },
  { key: "ms_copilot", platform: "microsoft_commercial", name: "Microsoft 365 Copilot", kind: "addon" },
  // Microsoft 365 GCC
  { key: "gcc_m365_g5", platform: "microsoft_gcc", name: "Microsoft 365 G5", kind: "base" },
  { key: "gcc_m365_g3", platform: "microsoft_gcc", name: "Microsoft 365 G3", kind: "base" },
  { key: "gcc_m365_f3", platform: "microsoft_gcc", name: "Microsoft 365 F3 (GCC)", kind: "base", note: "Frontline" },
  { key: "gcc_visio_p2", platform: "microsoft_gcc", name: "Visio Plan 2 (GCC)", kind: "addon" },
  { key: "gcc_project_p3", platform: "microsoft_gcc", name: "Project Plan 3 (GCC)", kind: "addon" },
  // Microsoft 365 GCC High
  { key: "gcch_m365_g5", platform: "microsoft_gcc_high", name: "Microsoft 365 G5 (GCC High)", kind: "base" },
  { key: "gcch_m365_g3", platform: "microsoft_gcc_high", name: "Microsoft 365 G3 (GCC High)", kind: "base" },
  { key: "gcch_m365_f3", platform: "microsoft_gcc_high", name: "Microsoft 365 F3 (GCC High)", kind: "base", note: "Frontline" },
  { key: "gcch_visio_p2", platform: "microsoft_gcc_high", name: "Visio Plan 2 (GCC High)", kind: "addon" },
  { key: "gcch_project_p3", platform: "microsoft_gcc_high", name: "Project Plan 3 (GCC High)", kind: "addon" },
  // Google Workspace
  { key: "gws_business_starter", platform: "google_workspace", name: "Google Workspace Business Starter", kind: "base" },
  { key: "gws_business_standard", platform: "google_workspace", name: "Google Workspace Business Standard", kind: "base" },
  { key: "gws_business_plus", platform: "google_workspace", name: "Google Workspace Business Plus", kind: "base" },
  { key: "gws_enterprise_standard", platform: "google_workspace", name: "Google Workspace Enterprise Standard", kind: "base" },
  { key: "gws_enterprise_plus", platform: "google_workspace", name: "Google Workspace Enterprise Plus", kind: "base" },
  { key: "gws_frontline_starter", platform: "google_workspace", name: "Google Workspace Frontline Starter", kind: "base", note: "Frontline" },
  { key: "gws_frontline_standard", platform: "google_workspace", name: "Google Workspace Frontline Standard", kind: "base", note: "Frontline" },
  // Zoho Workplace
  { key: "zoho_mail_lite", platform: "zoho_workplace", name: "Zoho Mail Lite", kind: "base" },
  { key: "zoho_workplace_standard", platform: "zoho_workplace", name: "Zoho Workplace Standard", kind: "base" },
  { key: "zoho_workplace_professional", platform: "zoho_workplace", name: "Zoho Workplace Professional", kind: "base" },
];

export function catalogLicense(key: string): CatalogLicense | undefined {
  return LICENSE_CATALOG.find((l) => l.key === key);
}

export function platformLabel(key: string): string {
  return LICENSE_PLATFORMS.find((p) => p.key === key)?.label ?? key;
}

/** Account types ("roles") that drive licensing. */
export const ACCOUNT_TYPES = [
  { key: "standard", label: "Standard user (birthright)", hint: "Employees who get the company's standard licence when their account is created." },
  { key: "frontline", label: "Frontline worker", hint: "Shift, field or shop-floor staff on a frontline licence." },
  { key: "contractor", label: "Contractor / external", hint: "Contractors, vendors and other non-employees." },
  { key: "admin", label: "Admin account", hint: "A separate privileged account used for administration." },
  { key: "service", label: "Service account", hint: "A non-person account used by an application or integration." },
  { key: "shared", label: "Shared / generic account", hint: "A shared mailbox, kiosk or room account." },
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number]["key"];
const ACCOUNT_TYPE_KEYS = ACCOUNT_TYPES.map((a) => a.key) as [AccountType, ...AccountType[]];

export function accountTypeLabel(key: string): string {
  return ACCOUNT_TYPES.find((a) => a.key === key)?.label ?? key;
}

/** Person account types (portal users); the rest are non-person accounts named in a request. */
export const PERSON_ACCOUNT_TYPES: readonly AccountType[] = ["standard", "frontline", "contractor"];

export const ASSIGNMENTS = ["automatic", "request", "not_eligible"] as const;
export type Assignment = (typeof ASSIGNMENTS)[number];

export const ASSIGNMENT_LABELS: Record<Assignment, string> = {
  automatic: "Automatically licensed",
  request: "Request required",
  not_eligible: "Not eligible",
};

// ---------- policy ----------

const groupName = z.string().trim().max(200).default("");

export const baseRuleSchema = z.object({
  platform: z.enum(PLATFORM_KEYS),
  accountType: z.enum(ACCOUNT_TYPE_KEYS),
  /** null = any tier */
  tier: z.string().trim().max(60).nullable().default(null),
  licenseKey: z.string().trim().max(60),
  assignment: z.enum(ASSIGNMENTS),
  group: groupName,
});
export type BaseRule = z.infer<typeof baseRuleSchema>;

export const addonRuleSchema = z.object({
  platform: z.enum(PLATFORM_KEYS),
  licenseKey: z.string().trim().max(60),
  eligibleAccountTypes: z.array(z.enum(ACCOUNT_TYPE_KEYS)).min(1),
  group: groupName,
  /** Who approves before DE adds the account to the group. */
  approval: z.enum(["none", "manager", "it_contact"]).default("manager"),
});
export type AddonRule = z.infer<typeof addonRuleSchema>;

export const licensePolicySchema = z.object({
  platforms: z
    .array(z.object({ platform: z.enum(PLATFORM_KEYS), tenantLabel: z.string().trim().max(80).default("") }))
    .max(5),
  tiers: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  baseRules: z.array(baseRuleSchema).max(100).default([]),
  addons: z.array(addonRuleSchema).max(100).default([]),
  notes: z.string().trim().max(2000).default(""),
});
export type LicensePolicy = z.infer<typeof licensePolicySchema>;

export const EMPTY_POLICY: LicensePolicy = { platforms: [], tiers: [], baseRules: [], addons: [], notes: "" };

/** Schema plus cross checks: licences exist on the rule's platform and kind, platforms are declared, tiers are declared. */
export function validateLicensePolicy(input: unknown): { policy?: LicensePolicy; errors: string[] } {
  const parsed = licensePolicySchema.safeParse(input);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const p = parsed.data;
  const errors: string[] = [];
  const declared = new Set(p.platforms.map((x) => x.platform));
  p.baseRules.forEach((r, i) => {
    const lic = catalogLicense(r.licenseKey);
    if (!declared.has(r.platform)) errors.push(`baseRules.${i}: platform ${platformLabel(r.platform)} is not declared`);
    if (r.assignment !== "not_eligible" && (!lic || lic.platform !== r.platform || lic.kind !== "base")) {
      errors.push(`baseRules.${i}: ${r.licenseKey} is not a base licence on ${platformLabel(r.platform)}`);
    }
    if (r.tier && !p.tiers.includes(r.tier)) errors.push(`baseRules.${i}: tier "${r.tier}" is not declared`);
  });
  p.addons.forEach((r, i) => {
    const lic = catalogLicense(r.licenseKey);
    if (!declared.has(r.platform)) errors.push(`addons.${i}: platform ${platformLabel(r.platform)} is not declared`);
    if (!lic || lic.platform !== r.platform) errors.push(`addons.${i}: ${r.licenseKey} is not a licence on ${platformLabel(r.platform)}`);
  });
  return errors.length ? { errors } : { policy: p, errors };
}

// ---------- resolution ----------

export type AccountClassification = { accountType: AccountType; tier: string | null };

export type ResolvedBase = {
  platform: LicensePlatform;
  rule: BaseRule | null;
  license: CatalogLicense | null;
  assignment: Assignment;
};

/**
 * The base licence for an account on one platform: the most specific rule
 * wins (matching tier before "any tier"). No rule = not eligible.
 */
export function resolveBaseLicense(policy: LicensePolicy, platform: LicensePlatform, who: AccountClassification): ResolvedBase {
  const rules = policy.baseRules.filter((r) => r.platform === platform && r.accountType === who.accountType);
  const rule = rules.find((r) => r.tier && r.tier === who.tier) ?? rules.find((r) => !r.tier) ?? null;
  if (!rule) return { platform, rule: null, license: null, assignment: "not_eligible" };
  return { platform, rule, license: catalogLicense(rule.licenseKey) ?? null, assignment: rule.assignment };
}

export type RequestableLicense = {
  platform: LicensePlatform;
  licenseKey: string;
  name: string;
  kind: "base" | "addon";
  group: string;
  /** "automatic" means no request is needed (shown, not selectable). */
  assignment: Assignment;
  approval: "none" | "manager" | "it_contact";
};

/** Everything an account could hold on the company's platforms, with how to get it. */
export function requestableLicenses(policy: LicensePolicy, who: AccountClassification): RequestableLicense[] {
  const out: RequestableLicense[] = [];
  for (const { platform } of policy.platforms) {
    const base = resolveBaseLicense(policy, platform, who);
    if (base.license && base.rule) {
      out.push({
        platform,
        licenseKey: base.license.key,
        name: base.license.name,
        kind: "base",
        group: base.rule.group,
        assignment: base.assignment,
        approval: "manager",
      });
    }
    for (const a of policy.addons.filter((x) => x.platform === platform)) {
      const lic = catalogLicense(a.licenseKey);
      if (!lic) continue;
      out.push({
        platform,
        licenseKey: lic.key,
        name: lic.name,
        kind: "addon",
        group: a.group,
        assignment: a.eligibleAccountTypes.includes(who.accountType) ? "request" : "not_eligible",
        approval: a.approval,
      });
    }
  }
  return out;
}

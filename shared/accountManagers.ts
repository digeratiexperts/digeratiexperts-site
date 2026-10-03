/**
 * Account manager profiles. Every prospect/client (portal_clients row) is
 * assigned one by id in `portal_clients.account_manager`; client-facing
 * documents and pages show that person plus the sales department.
 *
 * Add a person here (and a square headshot under
 * client/public/images/account-managers/) before assigning them. Unknown or
 * empty assignments resolve to DEFAULT_ACCOUNT_MANAGER_ID.
 */
import { COMPANY, PRIMARY_PHONE } from "./companyContact";

export interface AccountManagerProfile {
  id: string;
  name: string;
  title: string;
  email: string;
  /** Display form (from PRIMARY_PHONE unless the person has a direct line). */
  phoneDisplay: string;
  /** tel: href */
  phoneHref: string;
  /** Square headshot, site-relative (served from client/public). */
  photo: { jpg: string; webp: string; alt: string };
}

export const ACCOUNT_MANAGERS: readonly AccountManagerProfile[] = [
  {
    id: "joe-petro",
    name: "Joseph Petro",
    title: "Founder & Account Manager",
    // Placeholder until DE gives a direct inbox for this profile.
    email: COMPANY.email,
    phoneDisplay: PRIMARY_PHONE.display,
    phoneHref: PRIMARY_PHONE.telHref,
    photo: {
      jpg: "/images/account-managers/joe-petro.jpg",
      webp: "/images/account-managers/joe-petro.webp",
      alt: "Joseph Petro",
    },
  },
];

export const DEFAULT_ACCOUNT_MANAGER_ID = "joe-petro";

export const SALES_DEPARTMENT = {
  name: "Sales department",
  email: COMPANY.salesEmail,
  phoneDisplay: PRIMARY_PHONE.display,
  phoneHref: PRIMARY_PHONE.telHref,
} as const;

export function isAccountManagerId(id: unknown): id is string {
  return typeof id === "string" && ACCOUNT_MANAGERS.some((m) => m.id === id);
}

/** The assigned profile, or the default when unassigned/unknown. */
export function resolveAccountManager(id?: string | null): AccountManagerProfile {
  const hit = id ? ACCOUNT_MANAGERS.find((m) => m.id === id) : undefined;
  return hit ?? (ACCOUNT_MANAGERS.find((m) => m.id === DEFAULT_ACCOUNT_MANAGER_ID) as AccountManagerProfile);
}

/** Client-safe shape returned by APIs: the manager plus the sales department. */
export interface AccountTeam {
  manager: AccountManagerProfile;
  sales: typeof SALES_DEPARTMENT;
}

export function accountTeamFor(id?: string | null): AccountTeam {
  return { manager: resolveAccountManager(id), sales: SALES_DEPARTMENT };
}

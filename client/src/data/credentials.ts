/**
 * Credentials Digerati Experts publishes: certifications, partner programs,
 * ratings and registrations. The single source for every credential the site
 * names (docs/CLAIMS-REGISTER.md, "How to add a claim", rule 3).
 *
 * An entry belongs here only when the issuer's own record can be opened by a
 * visitor: `verifyUrl` is the issuer's verification or directory page (ISC2,
 * CompTIA / Credly, Microsoft partner listing, Google Partners, BBB profile,
 * Arizona Corporation Commission...), not our own site and not a third-party
 * mirror. `checkedOn` is the date someone at DE opened that page and saw the
 * entry. Pages never type a credential name themselves; they render this list
 * (VerifiedCredentials), and `credentials.test.ts` fails if they do.
 *
 * Joe, 2026-10-03: make these claims "authentic, branded and true rather than
 * remove them or flag them forever". The earlier certification and partner
 * lists had no verification behind them, so the list starts empty and fills
 * as each record is confirmed.
 */

export type CredentialKind = "certification" | "partner" | "rating" | "registration";

export type VerifiedCredential = {
  kind: CredentialKind;
  /** As the issuer names it, e.g. "CompTIA A+". */
  name: string;
  /** Who holds it: a person ("Joseph Petro") or "Digerati Experts". */
  holder: string;
  /** The issuing body, e.g. "CompTIA". */
  issuer: string;
  /** The issuer's own record for this holder. https only. */
  verifyUrl: string;
  /** YYYY-MM-DD the record was last opened and matched. */
  checkedOn: string;
};

export const VERIFIED_CREDENTIALS: VerifiedCredential[] = [];

export const CREDENTIAL_KIND_LABEL: Record<CredentialKind, string> = {
  certification: "Certification",
  partner: "Partner program",
  rating: "Rating",
  registration: "Registration",
};

export function credentialsOfKind(kinds: CredentialKind[]): VerifiedCredential[] {
  return VERIFIED_CREDENTIALS.filter((c) => kinds.includes(c.kind));
}

import { BadgeCheck, ExternalLink } from "lucide-react";
import {
  CREDENTIAL_KIND_LABEL,
  credentialsOfKind,
  type CredentialKind,
} from "@/data/credentials";

/**
 * Renders credentials from client/src/data/credentials.ts, each linked to the
 * issuer's own record. With nothing verified yet it says so plainly and tells
 * the visitor how to get a verification link, rather than listing names
 * nobody can check.
 */
export function VerifiedCredentials({
  kinds = ["certification", "partner", "rating", "registration"],
  testId = "list-verified-credentials",
}: {
  kinds?: CredentialKind[];
  testId?: string;
}) {
  const items = credentialsOfKind(kinds);

  if (items.length === 0) {
    return (
      <div
        className="max-w-[62ch] border-l-2 border-[#D3126A] pl-5 text-base leading-relaxed text-white/75"
        data-testid={`${testId}-empty`}
      >
        <p>
          We publish a certification, partnership or rating only with a link to
          the issuer's own record, so you can check it yourself. Our verified list
          is being compiled.
        </p>
        <p className="mt-3">
          Need proof for a vendor questionnaire or an insurer? Ask us, and we will
          send the issuer's verification link for any credential we hold.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid={testId}>
      {items.map((c) => (
        <li key={`${c.issuer}:${c.name}:${c.holder}`}>
          <a
            href={c.verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full min-h-11 items-start gap-3 rounded-lg border border-[var(--de-hairline)] bg-de-raised px-5 py-4 transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
          >
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-de-magenta-ink" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-medium text-white">{c.name}</span>
              <span className="block text-sm text-white/65">
                {CREDENTIAL_KIND_LABEL[c.kind]} · {c.holder}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-white/60 underline underline-offset-2">
                Verify with {c.issuer}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

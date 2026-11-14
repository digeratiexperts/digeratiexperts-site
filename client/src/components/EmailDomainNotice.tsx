import { Mail } from "lucide-react";
import { PRIMARY_PHONE } from "@/data/companyContact";

const HEADING = "How Digerati Experts' email domains work";
const BODY_BEFORE =
  "Digerati Experts (DE) owns two domains: digeratiexperts.com and digerati-experts.com. Our website and all client email, including billing@ and admin@, use digeratiexperts.com. We use digerati-experts.com for internal systems, and messages sent there still reach us. DE will never email you from any other domain or ask you to pay through an unexpected link. If something looks off, ";
const BODY_AFTER = " before you click or pay.";

/**
 * Shared client-facing note on the two DE email domains.
 * Used on Contact and the Trust Center.
 */
export function EmailDomainNotice({ className = "" }: { className?: string }) {
  return (
    <section
      className={className}
      aria-labelledby="email-domains-heading"
      data-testid="email-domain-notice"
    >
      <div className="rounded-2xl border border-de-hairline bg-de-raised p-6 shadow-[0_16px_48px_rgba(0,0,0,0.35)] sm:p-8">
        <div className="flex gap-4 sm:gap-5">
          <div
            className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-de-hairline bg-[#0a0a0a] sm:flex"
            aria-hidden="true"
          >
            <Mail className="h-5 w-5 text-[#D3126A]" />
          </div>
          <div className="min-w-0">
            <h2
              id="email-domains-heading"
              className="font-heading text-xl font-semibold leading-snug text-white md:text-2xl"
            >
              {HEADING}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/75">
              {BODY_BEFORE}
              <a
                href={PRIMARY_PHONE.telHref}
                className="font-semibold text-white underline decoration-[#D3126A]/80 underline-offset-4 transition-colors hover:text-[#f0187a] hover:decoration-[#f0187a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-de-raised rounded-sm"
                aria-label={`Call us at ${PRIMARY_PHONE.display}`}
              >
                call us
              </a>
              {BODY_AFTER}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

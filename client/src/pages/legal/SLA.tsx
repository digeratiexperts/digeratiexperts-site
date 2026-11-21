import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";
import { Link } from "wouter";

/**
 * The former public SLA page stated response times, 99.9% SOC uptime, and
 * service credits that belong only in a signed agreement. This page no longer
 * makes those promises.
 */
export default function SLA() {
  return (
    <LegalDocumentLayout
      title="Service levels"
      description="Service levels for Digerati Experts managed services are set in your signed agreement."
      canonical="/legal/sla"
    >
      <p className="mb-4 text-lg leading-relaxed text-[#3A3448]">
        Service levels are set in your signed agreement.
      </p>
      <p className="mb-4 leading-relaxed text-[#3A3448]">
        This website does not promise a service level, response time, monitoring
        availability, or uptime. If your organization has a signed Master Services
        Agreement, Order Form, or Statement of Work with Digerati Experts, that
        agreement is the source of any service levels that apply to you.
      </p>
      <p className="mb-4 leading-relaxed text-[#3A3448]">
        For questions about an existing agreement, email{" "}
        <a
          href="mailto:admin@digeratiexperts.com"
          className="underline decoration-[#A30E52]/50 underline-offset-2 hover:decoration-[#A30E52]"
        >
          admin@digeratiexperts.com
        </a>
        . Website use is governed by the{" "}
        <Link
          href="/legal/terms-of-use"
          className="underline decoration-[#A30E52]/50 underline-offset-2 hover:decoration-[#A30E52]"
        >
          Terms of Use
        </Link>
        .
      </p>
    </LegalDocumentLayout>
  );
}
